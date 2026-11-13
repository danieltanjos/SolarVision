import sys
from pathlib import Path

import pytest
from pyspark.sql import SparkSession

# os jobs do aluno rodam como `python pipeline/<job>.py` e importam `comum` da própria pasta
PIPELINE = Path(__file__).resolve().parents[2] / "pipeline"
if str(PIPELINE) not in sys.path:
    sys.path.insert(0, str(PIPELINE))


@pytest.fixture(scope="session")
def spark():
    sessao = (
        SparkSession.builder
        .master("local[2]")
        .appName("testes-comum")
        .config("spark.ui.enabled", "false")
        .config("spark.sql.shuffle.partitions", "2")
        # a mesma sessão serve 300+ testes: com o padrão (1 GB) o driver ficava sem memória para o broadcast
        .config("spark.driver.memory", "2g")
        .config("spark.sql.session.timeZone", "UTC")                 # como a sessão dos jobs (comum.py)
        .config("spark.sql.sources.partitionColumnTypeInference.enabled", "false")
        .getOrCreate()
    )
    sessao.sparkContext.setLogLevel("ERROR")
    yield sessao
    sessao.stop()


@pytest.fixture(autouse=True, scope="module")
def _limpar_cache(spark):
    """Cada arquivo de teste começa sem os DataFrames que o anterior deixou em cache (.cache() dos jobs)."""
    yield
    spark.catalog.clearCache()
