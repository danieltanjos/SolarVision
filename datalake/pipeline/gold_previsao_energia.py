"""Job Gold da previsão de energia: o modelo que corrige a estimativa física com a geração real.

    docker compose run --rm app python pipeline/gold_previsao_energia.py

A estimativa do app (potencia_estimada: clima no plano da placa × Wp × PR 0,82) erra ~15% no dia e ~6% no mês
contra a medição real (docs/validacao). O modelo não substitui essa física: aprende a razão
real ÷ estimado de cada dia (o PR de verdade, a sujeira, a degradação, o efeito da temperatura e de dias
nublados), e a previsão é estimado × razão prevista.

Grava:
    gold/energia_diaria         uma linha por placa e dia (passado e próximos dias): features, estimado,
                                real (dias completos) e o conjunto (treino, teste ou previsao)
    gold/metricas_previsao      erro de cada método no teste: física pura, física calibrada, razão recente
                                e o modelo, no dia, na semana e no mês, mais a faixa P10-P90 do modelo
    gold/importancia_features   o peso de cada feature no modelo
    modelos/previsao_energia    o modelo treinado (Spark ML), lido pelo prever_energia.py

Sem vazamento: as features de um dia só usam o clima daquele dia (que, para a semana que vem, é a previsão
do tempo) e o histórico da placa até 8 dias antes. A divisão é no tempo: o último ano medido é o teste.
"""

from __future__ import annotations

import math

from pyspark.ml import Pipeline, PipelineModel
from pyspark.ml.feature import VectorAssembler
from pyspark.ml.regression import GBTRegressor
from pyspark.sql import DataFrame, Window
from pyspark.sql import functions as F

from comum import caminho, criar_sessao, exigir_camada, titulo

MODELO = "modelos/previsao_energia"
CHUVA_QUE_LAVA_MM = 5.0             # o limiar do app (chuvas_que_lavam)
LAVAGEM_MAXIMA_DIAS = 90
JANELA_HISTORICO = (37, 8)          # razão média dos dias completos de 37 a 8 dias antes (vale para 7 dias à frente)
MINIMO_HISTORICO = 10               # dias completos na janela para a razão recente valer
DIAS_TESTE = 365
RAZAO_MAXIMA = 1.6
SEMENTE = 42
# inclinação, azimute e Wp ficam de fora: na referência da UFSC são constantes, o modelo não teria como
# aprender o efeito deles (a física já os usa no estimado)
FEATURES = ("razao_ref", "tem_historico", "irradiacao_kwh_m2", "temp_media_sol", "chuva_mm", "dias_desde_lavagem",
            "idade_dias", "doy_sin", "doy_cos")
# (profundidade, iterações, passo) do GBT; o escolhido é o de menor erro semanal na validação
GRADE = ((2, 100, 0.1), (3, 150, 0.05), (4, 80, 0.1))


def _numero_do_dia(coluna) -> F.Column:
    return F.datediff(coluna, F.lit("2000-01-01"))


def diaria(horas: DataFrame, dias: DataFrame, placas: DataFrame, limpezas: DataFrame) -> DataFrame:
    """Uma linha por placa e dia com clima: o estimado, as features e, nos dias medidos por inteiro, o real."""
    por_dia = (horas.groupBy("placa_id", "fonte", "dia")
               .agg(F.round(F.sum("estimada_wh"), 3).alias("estimada_wh"),
                    F.round(F.sum("irradiancia") / 1000, 4).alias("irradiacao_kwh_m2"),
                    F.round(F.avg(F.when(F.col("irradiancia") > 0, F.col("temperatura"))), 2).alias("temp_media_sol"),
                    F.round(F.sum("precipitacao"), 2).alias("chuva_mm"),
                    F.sum(F.col("previsao").cast("int")).alias("horas_previstas"),
                    F.count("*").alias("horas")))
    limpou = limpezas.select("placa_id", "dia").distinct().withColumn("limpeza", F.lit(True))
    base = (por_dia.join(placas.select("placa_id", "potencia_wp", "inclinacao", "azimute", "instalada_em"), "placa_id")
            .join(dias.select("placa_id", "dia", "real_wh", "completo"), ["placa_id", "dia"], "left")
            .join(limpou, ["placa_id", "dia"], "left")
            .withColumn("n", _numero_do_dia(F.col("dia"))))

    # dias desde a última lavagem (limpeza registrada ou chuva >= 5 mm), contando só os dias anteriores
    anteriores = Window.partitionBy("placa_id").orderBy("n").rowsBetween(Window.unboundedPreceding, -1)
    lavou = F.when(F.coalesce("limpeza", F.lit(False)) | (F.col("chuva_mm") >= CHUVA_QUE_LAVA_MM), F.col("n"))
    ultima = F.last(lavou, ignorenulls=True).over(anteriores)
    base = base.withColumn("dias_desde_lavagem",
                           F.least(F.coalesce(F.col("n") - ultima, F.lit(LAVAGEM_MAXIMA_DIAS)), F.lit(LAVAGEM_MAXIMA_DIAS)))

    # o alvo: a razão real ÷ estimado, só em dias completos e com sol o bastante para a razão ser estável
    valido = F.col("completo") & (F.col("estimada_wh") >= 0.5 * F.col("potencia_wp"))
    base = base.withColumn("razao", F.when(valido, F.least(F.col("real_wh") / F.col("estimada_wh"), F.lit(RAZAO_MAXIMA))))

    inicio, fim = JANELA_HISTORICO
    historico = Window.partitionBy("placa_id").orderBy("n").rangeBetween(-inicio, -fim)
    n_hist = F.count("razao").over(historico)
    return (base
            .withColumn("dias_historico", n_hist)
            .withColumn("tem_historico", (n_hist >= MINIMO_HISTORICO).cast("int"))
            .withColumn("razao_ref", F.when(n_hist >= MINIMO_HISTORICO, F.round(F.avg("razao").over(historico), 4))
                        .otherwise(F.lit(1.0)))
            .withColumn("idade_dias", F.greatest(F.lit(0), F.datediff("dia", F.coalesce("instalada_em", "dia"))))
            .withColumn("doy_sin", F.round(F.sin(2 * math.pi * F.dayofyear("dia") / 365.25), 4))
            .withColumn("doy_cos", F.round(F.cos(2 * math.pi * F.dayofyear("dia") / 365.25), 4))
            .fillna({"temp_media_sol": 20.0})
            .drop("limpeza"))


def dividir(diaria_: DataFrame) -> DataFrame:
    """treino = dias com alvo antes do último ano medido; teste = o último ano; previsao = dias de previsão do tempo.
    Com menos de dois anos medidos, o teste é o último quinto do período (o treino nunca fica vazio)."""
    limites = diaria_.filter(F.col("razao").isNotNull()).agg(F.min("n"), F.max("n")).first()
    primeiro, ultimo = (limites[0] or 0), (limites[1] or 0)
    periodo = ultimo - primeiro
    corte = ultimo - (DIAS_TESTE if periodo >= 2 * DIAS_TESTE else max(1, periodo // 5))
    return diaria_.withColumn("conjunto",
                              F.when(F.col("horas_previstas") > 0, "previsao")
                              .when(F.col("razao").isNull(), None)
                              .when(F.col("n") > corte, "teste").otherwise("treino"))


def modelo(profundidade: int = 3, iteracoes: int = 150, passo: float = 0.05) -> Pipeline:
    vetor = VectorAssembler(inputCols=list(FEATURES), outputCol="features")
    regressao = GBTRegressor(labelCol="razao", featuresCol="features", maxIter=iteracoes, maxDepth=profundidade,
                             stepSize=passo, seed=SEMENTE)
    return Pipeline(stages=[vetor, regressao])


def escolher_hiperparametros(treino: DataFrame) -> tuple[int, int, float]:
    """O último ano do treino é a validação: cada combinação da GRADE treina no resto e é medida ali, pelo
    erro na semana (o horizonte da previsão). O teste não participa da escolha."""
    ultimo = treino.agg(F.max("n")).first()[0]
    ajuste = treino.filter(F.col("n") <= ultimo - DIAS_TESTE)
    validacao = treino.filter(F.col("n") > ultimo - DIAS_TESTE)
    if ajuste.isEmpty() or validacao.isEmpty():
        return GRADE[1]
    resultado = []
    for combinacao in GRADE:
        previsto = (modelo(*combinacao).fit(ajuste).transform(validacao)
                    .withColumn("modelo", F.col("estimada_wh") * F.col("prediction")))
        resultado.append((erros(previsto, "modelo")["nmae_semana"], combinacao))
    return min(resultado)[1]


def erros(df: DataFrame, previsto: str) -> dict[str, float]:
    """nMAE no dia, na semana (blocos de 7 dias com pelo menos 5 medidos) e MAPE no mês, sobre o real."""
    d = df.withColumn("erro", F.abs(F.col("real_wh") - F.col(previsto)))
    dia = d.agg(F.sum("erro") / F.sum("real_wh")).first()[0]

    def agregado(chave):
        return (d.groupBy("placa_id", chave).agg(F.count("*").alias("dias"), F.sum("real_wh").alias("real"),
                                                F.sum(previsto).alias("prev")))
    semanas = agregado((F.col("n") / 7).cast("int").alias("semana")).filter(F.col("dias") >= 5)
    semana = semanas.agg(F.sum(F.abs(F.col("real") - F.col("prev"))) / F.sum("real")).first()[0]
    meses = agregado(F.date_format("dia", "yyyy-MM").alias("mes")).filter(F.col("dias") >= 15)
    mes = meses.agg(F.avg(F.abs(F.col("real") - F.col("prev")) / F.col("real"))).first()[0]
    return {"nmae_dia": round(dia or 0, 4), "nmae_semana": round(semana or 0, 4), "mape_mes": round(mes or 0, 4)}


def treinar_e_avaliar(diaria_: DataFrame):
    """(modelo, tabela com as previsões de cada método, métricas, importâncias)."""
    dados = dividir(diaria_).cache()
    treino = dados.filter(F.col("conjunto") == "treino")
    escolhidos = escolher_hiperparametros(treino)
    ajustado = modelo(*escolhidos).fit(treino)

    k = treino.groupBy("placa_id").agg(F.percentile_approx("razao", 0.5).alias("k"))
    k_geral = treino.agg(F.percentile_approx("razao", 0.5)).first()[0]
    teste = (ajustado.transform(dados.filter(F.col("conjunto") == "teste"))
             .join(k, "placa_id", "left").fillna({"k": k_geral})
             .withColumn("fisica", F.col("estimada_wh"))
             .withColumn("fisica_calibrada", F.col("estimada_wh") * F.col("k"))
             .withColumn("razao_recente", F.col("estimada_wh") * F.when(F.col("tem_historico") == 1, F.col("razao_ref"))
                         .otherwise(F.col("k")))
             .withColumn("modelo", F.col("estimada_wh") * F.col("prediction"))
             .cache())

    rel = teste.select(((F.col("real_wh") - F.col("modelo")) / F.col("modelo")).alias("e"))
    p10, p90 = rel.approxQuantile("e", [0.1, 0.9], 0.001)
    metodos = {"fisica": "física pura (PR 0,82)", "fisica_calibrada": "física com k calibrado no treino",
               "razao_recente": "física × razão dos dias recentes", "modelo": "modelo (GBT sobre a física)"}
    linhas = [(m, descricao, *erros(teste, m).values(), teste.count(), treino.count()) for m, descricao in metodos.items()]
    spark = dados.sparkSession
    metricas = (spark.createDataFrame(linhas, "metodo string, descricao string, nmae_dia double, nmae_semana double, "
                                              "mape_mes double, dias_teste long, dias_treino long")
                .withColumn("p10_relativo", F.when(F.col("metodo") == "modelo", F.lit(round(p10, 4))))
                .withColumn("p90_relativo", F.when(F.col("metodo") == "modelo", F.lit(round(p90, 4))))
                .withColumn("hiperparametros", F.when(F.col("metodo") == "modelo", F.lit(
                    "profundidade {}, {} iterações, passo {}".format(*escolhidos)))))
    importancias = ajustado.stages[-1].featureImportances.toArray()
    importancia = spark.createDataFrame([(f, round(float(v), 4)) for f, v in zip(FEATURES, importancias)],
                                        "feature string, importancia double").orderBy(F.desc("importancia"))
    return ajustado, dados, metricas, importancia


def main() -> None:
    spark = criar_sessao("gold_previsao_energia")
    exigir_camada(spark, "silver_energia/horas", "python pipeline/silver_energia.py")
    ler = lambda t: spark.read.parquet(caminho(f"silver_energia/{t}"))  # noqa: E731
    tabela = diaria(ler("horas"), ler("dias_medidos"), ler("placas"), ler("limpezas")).cache()
    ajustado, dados, metricas, importancia = treinar_e_avaliar(tabela)

    ajustado.write().overwrite().save(caminho(MODELO))
    dados.drop("n").write.mode("overwrite").parquet(caminho("gold/energia_diaria"))
    metricas.write.mode("overwrite").parquet(caminho("gold/metricas_previsao"))
    importancia.write.mode("overwrite").parquet(caminho("gold/importancia_features"))

    titulo("Gold · previsão de energia")
    for m in metricas.collect():
        print(f"{m.metodo:<18} nMAE dia {m.nmae_dia:.1%} · semana {m.nmae_semana:.1%} · MAPE mês {m.mape_mes:.1%}"
              f"  ({m.dias_treino} dias de treino, {m.dias_teste} de teste)")
    print("hiperparâmetros (validação):", metricas.filter("metodo = 'modelo'").first().hiperparametros)
    print("features:", ", ".join(f"{r.feature} {r.importancia:.2f}" for r in importancia.collect()))
    spark.stop()


def carregar_modelo(spark) -> PipelineModel:
    return PipelineModel.load(caminho(MODELO))


if __name__ == "__main__":
    main()
