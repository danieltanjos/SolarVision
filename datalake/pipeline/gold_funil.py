"""Job Gold do funil (enunciado 5.3): funil de ativação e funil de entrada.

    docker compose run --rm app python pipeline/gold_funil.py

Grava gold/funil_ativacao e gold/funil_login.
"""

from pyspark.sql import DataFrame, Window
from pyspark.sql import functions as F

from comum import caminho, criar_sessao, exigir_camada, glob_eventos, ler_eventos, titulo

ETAPAS = ("sign_up", "create_group", "create_panel", "view_monitoring",
          "import_readings", "register_cleaning", "generate_report")
TELAS_DE_ENTRADA = ("/login", "/register")
TODOS = "(todos)"


def primeiro_cadastro(eventos: DataFrame) -> DataFrame:
    """Uma linha por pessoa com sign_up: o canal e o dispositivo da sessão do primeiro sign_up (5.4.4)."""
    ordem = Window.partitionBy("pessoa").orderBy("event_ts", "event_id")
    return (eventos.filter(F.col("event_name") == "sign_up")
            .withColumn("_n", F.row_number().over(ordem)).filter(F.col("_n") == 1)
            .select("pessoa", F.col("event_ts").alias("cadastro_em"),
                    F.col("canal_sessao").alias("canal"), F.col("dispositivo_sessao").alias("dispositivo")))


def _conversoes(contagem: DataFrame, chaves: list[str]) -> DataFrame:
    """Conversão sobre a etapa anterior e sobre o topo, dentro de cada recorte (5.4.5)."""
    recorte = Window.partitionBy(*chaves).orderBy("ordem")
    topo = F.first("pessoas").over(recorte.rowsBetween(Window.unboundedPreceding, Window.unboundedFollowing))
    return (contagem
            .withColumn("conversao_etapa_anterior",
                        F.round(F.try_divide(F.col("pessoas"), F.lag("pessoas").over(recorte)), 4))
            .withColumn("conversao_topo", F.round(F.try_divide(F.col("pessoas"), topo), 4)))


def funil_ativacao(eventos: DataFrame) -> DataFrame:
    """Pessoas com sign_up que tiveram cada etapa em qualquer momento (sem exigir as anteriores),
    no total e por canal × dispositivo."""
    novos = primeiro_cadastro(eventos)
    etapas = (eventos.filter(F.col("event_name").isin(*ETAPAS))
              .select("pessoa", F.col("event_name").alias("etapa")).distinct()
              .join(novos, "pessoa"))
    por_recorte = etapas.groupBy("canal", "dispositivo", "etapa").agg(F.countDistinct("pessoa").alias("pessoas"))
    total = (etapas.groupBy("etapa").agg(F.countDistinct("pessoa").alias("pessoas"))
             .select(F.lit(TODOS).alias("canal"), F.lit(TODOS).alias("dispositivo"), "etapa", "pessoas"))
    recortes = (novos.select("canal", "dispositivo").distinct()
                .unionByName(eventos.sparkSession.createDataFrame([(TODOS, TODOS)], "canal string, dispositivo string")))
    ordem = eventos.sparkSession.createDataFrame(list(enumerate(ETAPAS, start=1)), "ordem int, etapa string")
    grade = (recortes.crossJoin(ordem)
             .join(por_recorte.unionByName(total), ["canal", "dispositivo", "etapa"], "left")
             .fillna(0, subset=["pessoas"]))
    return (_conversoes(grade, ["canal", "dispositivo"])
            .select("canal", "dispositivo", "ordem", "etapa", "pessoas", "conversao_etapa_anterior", "conversao_topo")
            .orderBy(F.col("canal") != TODOS, "canal", "dispositivo", "ordem"))


def funil_login(eventos: DataFrame) -> DataFrame:
    """Por canal da sessão: sessões que abriram /login ou /register e quantas entraram (login ou sign_up)."""
    por_sessao = (eventos.groupBy("sessao_id", "canal_sessao")
                  .agg(F.max((F.col("event_name") == "page_view") & F.col("pagina").isin(*TELAS_DE_ENTRADA))
                       .alias("viu_entrada"),
                       F.max(F.col("event_name").isin("login", "sign_up")).alias("entrou"))
                  .filter("viu_entrada"))

    def contar(df, canal):
        return df.agg(F.count("*").alias("sessoes_tela_entrada"),
                      F.sum(F.col("entrou").cast("int")).alias("sessoes_entraram")).select(canal, "*")

    total = contar(por_sessao, F.lit(TODOS).alias("canal"))
    por_canal = (por_sessao.groupBy(F.col("canal_sessao").alias("canal"))
                 .agg(F.count("*").alias("sessoes_tela_entrada"),
                      F.sum(F.col("entrou").cast("int")).alias("sessoes_entraram")))
    return (por_canal.unionByName(total)
            .withColumn("taxa_entrada", F.round(F.try_divide(F.col("sessoes_entraram"), F.col("sessoes_tela_entrada")), 4))
            .orderBy(F.col("canal") != TODOS, F.desc("sessoes_tela_entrada")))


def calcular(eventos: DataFrame) -> dict[str, DataFrame]:
    return {"funil_ativacao": funil_ativacao(eventos), "funil_login": funil_login(eventos)}


def main() -> None:
    spark = criar_sessao("gold_funil")
    exigir_camada(spark, glob_eventos("silver"), "python pipeline/silver.py")
    eventos = ler_eventos(spark, "silver").cache()
    titulo("Gold · funil")
    for nome, tabela in calcular(eventos).items():
        tabela.write.mode("overwrite").parquet(caminho(f"gold/{nome}"))
        print(f"gold/{nome}: {tabela.count()} linhas")
    spark.stop()


if __name__ == "__main__":
    main()
