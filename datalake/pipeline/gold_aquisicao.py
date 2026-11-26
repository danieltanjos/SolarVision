"""Job Gold de aquisição e retenção (enunciado 5.3): ativação, retenção, abandono e tempo até ativar.

    docker compose run --rm app python pipeline/gold_aquisicao.py

Grava gold/ativacao_diaria, gold/retencao, gold/taxa_abandono e gold/cadastro_para_ativacao.
"""

from pyspark.sql import DataFrame
from pyspark.sql import functions as F

from comum import caminho, criar_sessao, exigir_camada, glob_eventos, ler_eventos, titulo
from gold_funil import TODOS, primeiro_cadastro

DIAS_RETENCAO = (1, 7, 14)


def com_ativacao(eventos: DataFrame) -> DataFrame:
    """Pessoas com sign_up e o instante do primeiro create_panel estritamente depois dele (5.4.6)."""
    novos = primeiro_cadastro(eventos)
    placas = eventos.filter(F.col("event_name") == "create_panel").select("pessoa", "event_ts")
    primeira = (novos.join(placas, "pessoa")
                .filter(F.col("event_ts") > F.col("cadastro_em"))
                .groupBy("pessoa").agg(F.min("event_ts").alias("ativado_em")))
    return (novos.join(primeira, "pessoa", "left")
            .withColumn("dias_ate_ativar",
                        (F.unix_seconds("ativado_em") - F.unix_seconds("cadastro_em")) / 86400))


def _com_total(df: DataFrame, agregar) -> DataFrame:
    """Aplica `agregar` por canal e no total (canal = "(todos)")."""
    por_canal = agregar(df.groupBy("canal"))
    total = agregar(df.groupBy(F.lit(TODOS).alias("canal")))
    return por_canal.unionByName(total)


def ativacao_diaria(pessoas: DataFrame) -> DataFrame:
    """Por data (UTC) do sign_up e canal: novos usuários, quantos ativaram e a taxa."""
    return (pessoas.groupBy(F.to_date("cadastro_em").alias("data"), "canal")
            .agg(F.count("*").alias("novos"), F.count("ativado_em").alias("ativados"))
            .withColumn("taxa_ativacao", F.round(F.try_divide(F.col("ativados"), F.col("novos")), 4))
            .orderBy("data", "canal"))


def retencao(pessoas: DataFrame, eventos: DataFrame) -> DataFrame:
    """Retidos em D1, D7 e D14: voltaram numa sessão iniciada n dias ou mais depois do sign_up (5.4.7).
    Só é elegível em Dn quem se cadastrou n dias antes do último evento do datalake."""
    ultimo = eventos.agg(F.max("event_ts")).first()[0]
    inicios = eventos.select("pessoa", "sessao_inicio").distinct()
    resultado = None
    for n in DIAS_RETENCAO:
        intervalo = F.expr(f"INTERVAL {n} DAYS")
        elegiveis = pessoas.filter(F.col("cadastro_em") <= F.lit(ultimo) - intervalo)
        voltaram = (elegiveis.join(inicios, "pessoa")
                    .filter(F.col("sessao_inicio") >= F.col("cadastro_em") + intervalo)
                    .select("pessoa").distinct().withColumn("voltou", F.lit(True)))
        marcadas = elegiveis.join(voltaram, "pessoa", "left")
        linhas = (_com_total(marcadas, lambda g: g.agg(F.count("*").alias("elegiveis"),
                                                       F.count("voltou").alias("retidos")))
                  .withColumn("dia", F.lit(n)))
        resultado = linhas if resultado is None else resultado.unionByName(linhas)
    return (resultado.withColumn("taxa_retencao", F.round(F.try_divide(F.col("retidos"), F.col("elegiveis")), 4))
            .select("canal", "dia", "elegiveis", "retidos", "taxa_retencao")
            .orderBy(F.col("canal") != TODOS, "canal", "dia"))


def taxa_abandono(pessoas: DataFrame, eventos: DataFrame) -> DataFrame:
    """Entre quem ativou: quantos excluíram todas as placas que criaram, direto ou pelo grupo (5.4.8)."""
    criadas = (eventos.filter(F.col("event_name") == "create_panel")
               .select("pessoa", "panel_id", "group_id").distinct())
    por_placa = (eventos.filter(F.col("event_name") == "delete_panel")
                 .select("panel_id").distinct().withColumn("excluida", F.lit(True)))
    por_grupo = (eventos.filter(F.col("event_name") == "delete_group")
                 .select("group_id").distinct().withColumn("grupo_excluido", F.lit(True)))
    situacao = (criadas.join(por_placa, "panel_id", "left").join(por_grupo, "group_id", "left")
                .groupBy("pessoa")
                .agg(F.min(F.coalesce("excluida", "grupo_excluido", F.lit(False))).alias("abandonou")))
    ativaram = pessoas.filter(F.col("ativado_em").isNotNull()).join(situacao, "pessoa", "left")
    return (_com_total(ativaram, lambda g: g.agg(
                F.count("*").alias("ativaram"),
                F.sum(F.coalesce(F.col("abandonou"), F.lit(False)).cast("int")).alias("abandonaram")))
            .withColumn("taxa_abandono", F.round(F.try_divide(F.col("abandonaram"), F.col("ativaram")), 4))
            .orderBy(F.col("canal") != TODOS, F.desc("ativaram")))


def cadastro_para_ativacao(pessoas: DataFrame) -> DataFrame:
    """Pessoas com sign_up, quantas ativaram depois e a mediana de dias até a primeira placa (5.4.6)."""
    return (_com_total(pessoas, lambda g: g.agg(
                F.count("*").alias("pessoas"),
                F.count("ativado_em").alias("ativaram"),
                F.percentile_approx("dias_ate_ativar", 0.5).alias("mediana_dias")))
            .withColumn("taxa_ativacao", F.round(F.try_divide(F.col("ativaram"), F.col("pessoas")), 4))
            .withColumn("mediana_dias", F.round("mediana_dias", 3))
            .orderBy(F.col("canal") != TODOS, F.desc("pessoas")))


def calcular(eventos: DataFrame) -> dict[str, DataFrame]:
    pessoas = com_ativacao(eventos).cache()
    return {
        "ativacao_diaria": ativacao_diaria(pessoas),
        "retencao": retencao(pessoas, eventos),
        "taxa_abandono": taxa_abandono(pessoas, eventos),
        "cadastro_para_ativacao": cadastro_para_ativacao(pessoas),
    }


def main() -> None:
    spark = criar_sessao("gold_aquisicao")
    exigir_camada(spark, glob_eventos("silver"), "python pipeline/silver.py")
    eventos = ler_eventos(spark, "silver").cache()
    titulo("Gold · aquisição e retenção")
    for nome, tabela in calcular(eventos).items():
        tabela.write.mode("overwrite").parquet(caminho(f"gold/{nome}"))
        print(f"gold/{nome}: {tabela.count()} linhas")
    spark.stop()


if __name__ == "__main__":
    main()
