"""Job Bronze (R1, R2, R4): landing JSON -> bronze Parquet, append-only, com proveniência.

    docker compose run --rm app python pipeline/bronze.py
"""

from pyspark.sql import functions as F
from pyspark.sql.types import (ArrayType, DoubleType, LongType, MapType, StringType,
                               StructField, StructType, TimestampType)

from comum import criar_sessao, exigir_camada, glob_eventos, gravar_eventos, ler_eventos, titulo


def texto(*nomes):
    return StructType([StructField(n, StringType()) for n in nomes])


# Schema explícito do contrato. params fica map<string,string>: as chaves variam por evento
# e o Spark guarda número/booleano como texto; a Silver tipa (R6).
SCHEMA = StructType([
    StructField("event_id", StringType()),
    StructField("event_name", StringType()),
    StructField("event_ts", TimestampType()),
    StructField("user_pseudo_id", StringType()),
    StructField("user_id", StringType()),
    StructField("session_hint", StringType()),
    StructField("page", texto("location", "referrer")),
    StructField("traffic", texto("source", "medium", "campaign")),
    StructField("device", texto("category", "os", "browser")),
    StructField("params", MapType(StringType(), StringType())),
    StructField("items", ArrayType(StructType([
        StructField("item_id", StringType()),
        StructField("item_name", StringType()),
        StructField("item_category", StringType()),
        StructField("price", DoubleType()),
        StructField("quantity", LongType()),
    ]))),
])

spark = criar_sessao("bronze")
exigir_camada(spark, glob_eventos("landing"), "python gerador/gerar_eventos.py")

# event_name, year, month e day já vêm do caminho da landing (dia de coleta)
bronze = (ler_eventos(spark, "landing", "json", schema=SCHEMA)
          .withColumn("arquivo_origem", F.col("_metadata.file_path"))
          .withColumn("ingerido_em", F.current_timestamp()))

gravar_eventos(bronze, "bronze", "append")
titulo("Bronze")
print(f"{bronze.count()} eventos gravados em bronze/")
spark.stop()
