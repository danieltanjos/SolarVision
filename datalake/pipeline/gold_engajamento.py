"""Job Gold de engajamento (enunciado 5.3): sessões, uso das telas, buscas e saídas/downloads.

    docker compose run --rm app python pipeline/gold_engajamento.py

Grava gold/sessoes, gold/uso_telas, gold/buscas_seletor e gold/saidas_downloads.
"""

from pyspark.sql import DataFrame, Window
from pyspark.sql import functions as F

from comum import caminho, criar_sessao, exigir_camada, glob_eventos, ler_eventos, titulo

TEMPO_MAXIMO_NA_TELA = 30 * 60      # segundos: mais que isso é aba esquecida aberta, não uso


def _tem(nome: str) -> F.Column:
    return F.max(F.col("event_name") == nome)


def sessoes(eventos: DataFrame) -> DataFrame:
    """Uma linha por sessão: duração, eventos, telas, scroll máximo, ativou, canal e dispositivo."""
    return (eventos.groupBy("sessao_id")
            .agg(F.first("pessoa").alias("pessoa"),
                 F.first("user_pseudo_id").alias("user_pseudo_id"),
                 F.min("event_ts").alias("inicio"),
                 F.max("event_ts").alias("fim"),
                 F.count("*").alias("eventos"),
                 F.countDistinct(F.when(F.col("event_name") == "page_view", F.col("pagina"))).alias("telas_distintas"),
                 F.coalesce(F.max("percent_scrolled"), F.lit(0)).alias("scroll_maximo"),
                 _tem("sign_up").alias("criou_conta"),
                 _tem("create_panel").alias("ativou"),
                 F.first("canal_sessao").alias("canal"),
                 F.first("dispositivo_sessao").alias("dispositivo"))
            .withColumn("duracao_seg", F.unix_seconds("fim") - F.unix_seconds("inicio"))
            .select("sessao_id", "pessoa", "user_pseudo_id", "inicio", "fim", "duracao_seg", "eventos",
                    "telas_distintas", "scroll_maximo", "criou_conta", "ativou", "canal", "dispositivo"))


def visitas_de_tela(eventos: DataFrame) -> DataFrame:
    """Cada page_view com o tempo até a tela seguinte (ou até o último evento dela, se for a última da
    sessão) e o scroll máximo alcançado nela. Cada evento pertence ao último page_view antes dele."""
    ordem = Window.partitionBy("sessao_id").orderBy("event_ts", "event_id")
    com_visita = eventos.withColumn(
        "visita", F.last(F.when(F.col("event_name") == "page_view", F.col("event_id")), ignorenulls=True)
        .over(ordem.rowsBetween(Window.unboundedPreceding, 0)))
    por_visita = (com_visita.filter(F.col("visita").isNotNull())
                  .groupBy("sessao_id", "visita")
                  .agg(F.min("event_ts").alias("entrou"), F.max("event_ts").alias("ultimo_evento"),
                       F.first(F.when(F.col("event_name") == "page_view", F.col("pagina")), ignorenulls=True)
                       .alias("pagina"),
                       F.coalesce(F.max("percent_scrolled"), F.lit(0)).alias("scroll")))
    seguinte = F.lead("entrou").over(Window.partitionBy("sessao_id").orderBy("entrou", "visita"))
    fim = F.coalesce(seguinte, F.col("ultimo_evento"))
    return por_visita.withColumn(
        "tempo_seg", F.least(F.unix_seconds(fim) - F.unix_seconds("entrou"), F.lit(TEMPO_MAXIMO_NA_TELA)))


def uso_telas(eventos: DataFrame) -> DataFrame:
    """Por página: visualizações, sessões, tempo médio na tela (s) e scroll médio (%)."""
    return (visitas_de_tela(eventos).groupBy("pagina")
            .agg(F.count("*").alias("visualizacoes"),
                 F.countDistinct("sessao_id").alias("sessoes"),
                 F.round(F.avg("tempo_seg"), 1).alias("tempo_medio_seg"),
                 F.round(F.avg("scroll"), 1).alias("scroll_medio"))
            .orderBy(F.desc("visualizacoes")))


def buscas_seletor(eventos: DataFrame) -> DataFrame:
    """O que se busca no seletor de usinas e o que se busca sem achar (search_results = 0)."""
    return (eventos.filter(F.col("event_name") == "site_search")
            .withColumn("termo", F.lower(F.trim("search_term")))
            .groupBy("termo")
            .agg(F.count("*").alias("buscas"),
                 F.sum((F.col("search_results") == 0).cast("int")).alias("buscas_sem_resultado"),
                 F.countDistinct("pessoa").alias("pessoas"))
            .orderBy(F.desc("buscas_sem_resultado"), F.desc("buscas")))


def saidas_downloads(eventos: DataFrame) -> DataFrame:
    """Cliques de saída por domínio e relatórios impressos (Imprimir/PDF) por mês de referência."""
    saidas = (eventos.filter((F.col("event_name") == "click") & F.col("outbound"))
              .groupBy(F.lit("saida").alias("tipo"), F.col("link_domain").alias("alvo"))
              .agg(F.count("*").alias("total"), F.countDistinct("sessao_id").alias("sessoes")))
    impressos = (eventos.filter(F.col("event_name") == "file_download")
                 .groupBy(F.lit("relatorio_impresso").alias("tipo"), F.col("report_month").alias("alvo"))
                 .agg(F.count("*").alias("total"), F.countDistinct("sessao_id").alias("sessoes")))
    return saidas.unionByName(impressos).orderBy("tipo", F.desc("total"))


def calcular(eventos: DataFrame) -> dict[str, DataFrame]:
    return {
        "sessoes": sessoes(eventos),
        "uso_telas": uso_telas(eventos),
        "buscas_seletor": buscas_seletor(eventos),
        "saidas_downloads": saidas_downloads(eventos),
    }


def main() -> None:
    spark = criar_sessao("gold_engajamento")
    exigir_camada(spark, glob_eventos("silver"), "python pipeline/silver.py")
    eventos = ler_eventos(spark, "silver").cache()
    titulo("Gold · engajamento")
    for nome, tabela in calcular(eventos).items():
        tabela.write.mode("overwrite").parquet(caminho(f"gold/{nome}"))
        print(f"gold/{nome}: {tabela.count()} linhas")
    spark.stop()


if __name__ == "__main__":
    main()
