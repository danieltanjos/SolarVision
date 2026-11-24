"""Job de qualidade da energia: o portão do workflow previsao_energia, entre a Silver e o modelo.

    docker compose run --rm app python pipeline/qualidade_energia.py

As mesmas peças do qualidade.py (Regra, tabela, falhas_bloqueantes), com as regras da previsão:

- a Silver tem horas com clima e dias medidos por inteiro em número suficiente para treinar;
- a taxa de leituras rejeitadas fica no esperado (medidor ruim não pode ensinar o modelo);
- toda placa do app tem a previsão do tempo da próxima semana (alerta: sem ela não há previsão a publicar).

Grava gold/qualidade_energia em append. Regra bloqueante que falha: sai com código 1 e o modelo não é treinado.
"""

from __future__ import annotations

from datetime import datetime, timezone

from pyspark.sql import DataFrame
from pyspark.sql import functions as F

from comum import caminho, criar_sessao, exigir_camada, titulo
from qualidade import Regra, falhas_bloqueantes, tabela

DIAS_COMPLETOS_MINIMOS = 180           # meio ano de dias medidos por inteiro, para ver as estações
TAXA_REJEICAO_MAXIMA = 0.10


def medir(horas: DataFrame, dias: DataFrame, rejeitados: DataFrame, placas: DataFrame) -> dict[str, int]:
    agora = datetime.now(timezone.utc)
    s = horas.agg(F.count("*").alias("horas"), F.sum(F.col("real_wh").isNotNull().cast("int")).alias("medidas")).first()
    com_previsao = (horas.filter(F.col("previsao") & (F.col("data_hora") > F.lit(agora)))
                    .select("placa_id").distinct())
    app = placas.filter(F.col("fonte") == "app")
    return {"horas": s.horas, "horas_medidas": s.medidas or 0,
            "dias_completos": dias.filter("completo").count(), "rejeitados": rejeitados.count(),
            "placas_app": app.count(), "placas_app_sem_previsao": app.join(com_previsao, "placa_id", "left_anti").count()}


def regras(m: dict[str, int]) -> list[Regra]:
    leituras = m["horas_medidas"] + m["rejeitados"]
    rejeicao = round(m["rejeitados"] / leituras, 4) if leituras else 0.0
    return [
        Regra("silver tem horas com clima", m["horas"], "> 0", m["horas"] > 0, True),
        Regra("dias medidos por inteiro para treinar", m["dias_completos"], f">= {DIAS_COMPLETOS_MINIMOS}",
              m["dias_completos"] >= DIAS_COMPLETOS_MINIMOS, True),
        Regra("taxa de leituras rejeitadas", rejeicao, f"<= {TAXA_REJEICAO_MAXIMA}",
              rejeicao <= TAXA_REJEICAO_MAXIMA, True),
        Regra("placas do app sem a previsão do tempo da semana", m["placas_app_sem_previsao"], "= 0",
              m["placas_app_sem_previsao"] == 0, False),
    ]


def main() -> None:
    spark = criar_sessao("qualidade_energia")
    exigir_camada(spark, "silver_energia/horas", "python pipeline/silver_energia.py")
    ler = lambda t: spark.read.parquet(caminho(f"silver_energia/{t}"))  # noqa: E731
    resultado = regras(medir(ler("horas"), ler("dias_medidos"), ler("rejeitados"), ler("placas")))
    executado_em = datetime.now(timezone.utc).replace(microsecond=0)
    tabela(spark, resultado, executado_em).write.mode("append").parquet(caminho("gold/qualidade_energia"))

    titulo("Qualidade da energia")
    for r in resultado:
        marca = "ok" if r.ok else ("FALHOU" if r.bloqueante else "alerta")
        print(f"[{marca:^6}] {r.regra:<52}{r.valor:>12g}  (limite {r.limite})")
    spark.stop()
    falhas = falhas_bloqueantes(resultado)
    if falhas:
        raise SystemExit(f"{len(falhas)} regra(s) bloqueante(s) falharam: o modelo não foi treinado.")


if __name__ == "__main__":
    main()
