"""Job Bronze de energia: landing_energia/ (JSON) -> bronze_energia/ (Parquet), append-only, com proveniência.

    docker compose run --rm app python pipeline/bronze_energia.py

Mesmas regras da Bronze de eventos (R1, R2, R4): só pelo Spark com s3a://, schema explícito por tabela,
nada é filtrado e cada linha ganha arquivo_origem e ingerido_em. A fonte (ufsc ou app) vem do caminho.
"""

from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import BooleanType, DoubleType, IntegerType, StringType, StructField, StructType, TimestampType

from comum import caminho, criar_sessao, existe, exigir_camada, titulo

LANDING, BRONZE = "landing_energia", "bronze_energia"
COMANDO_ANTES = "python gerador/importar_ufsc.py (ou coletor/coletar_energia.py)"


def campos(**tipos) -> StructType:
    return StructType([StructField(nome, tipo) for nome, tipo in tipos.items()])


SCHEMAS = {
    "placas": campos(placa_id=StringType(), potencia_wp=DoubleType(), inclinacao=DoubleType(),
                     azimute=DoubleType(), coef_temperatura=DoubleType(), instalada_em=StringType(),
                     latitude=DoubleType(), longitude=DoubleType()),
    "clima": campos(placa_id=StringType(), data_hora=TimestampType(), irradiancia=DoubleType(),
                    temperatura=DoubleType(), precipitacao=DoubleType(), previsao=BooleanType()),
    "leituras": campos(placa_id=StringType(), data_hora=TimestampType(), watts=DoubleType(),
                       intervalo_min=IntegerType()),
    "limpezas": campos(placa_id=StringType(), dia=StringType()),
}


def ler_landing(spark: SparkSession, tabela: str) -> DataFrame:
    """landing_energia/<tabela>/fonte=…/*.jsonl com o schema da tabela; a coluna fonte vem da pasta (o campo
    fonte das linhas de placa é a mesma informação e fica de fora do schema)."""
    base = caminho(f"{LANDING}/{tabela}")
    return spark.read.schema(SCHEMAS[tabela]).option("basePath", base).json(f"{base}/fonte=*")


def com_proveniencia(df: DataFrame) -> DataFrame:
    return df.withColumn("arquivo_origem", F.col("_metadata.file_path")).withColumn("ingerido_em", F.current_timestamp())


def main() -> None:
    spark = criar_sessao("bronze_energia")
    exigir_camada(spark, f"{LANDING}/*/fonte=*", COMANDO_ANTES)
    titulo("Bronze · energia")
    for tabela in SCHEMAS:
        if not existe(spark, caminho(f"{LANDING}/{tabela}/fonte=*")):
            print(f"{BRONZE}/{tabela}: nada na landing")
            continue
        df = com_proveniencia(ler_landing(spark, tabela))
        df.write.mode("append").partitionBy("fonte").parquet(caminho(f"{BRONZE}/{tabela}"))
        print(f"{BRONZE}/{tabela}: {df.count()} linhas acrescentadas")
    spark.stop()


if __name__ == "__main__":
    main()
