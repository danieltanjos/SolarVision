"""Job de previsão da energia dos próximos 7 dias para as placas do app, com o modelo treinado.

    docker compose run --rm app python pipeline/prever_energia.py

Lê o modelo (modelos/previsao_energia) e as linhas de previsão de gold/energia_diaria: os dias cujo clima é a
previsão do tempo, com as mesmas features do treino (o histórico da placa vai até 8 dias antes de cada dia,
então já está no passado). A previsão é o estimado físico × a razão prevista, com a faixa P10-P90 do teste.

Grava gold/previsao_7dias. As placas da referência da UFSC não têm previsão do tempo: só as do app entram.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from pyspark.sql import DataFrame
from pyspark.sql import functions as F

from comum import caminho, criar_sessao, exigir_camada, titulo
from gold_previsao_energia import MODELO, carregar_modelo

DIAS = 7
FUSO = timedelta(hours=3)


def hoje_local(agora: datetime | None = None) -> date:
    return ((agora or datetime.now(timezone.utc)) - FUSO).date()


def prever(modelo, diaria: DataFrame, faixa: tuple[float, float], hoje: date, nome_modelo: str) -> DataFrame:
    """Uma linha por placa do app e dia de hoje a hoje + 6, com o estimado, a previsão e a faixa."""
    p10, p90 = faixa
    alvo = diaria.filter((F.col("conjunto") == "previsao") & (F.col("fonte") == "app")
                         & F.col("dia").between(F.lit(hoje), F.lit(hoje + timedelta(days=DIAS - 1))))
    previsto = modelo.transform(alvo).withColumn("razao_prevista", F.round(F.greatest(F.col("prediction"), F.lit(0.0)), 4))
    prevista = F.col("estimada_wh") * F.col("razao_prevista")
    return previsto.select(
        "placa_id", "dia", F.round("estimada_wh", 1).alias("estimada_wh"), F.round(prevista, 1).alias("prevista_wh"),
        F.round(prevista * (1 + p10), 1).alias("p10_wh"), F.round(prevista * (1 + p90), 1).alias("p90_wh"),
        "razao_prevista", "tem_historico", F.lit(nome_modelo).alias("modelo"),
        F.current_timestamp().alias("gerada_em"))


def main() -> None:
    spark = criar_sessao("prever_energia")
    exigir_camada(spark, MODELO, "python pipeline/gold_previsao_energia.py")
    exigir_camada(spark, "gold/energia_diaria", "python pipeline/gold_previsao_energia.py")
    metricas = spark.read.parquet(caminho("gold/metricas_previsao")).filter("metodo = 'modelo'").first()
    nome = f"GBT sobre a física ({metricas.hiperparametros}); nMAE semana {metricas.nmae_semana:.1%} no teste"
    tabela = prever(carregar_modelo(spark), spark.read.parquet(caminho("gold/energia_diaria")),
                    (metricas.p10_relativo, metricas.p90_relativo), hoje_local(), nome).cache()
    tabela.write.mode("overwrite").parquet(caminho("gold/previsao_7dias"))

    titulo("Previsão de energia · próximos 7 dias")
    n = tabela.count()
    if not n:
        print("Nenhuma placa do app com a previsão do tempo da semana (rode coletor/coletar_energia.py antes).")
    else:
        resumo = tabela.agg(F.countDistinct("placa_id").alias("placas"), F.sum("estimada_wh").alias("estimada"),
                            F.sum("prevista_wh").alias("prevista")).first()
        print(f"gold/previsao_7dias: {n} linhas, {resumo.placas} placas · física {resumo.estimada / 1000:.1f} kWh"
              f" · modelo {resumo.prevista / 1000:.1f} kWh na semana")
    spark.stop()


if __name__ == "__main__":
    main()
