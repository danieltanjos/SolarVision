"""Job Gold do funil (enunciado 5.3): funil de ativação (qualquer momento e ordenado) e funil de entrada.

    docker compose run --rm app python pipeline/gold_funil.py

Grava gold/funil_ativacao, gold/funil_ordenado e gold/funil_login.
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


def _com_recortes(pessoas: DataFrame) -> DataFrame:
    """Cada linha duas vezes: no recorte canal × dispositivo dela e no total (todos × todos)."""
    total = pessoas.withColumn("canal", F.lit(TODOS)).withColumn("dispositivo", F.lit(TODOS))
    return pessoas.unionByName(total)


def jornada_ordenada(eventos: DataFrame) -> DataFrame:
    """Uma linha por pessoa com sign_up e o instante em que ela alcançou cada etapa NA ORDEM do funil:
    t1 = o primeiro sign_up; tk = o primeiro evento da etapa k em ou depois de t(k-1). Quem pulou uma
    etapa fica com nulo dali em diante, mesmo que tenha feito as seguintes.

    Uma passada só pelos eventos de cada pessoa em ordem de tempo (aggregate sobre o array ordenado):
    o estado guarda a próxima etapa esperada e os instantes já alcançados."""
    novos = primeiro_cadastro(eventos)
    ordem = F.array_position(F.array(*[F.lit(e) for e in ETAPAS]), F.col("event_name")).cast("int")
    marcos = (eventos.filter(F.col("event_name").isin(*ETAPAS))
              .join(novos.select("pessoa", "cadastro_em"), "pessoa")
              .filter(F.col("event_ts") >= F.col("cadastro_em"))
              .groupBy("pessoa")
              .agg(F.array_sort(F.collect_list(F.struct("event_ts", ordem.alias("ordem")))).alias("marcos")))
    inicio = F.struct(F.lit(1).alias("proxima"), F.array().cast("array<timestamp>").alias("instantes"))

    def avancar(estado, marco):
        return F.when(marco["ordem"] == estado["proxima"],
                      F.struct((estado["proxima"] + 1).alias("proxima"),
                               F.concat(estado["instantes"], F.array(marco["event_ts"])).alias("instantes"))
                      ).otherwise(estado)

    instantes = F.aggregate("marcos", inicio, avancar)["instantes"]
    return (novos.join(marcos, "pessoa", "left")
            .withColumn("_instantes", instantes)
            .select("pessoa", "cadastro_em", "canal", "dispositivo",
                    *[F.try_element_at("_instantes", F.lit(k)).alias(f"t{k}") for k in range(1, len(ETAPAS) + 1)]))


def funil_ordenado(eventos: DataFrame) -> DataFrame:
    """O funil estrito: a pessoa conta na etapa k só se passou pelas anteriores, nessa ordem. Ao lado do
    funil_ativacao (qualquer momento, regra 5.4.4) mostra o caminho de verdade: quantas pessoas se
    perderam em cada etapa, quanto tempo levaram desde a anterior (mediana, em horas) e onde o funil
    mais vaza em cada recorte."""
    def passo(k: int) -> F.Column:
        espera = (F.unix_seconds(f"t{k}") - F.unix_seconds(f"t{k - 1}")) / 3600 if k > 1 else F.lit(None)
        return F.struct(F.lit(k).alias("ordem"), F.lit(ETAPAS[k - 1]).alias("etapa"),
                        F.col(f"t{k}").isNotNull().alias("alcancou"), espera.cast("double").alias("horas"))

    # uma linha por pessoa × etapa (as 7, alcançadas ou não): a grade de cada recorte sai completa
    passos = (jornada_ordenada(eventos)
              .select("pessoa", "canal", "dispositivo",
                      F.explode(F.array(*[passo(k) for k in range(1, len(ETAPAS) + 1)])).alias("p"))
              .select("pessoa", "canal", "dispositivo", "p.*"))
    grade = (_com_recortes(passos).groupBy("canal", "dispositivo", "ordem", "etapa")
             .agg(F.count(F.when(F.col("alcancou"), True)).alias("pessoas"),
                  F.percentile_approx(F.when(F.col("alcancou"), F.col("horas")), 0.5)
                  .alias("mediana_horas_desde_anterior")))
    recorte = Window.partitionBy("canal", "dispositivo")
    com_perdas = (_conversoes(grade, ["canal", "dispositivo"])
                  .withColumn("perdidas", F.lag("pessoas").over(recorte.orderBy("ordem")) - F.col("pessoas")))
    maior = F.max("perdidas").over(recorte)
    return (com_perdas
            .withColumn("maior_vazamento", F.coalesce((F.col("perdidas") == maior) & (maior > 0), F.lit(False)))
            .withColumn("mediana_horas_desde_anterior", F.round("mediana_horas_desde_anterior", 2))
            .select("canal", "dispositivo", "ordem", "etapa", "pessoas", "perdidas", "conversao_etapa_anterior",
                    "conversao_topo", "mediana_horas_desde_anterior", "maior_vazamento")
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
    return {"funil_ativacao": funil_ativacao(eventos), "funil_ordenado": funil_ordenado(eventos),
            "funil_login": funil_login(eventos)}


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
