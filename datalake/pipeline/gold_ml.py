"""Job Gold de ML (enunciado 5.3): propensão de ativação por sessão e segmentos de usuários.

    docker compose run --rm app python pipeline/gold_ml.py

Grava gold/propensao_ativacao, gold/metricas_modelo e gold/segmentos_usuarios.

Propensão: uma linha por sessão; rótulo = a sessão tem create_panel. As features só olham a sessão
ANTES do primeiro evento de cadastro (create_group ou create_panel): o cadastro em si já entrega a
resposta (vazamento de informação). A divisão treino/teste é por pessoa (5.4.9).
"""

from pyspark.ml import Pipeline
from pyspark.ml.classification import LogisticRegression
from pyspark.ml.clustering import KMeans
from pyspark.ml.evaluation import BinaryClassificationEvaluator, ClusteringEvaluator
from pyspark.ml.feature import OneHotEncoder, StandardScaler, StringIndexer, VectorAssembler
from pyspark.ml.functions import vector_to_array
from pyspark.sql import DataFrame, Window
from pyspark.sql import functions as F

from comum import caminho, criar_sessao, exigir_camada, glob_eventos, ler_eventos, titulo

CADASTRO = ("create_group", "create_panel")
NUMERICAS = (
    "eventos_antes", "telas_distintas", "scroll_maximo", "cliques", "buscas", "buscas_sem_resultado",
    "viu_cadastro", "viu_monitoramento", "abriu_alertas", "criou_conta_na_sessao", "segundos_antes",
    "sessoes_anteriores", "ja_ativou_antes",
)
CATEGORICAS = ("canal", "dispositivo")
FEATURES = NUMERICAS + CATEGORICAS
LIMIAR = 0.5
SEMENTE = 42

PERFIL = ("sessoes", "dias_ativos", "telas_distintas", "monitoramentos", "relatorios",
          "importacoes", "limpezas", "alertas", "buscas", "placas_criadas")
K_CANDIDATOS = range(2, 7)


# ---------------------------------------------------------------- propensão

def base_propensao(eventos: DataFrame) -> DataFrame:
    """Uma linha por sessão: as features (só de antes do cadastro), o rótulo e o conjunto (treino/teste)."""
    corte = (eventos.filter(F.col("event_name").isin(*CADASTRO))
             .groupBy("sessao_id").agg(F.min("event_ts").alias("corte")))
    rotulo = (eventos.groupBy("sessao_id")
              .agg(F.max((F.col("event_name") == "create_panel").cast("int")).alias("rotulo")))
    antes = (eventos.join(corte, "sessao_id", "left")
             .filter(F.col("corte").isNull() | (F.col("event_ts") < F.col("corte"))))

    def tem(condicao):
        return F.max(condicao.cast("int"))

    pv = F.col("event_name") == "page_view"
    features = (antes.groupBy("sessao_id")
                .agg(F.first("pessoa").alias("pessoa"),
                     F.min("sessao_inicio").alias("sessao_inicio"),
                     F.count("*").alias("eventos_antes"),
                     F.countDistinct(F.when(pv, F.col("pagina"))).alias("telas_distintas"),
                     F.coalesce(F.max("percent_scrolled"), F.lit(0)).alias("scroll_maximo"),
                     F.sum((F.col("event_name") == "click").cast("int")).alias("cliques"),
                     F.sum((F.col("event_name") == "site_search").cast("int")).alias("buscas"),
                     F.sum(((F.col("event_name") == "site_search") & (F.col("search_results") == 0)).cast("int"))
                     .alias("buscas_sem_resultado"),
                     tem(pv & (F.col("pagina") == "/app/cadastro")).alias("viu_cadastro"),
                     tem(pv & (F.col("pagina") == "/app/monitoramento")).alias("viu_monitoramento"),
                     tem(F.col("event_name") == "view_alerts").alias("abriu_alertas"),
                     tem(F.col("event_name") == "sign_up").alias("criou_conta_na_sessao"),
                     (F.unix_seconds(F.max("event_ts")) - F.unix_seconds(F.min("event_ts"))).alias("segundos_antes"),
                     F.first("canal_sessao").alias("canal"),
                     F.first("dispositivo_sessao").alias("dispositivo")))
    # histórico da pessoa (passado: pode): sessões anteriores e se já tinha ativado antes desta
    sessoes = eventos.groupBy("pessoa", "sessao_id").agg(
        F.min("sessao_inicio").alias("inicio"), F.max((F.col("event_name") == "create_panel").cast("int")).alias("ativou"))
    anteriores = Window.partitionBy("pessoa").orderBy("inicio", "sessao_id").rowsBetween(Window.unboundedPreceding, -1)
    historico = (sessoes.withColumn("sessoes_anteriores", F.count("*").over(anteriores))
                 .withColumn("ja_ativou_antes", F.coalesce(F.max("ativou").over(anteriores), F.lit(0)))
                 .select("sessao_id", "sessoes_anteriores", "ja_ativou_antes"))
    return (features.join(rotulo, "sessao_id").join(historico, "sessao_id")
            .withColumn("conjunto", F.when(F.abs(F.hash("pessoa")) % 5 == 0, "teste").otherwise("treino")))


def modelo_propensao() -> Pipeline:
    """Regressão logística com as categóricas em one-hot e peso maior para a classe rara (ativou)."""
    indices = [StringIndexer(inputCol=c, outputCol=f"{c}_idx", handleInvalid="keep") for c in CATEGORICAS]
    onehot = OneHotEncoder(inputCols=[f"{c}_idx" for c in CATEGORICAS], outputCols=[f"{c}_vec" for c in CATEGORICAS])
    vetor = VectorAssembler(inputCols=list(NUMERICAS) + [f"{c}_vec" for c in CATEGORICAS], outputCol="features")
    regressao = LogisticRegression(labelCol="rotulo", weightCol="peso", maxIter=100, regParam=0.01)
    return Pipeline(stages=[*indices, onehot, vetor, regressao])


def _com_peso(df: DataFrame) -> DataFrame:
    positivos = df.agg(F.avg("rotulo")).first()[0] or 0.5
    return df.withColumn("peso", F.when(F.col("rotulo") == 1, 1 - positivos).otherwise(positivos))


def propensao(eventos: DataFrame) -> tuple[DataFrame, DataFrame]:
    """Treina no conjunto de treino e devolve (propensao_ativacao, metricas_modelo)."""
    base = base_propensao(eventos).fillna(0, subset=list(NUMERICAS)).cache()
    treino = _com_peso(base.filter(F.col("conjunto") == "treino"))
    ajustado = modelo_propensao().fit(treino)
    previsto = (ajustado.transform(base)
                .withColumn("probabilidade", F.round(vector_to_array("probability")[1], 4))
                .withColumn("previsto", (F.col("probabilidade") >= LIMIAR).cast("int"))).cache()

    teste = previsto.filter(F.col("conjunto") == "teste")
    auc = BinaryClassificationEvaluator(labelCol="rotulo", rawPredictionCol="rawPrediction").evaluate(teste)
    m = teste.agg(F.sum(((F.col("previsto") == 1) & (F.col("rotulo") == 1)).cast("int")).alias("vp"),
                  F.sum(((F.col("previsto") == 1) & (F.col("rotulo") == 0)).cast("int")).alias("fp"),
                  F.sum(((F.col("previsto") == 0) & (F.col("rotulo") == 1)).cast("int")).alias("fn"),
                  F.count("*").alias("n")).first()
    vp, fp, fn = m.vp or 0, m.fp or 0, m.fn or 0
    precisao = vp / (vp + fp) if vp + fp else 0.0
    recall = vp / (vp + fn) if vp + fn else 0.0
    f1 = 2 * precisao * recall / (precisao + recall) if precisao + recall else 0.0
    spark = eventos.sparkSession
    metricas = spark.createDataFrame(
        [("regressao_logistica", round(auc, 4), round(f1, 4), round(precisao, 4), round(recall, 4), LIMIAR,
          treino.count(), m.n, vp + fn, list(FEATURES))],
        "modelo string, auc double, f1 double, precisao double, recall double, limiar double, "
        "sessoes_treino long, sessoes_teste long, positivos_teste long, features array<string>")
    tabela = previsto.select("sessao_id", "pessoa", "sessao_inicio", "conjunto", "rotulo", "probabilidade",
                             "previsto", "canal", "dispositivo")
    return tabela, metricas


# ---------------------------------------------------------------- segmentos

def perfil_de_uso(eventos: DataFrame) -> DataFrame:
    """Uma linha por pessoa com o quanto ela usa cada parte da plataforma."""
    def conta(nome):
        return F.sum((F.col("event_name") == nome).cast("int"))

    return (eventos.groupBy("pessoa")
            .agg(F.countDistinct("sessao_id").alias("sessoes"),
                 F.countDistinct(F.to_date("event_ts")).alias("dias_ativos"),
                 F.countDistinct(F.when(F.col("event_name") == "page_view", F.col("pagina"))).alias("telas_distintas"),
                 conta("view_monitoring").alias("monitoramentos"),
                 conta("generate_report").alias("relatorios"),
                 conta("import_readings").alias("importacoes"),
                 conta("register_cleaning").alias("limpezas"),
                 conta("view_alerts").alias("alertas"),
                 conta("site_search").alias("buscas"),
                 conta("create_panel").alias("placas_criadas")))


def segmentos(eventos: DataFrame) -> DataFrame:
    """K-Means sobre o perfil padronizado; o K é o de maior silhueta entre 2 e 6."""
    perfil = perfil_de_uso(eventos).cache()
    vetor = VectorAssembler(inputCols=list(PERFIL), outputCol="bruto").transform(perfil)
    escalado = StandardScaler(inputCol="bruto", outputCol="features").fit(vetor).transform(vetor).cache()
    n = escalado.count()
    avaliador = ClusteringEvaluator(featuresCol="features", predictionCol="segmento")
    melhor = None
    for k in K_CANDIDATOS:
        if k >= n:
            break
        agrupado = KMeans(k=k, seed=SEMENTE, featuresCol="features", predictionCol="segmento").fit(escalado).transform(escalado)
        silhueta = avaliador.evaluate(agrupado)
        if melhor is None or silhueta > melhor[0]:
            melhor = (silhueta, k, agrupado)
    silhueta, k, agrupado = melhor
    grupo = Window.partitionBy("segmento")
    com_perfil = agrupado.select("pessoa", "segmento", *PERFIL)
    for c in PERFIL:
        com_perfil = com_perfil.withColumn(f"media_{c}", F.round(F.avg(c).over(grupo), 2))
    return (com_perfil.withColumn("pessoas_no_segmento", F.count("*").over(grupo))
            .withColumn("k", F.lit(k)).withColumn("silhueta", F.lit(round(silhueta, 4))))


def calcular(eventos: DataFrame) -> dict[str, DataFrame]:
    tabela, metricas = propensao(eventos)
    return {"propensao_ativacao": tabela, "metricas_modelo": metricas, "segmentos_usuarios": segmentos(eventos)}


def main() -> None:
    spark = criar_sessao("gold_ml")
    exigir_camada(spark, glob_eventos("silver"), "python pipeline/silver.py")
    eventos = ler_eventos(spark, "silver").cache()
    titulo("Gold · ML")
    tabelas = calcular(eventos)
    for nome, tabela in tabelas.items():
        tabela.write.mode("overwrite").parquet(caminho(f"gold/{nome}"))
        print(f"gold/{nome}: {tabela.count()} linhas")
    m = tabelas["metricas_modelo"].first()
    print(f"propensão: AUC {m.auc} · F1 {m.f1} · precisão {m.precisao} · recall {m.recall}")
    s = tabelas["segmentos_usuarios"].select("k", "silhueta").first()
    print(f"segmentos: K = {s.k} · silhueta {s.silhueta}")
    spark.stop()


if __name__ == "__main__":
    main()
