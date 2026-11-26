"""Job Gold de engajamento (enunciado 5.3): sessões, uso das telas, buscas, saídas/downloads,
adoção dos recursos e atividade diária (DAU/WAU/MAU).

    docker compose run --rm app python pipeline/gold_engajamento.py

Grava gold/sessoes, gold/uso_telas, gold/buscas_seletor, gold/saidas_downloads,
gold/adocao_recursos e gold/atividade_diaria.
"""

from pyspark.sql import DataFrame, Window
from pyspark.sql import functions as F

from comum import caminho, criar_sessao, exigir_camada, glob_eventos, ler_eventos, titulo

TEMPO_MAXIMO_NA_TELA = 30 * 60      # segundos: mais que isso é aba esquecida aberta, não uso
# recurso do produto -> evento que mostra o uso dele
RECURSOS = {
    "monitoramento": "view_monitoring",
    "troca de visão (dia/semana/mês/ano)": "select_content",
    "busca no seletor": "site_search",
    "importação de leituras": "import_readings",
    "registro de limpeza": "register_cleaning",
    "recomendação de limpeza": "view_cleaning_recommendation",
    "relatório": "generate_report",
    "impressão do relatório": "file_download",
    "alertas": "view_alerts",
    "configurações": "change_settings",
}
JANELAS = {"wau": 7, "mau": 28}     # dias da janela móvel de pessoas ativas


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


def adocao_recursos(eventos: DataFrame) -> DataFrame:
    """Para cada recurso do produto: das pessoas ativas (com algum evento no período), quantas usaram,
    quantas vezes (por pessoa que usou) e em quantos dias diferentes. Um recurso que quase ninguém
    adota, ou que é adotado mas usado num dia só, é candidato a ser revisto."""
    ativas = eventos.select(F.countDistinct("pessoa").alias("pessoas_ativas"))
    nomes = eventos.sparkSession.createDataFrame(list(RECURSOS.items()), "recurso string, evento string")
    uso = (eventos.filter(F.col("event_name").isin(*RECURSOS.values()))
           .groupBy(F.col("event_name").alias("evento"))
           .agg(F.countDistinct("pessoa").alias("pessoas_que_usaram"), F.count("*").alias("usos"),
                F.countDistinct("pessoa", F.to_date("event_ts")).alias("_pessoa_dias")))
    return (nomes.join(uso, "evento", "left").fillna(0, subset=["pessoas_que_usaram", "usos", "_pessoa_dias"])
            .crossJoin(ativas)
            .withColumn("taxa_adocao", F.round(F.try_divide(F.col("pessoas_que_usaram"), F.col("pessoas_ativas")), 4))
            .withColumn("usos_por_pessoa", F.round(F.try_divide(F.col("usos"), F.col("pessoas_que_usaram")), 2))
            .withColumn("dias_de_uso_por_pessoa",
                        F.round(F.try_divide(F.col("_pessoa_dias"), F.col("pessoas_que_usaram")), 2))
            .select("recurso", "evento", "pessoas_ativas", "pessoas_que_usaram", "taxa_adocao", "usos",
                    "usos_por_pessoa", "dias_de_uso_por_pessoa")
            .orderBy(F.desc("taxa_adocao"), "recurso"))


def atividade_diaria(eventos: DataFrame) -> DataFrame:
    """Por dia: pessoas ativas no dia (DAU), nos últimos 7 dias (WAU) e nos últimos 28 (MAU), e a
    aderência DAU/MAU (de quem usa no mês, que fração volta num dia qualquer). Nos primeiros dias
    do período a janela ainda não está completa (janela_completa = falso), e o último dia ainda está
    em andamento quando o pipeline roda (dia_completo = falso): os dois subestimam o uso."""
    pares = eventos.select("pessoa", F.to_date("event_ts").alias("dia_evento")).distinct()
    limites = pares.agg(F.min("dia_evento").alias("primeiro"), F.max("dia_evento").alias("ultimo"))
    dias = limites.select(F.explode(F.sequence("primeiro", "ultimo")).alias("data"), "primeiro", "ultimo")
    ativos = (dias.join(pares, (pares.dia_evento <= dias.data)
                        & (pares.dia_evento > F.date_sub(dias.data, max(JANELAS.values()))))
              .groupBy("data", "primeiro")
              .agg(F.countDistinct(F.when(F.col("dia_evento") == F.col("data"), F.col("pessoa"))).alias("dau"),
                   *[F.countDistinct(F.when(F.col("dia_evento") > F.date_sub("data", n), F.col("pessoa"))).alias(nome)
                     for nome, n in JANELAS.items()]))
    return (dias.join(ativos, ["data", "primeiro"], "left").fillna(0, subset=["dau", *JANELAS])
            .withColumn("dia_completo", F.col("data") < F.col("ultimo"))
            .withColumn("aderencia_dau_mau", F.round(F.try_divide(F.col("dau"), F.col("mau")), 4))
            .withColumn("janela_completa", F.date_diff("data", "primeiro") >= JANELAS["mau"] - 1)
            .select("data", "dau", "wau", "mau", "aderencia_dau_mau", "janela_completa", "dia_completo")
            .orderBy("data"))


def calcular(eventos: DataFrame) -> dict[str, DataFrame]:
    return {
        "sessoes": sessoes(eventos),
        "uso_telas": uso_telas(eventos),
        "buscas_seletor": buscas_seletor(eventos),
        "saidas_downloads": saidas_downloads(eventos),
        "adocao_recursos": adocao_recursos(eventos),
        "atividade_diaria": atividade_diaria(eventos),
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
