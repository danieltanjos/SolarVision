"""Treina o mesmo modelo de déficit com Spark MLlib (GBTRegressor), para comparar com o scikit-learn.

Dados, limite de queda, avaliação e exportação: ml/comum.py, idênticos aos de ml/treinar_deficit.py; só o algoritmo
muda. Ao terminar, se o resultado do scikit-learn existir, escreve ml/COMPARACAO.md.

Roda o Spark em modo local (todos os núcleos do PC). Precisa de Java 17 ou 21 (o Spark 4 não suporta o 25).
Uso, na raiz do repositório, com o mesmo ambiente do scikit-learn:
  ml/.venv/Scripts/python -m pip install -r ml/requirements.txt
  ml/.venv/Scripts/python ml/treinar_deficit_spark.py                # treina e avalia (não mexe na migration)
  ml/.venv/Scripts/python ml/treinar_deficit_spark.py --migration    # e exporta este modelo no lugar do scikit-learn
"""

import os
import sys
import time
from pathlib import Path

import numpy as np

import comum

inicio_script = time.perf_counter()
parser = comum.parser(__doc__)
parser.add_argument("--migration", action="store_true", help="exporta a tabela modelo_deficit deste modelo")
parser.add_argument("--java-home", default=os.environ.get("SPARK_JAVA_HOME", r"C:\Program Files\Java\jdk-21"),
                    help="JDK 17 ou 21 (padrão: SPARK_JAVA_HOME ou o JDK 21 do Windows)")
args = parser.parse_args()
if Path(args.java_home).exists():
    os.environ["JAVA_HOME"] = args.java_home
os.environ["PYSPARK_PYTHON"] = sys.executable  # os workers usam o mesmo Python (3.14 do ml/.venv)

from pyspark.ml import Pipeline  # noqa: E402 (depois do JAVA_HOME)
from pyspark.ml.feature import VectorAssembler  # noqa: E402
from pyspark.ml.regression import GBTRegressor  # noqa: E402
from pyspark.sql import SparkSession  # noqa: E402

spark = (SparkSession.builder.master("local[*]").appName("solarvision-deficit")
         .config("spark.ui.enabled", "false").config("spark.driver.memory", "2g").getOrCreate())
spark.sparkContext.setLogLevel("ERROR")
inicio_spark = time.perf_counter() - inicio_script

treino, teste = comum.carregar(args)
COLUNAS = ["i", *comum.X, "razao", "ano"]


def para_spark(df):
    """pandas → Spark sem depender do pyarrow; i guarda a ordem para devolver as previsões alinhadas."""
    linhas = df.assign(i=range(len(df)))[COLUNAS].astype(float).values.tolist()
    return spark.createDataFrame(linhas, schema=COLUNAS)


def novo_pipeline():
    # perda absoluta, como no scikit-learn; profundidade 4 ≈ até 16 folhas por árvore
    return Pipeline(stages=[
        VectorAssembler(inputCols=comum.X, outputCol="features"),
        GBTRegressor(featuresCol="features", labelCol="razao", lossType="absolute", maxIter=200, stepSize=0.1,
                     maxDepth=4, minInstancesPerNode=40, maxBins=64, seed=0),
    ])


def prever(modelo, df_spark) -> np.ndarray:
    linhas = modelo.transform(df_spark).select("i", "prediction").orderBy("i").collect()
    return np.array([linha["prediction"] for linha in linhas])


treino_sp = para_spark(treino).cache()

# Limite de queda fora da amostra: cada ano previsto por um modelo treinado sem ele (como o GroupKFold).
t = time.perf_counter()
fora_da_amostra = np.empty(len(treino))
for ano in sorted(treino["ano"].unique()):
    modelo_sem_ano = novo_pipeline().fit(treino_sp.filter(treino_sp.ano != float(ano)))
    do_ano = treino_sp.filter(treino_sp.ano == float(ano))
    linhas = modelo_sem_ano.transform(do_ano).select("i", "prediction").collect()
    for linha in linhas:
        fora_da_amostra[int(linha["i"])] = linha["prediction"]
lim = comum.limiares(treino, fora_da_amostra, args.quantil)
tempos = {"validacao": time.perf_counter() - t}

t = time.perf_counter()
modelo = novo_pipeline().fit(treino_sp)
tempos["treino"] = time.perf_counter() - t

t = time.perf_counter()
previsto = prever(modelo, para_spark(teste))
tempos["previsao"] = time.perf_counter() - t

grade = comum.grade().assign(razao=0.0, ano=0.0)
razao_grade = prever(modelo, para_spark(grade))
spark.stop()

r = comum.avaliar(teste, previsto, lim)
tempos["total"] = time.perf_counter() - inicio_script
tempos["inicio_spark"] = inicio_spark
texto = comum.relatorio("Modelo de déficit energético: Spark MLlib", "`GBTRegressor` do Spark MLlib em modo local "
                        "(perda absoluta, 200 árvores de profundidade 4, taxa 0,1).", args, treino, teste, r, lim, tempos)
print(texto)
comum.salvar("spark", texto, r, lim, tempos, razao_grade)
if args.migration:
    comum.exportar(razao_grade, lim, r, "treinar_deficit_spark.py")
