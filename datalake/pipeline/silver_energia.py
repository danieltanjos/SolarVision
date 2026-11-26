"""Job Silver de energia: bronze_energia/ -> silver_energia/, a geração real e a estimada hora a hora.

    docker compose run --rm app python pipeline/silver_energia.py

Grava:
    silver_energia/placas        uma linha por placa (a versão mais nova)
    silver_energia/horas         uma linha por placa e hora com clima: irradiância, temperatura, chuva, a
                                 estimativa física (a mesma fórmula do app) e a geração real medida, quando há
    silver_energia/dias_medidos  a geração real por placa e dia local, e se o dia foi medido por inteiro
    silver_energia/limpezas      uma linha por placa e dia de limpeza
    silver_energia/rejeitados    leituras inválidas, com o motivo

Deduplicação (a Bronze é append-only): a versão mais nova de cada chave; no clima, o observado vale mais que
a previsão da mesma hora. A geração real de uma hora só conta com pelo menos 45 minutos de leitura.
"""

from pyspark.sql import DataFrame, Window
from pyspark.sql import functions as F

from comum import caminho, criar_sessao, existe, exigir_camada, titulo

BRONZE, SILVER = "bronze_energia", "silver_energia"
PR = 0.82                     # o PR fixo do app (potencia_estimada, migration clima_open_meteo)
NOCT = 45.0
COBERTURA_MINIMA = 45         # minutos de leitura para a hora contar como medida
FUSO_HORAS = 3                # dia local de São Paulo = UTC - 3 (o mesmo da importação de leituras do app)

PLACA_DESCONHECIDA = "placa desconhecida"
VALOR_INVALIDO = "potência negativa ou acima de 1,2 × Wp"
NOITE_COM_GERACAO = "geração sem sol"


def mais_nova(df: DataFrame, chaves: list[str], *preferencias) -> DataFrame:
    """Uma linha por chave: a de maior preferência e, no empate, a ingerida por último."""
    ordem = Window.partitionBy(*chaves).orderBy(*preferencias, F.desc("ingerido_em"), F.desc("arquivo_origem"))
    return df.withColumn("_n", F.row_number().over(ordem)).filter(F.col("_n") == 1).drop("_n")


def potencia_estimada(wp, gama, irradiancia, temperatura) -> F.Column:
    """A potencia_estimada() do banco: max(0, Wp × G/1000 × PR × (1 + γ/100 × (T_célula − 25))),
    com T_célula = T_ar + G × (NOCT − 20)/800. Numa hora, W médios = Wh."""
    celula = temperatura + irradiancia * (NOCT - 20) / 800
    return F.greatest(F.lit(0.0), wp * irradiancia / 1000 * PR * (1 + gama / 100 * (celula - 25)))


def dia_local(instante) -> F.Column:
    return F.to_date(instante - F.expr(f"INTERVAL {FUSO_HORAS} HOURS"))


def placas(bronze: DataFrame) -> DataFrame:
    return (mais_nova(bronze, ["placa_id"])
            .select("placa_id", "fonte", "potencia_wp", "inclinacao", "azimute",
                    F.coalesce("coef_temperatura", F.lit(-0.40)).alias("coef_temperatura"),
                    F.to_date("instalada_em").alias("instalada_em"), "latitude", "longitude"))


def clima(bronze: DataFrame) -> DataFrame:
    return (mais_nova(bronze, ["placa_id", "data_hora"], F.col("previsao").asc_nulls_last())
            .select("placa_id", "data_hora", "irradiancia", "temperatura",
                    F.coalesce("precipitacao", F.lit(0.0)).alias("precipitacao"),
                    F.coalesce("previsao", F.lit(False)).alias("previsao")))


def validar_leituras(leituras: DataFrame, placas_: DataFrame) -> tuple[DataFrame, DataFrame]:
    """(válidas, rejeitadas com o motivo). Uma leitura por placa e instante (a mais nova)."""
    unicas = mais_nova(leituras, ["placa_id", "data_hora"])
    com_wp = unicas.join(placas_.select("placa_id", "potencia_wp"), "placa_id", "left")
    motivo = (F.when(F.col("potencia_wp").isNull(), F.lit(PLACA_DESCONHECIDA))
              .when((F.col("watts") < 0) | (F.col("watts") > 1.2 * F.col("potencia_wp")), F.lit(VALOR_INVALIDO)))
    marcadas = com_wp.withColumn("motivo_rejeicao", motivo)
    validas = marcadas.filter(F.col("motivo_rejeicao").isNull()).drop("motivo_rejeicao", "potencia_wp")
    rejeitadas = marcadas.filter(F.col("motivo_rejeicao").isNotNull())
    return validas, rejeitadas


def leituras_por_hora(validas: DataFrame) -> DataFrame:
    """Wh medidos por placa e hora (início da hora em UTC) e os minutos de leitura que a hora teve."""
    return (validas.withColumn("hora", F.date_trunc("hour", "data_hora"))
            .groupBy("placa_id", F.col("hora").alias("data_hora"))
            .agg(F.sum(F.col("watts") * F.col("intervalo_min") / 60).alias("medido_wh"),
                 F.sum("intervalo_min").alias("cobertura_min")))


def horas(clima_: DataFrame, placas_: DataFrame, medidas: DataFrame) -> tuple[DataFrame, DataFrame]:
    """(horas, rejeitadas): o clima de cada hora com a estimativa física e a geração real (nula se a hora não
    foi medida o bastante). Hora sem sol e com geração acima de 5% do Wp é medição errada: sai com o motivo."""
    base = (clima_.join(placas_.select("placa_id", "fonte", "potencia_wp", "coef_temperatura"), "placa_id")
            .join(medidas, ["placa_id", "data_hora"], "left")
            .withColumn("estimada_wh", F.round(potencia_estimada(F.col("potencia_wp"), F.col("coef_temperatura"),
                                                                 F.col("irradiancia"), F.col("temperatura")), 3))
            .withColumn("dia", dia_local(F.col("data_hora"))))
    noite = (F.col("irradiancia") <= 0) & (F.col("medido_wh") > 0.05 * F.col("potencia_wp"))
    rejeitadas = (base.filter(noite)
                  .select("placa_id", "data_hora", F.col("medido_wh").alias("watts"), F.lit(None).cast("int").alias("intervalo_min"),
                          "fonte", F.lit(NOITE_COM_GERACAO).alias("motivo_rejeicao")))
    medida = F.when(~noite & (F.col("cobertura_min") >= COBERTURA_MINIMA), F.round("medido_wh", 3))
    return (base.withColumn("real_wh", medida)
            .select("placa_id", "fonte", "data_hora", "dia", "irradiancia", "temperatura", "precipitacao", "previsao",
                    "estimada_wh", "real_wh", "cobertura_min")), rejeitadas


def dias_medidos(validas: DataFrame) -> DataFrame:
    """Wh medidos por placa e dia local. O datalogger só grava quando há geração, então o dia é completo
    (o critério da validação do modelo, docs/validacao) se a medição começa até as 9h, vai além das 16h e
    não tem buraco maior que 15 min (ou 1,5 intervalo, para leituras de hora em hora)."""
    local = F.col("data_hora") - F.expr(f"INTERVAL {FUSO_HORAS} HOURS")
    minuto = F.hour(local) * 60 + F.minute(local)
    ordem = Window.partitionBy("placa_id", "dia").orderBy("data_hora")
    com_lacuna = (validas.withColumn("dia", F.to_date(local)).withColumn("minuto", minuto)
                  .withColumn("lacuna", F.col("minuto") - F.lag("minuto").over(ordem)))
    return (com_lacuna.groupBy("placa_id", "dia")
            .agg(F.round(F.sum(F.col("watts") * F.col("intervalo_min") / 60), 3).alias("real_wh"),
                 F.min("minuto").alias("primeiro_minuto"), F.max("minuto").alias("ultimo_minuto"),
                 F.coalesce(F.max("lacuna"), F.lit(0)).alias("maior_lacuna_min"),
                 F.max("intervalo_min").alias("intervalo_min"))
            .withColumn("completo", (F.col("primeiro_minuto") <= 9 * 60) & (F.col("ultimo_minuto") >= 16 * 60)
                        & (F.col("maior_lacuna_min") <= F.greatest(F.lit(15), F.col("intervalo_min") * 1.5)))
            .drop("intervalo_min"))


def limpezas(bronze: DataFrame) -> DataFrame:
    return bronze.select("placa_id", F.to_date("dia").alias("dia")).dropna().distinct()


def main() -> None:
    spark = criar_sessao("silver_energia")
    exigir_camada(spark, f"{BRONZE}/clima", "python pipeline/bronze_energia.py")
    ler = lambda t: spark.read.parquet(caminho(f"{BRONZE}/{t}"))  # noqa: E731
    placas_ = placas(ler("placas")).cache()
    validas, rejeitadas = validar_leituras(ler("leituras"), placas_)
    tabela, noturnas = horas(clima(ler("clima")), placas_, leituras_por_hora(validas))
    tabela = tabela.cache()

    placas_.write.mode("overwrite").parquet(caminho(f"{SILVER}/placas"))
    tabela.write.mode("overwrite").parquet(caminho(f"{SILVER}/horas"))
    dias = dias_medidos(validas).cache()
    dias.write.mode("overwrite").parquet(caminho(f"{SILVER}/dias_medidos"))
    (rejeitadas.select("placa_id", "data_hora", "watts", "intervalo_min", "fonte", "motivo_rejeicao")
     .unionByName(noturnas).write.mode("overwrite").parquet(caminho(f"{SILVER}/rejeitados")))
    # a UFSC não tem registro de limpeza: sem a pasta na Bronze, a Silver grava a tabela vazia
    tabela_limpezas = (limpezas(ler("limpezas")) if existe(spark, caminho(f"{BRONZE}/limpezas"))
                       else spark.createDataFrame([], "placa_id string, dia date"))
    tabela_limpezas.write.mode("overwrite").parquet(caminho(f"{SILVER}/limpezas"))

    titulo("Silver · energia")
    medidas = tabela.filter(F.col("real_wh").isNotNull())
    print(f"{SILVER}/placas: {placas_.count()} · horas com clima: {tabela.count()} · horas medidas: {medidas.count()}")
    print(f"{SILVER}/dias_medidos: {dias.count()} dias, {dias.filter('completo').count()} completos")
    print(f"{SILVER}/rejeitados: {rejeitadas.count() + noturnas.count()}")
    spark.stop()


if __name__ == "__main__":
    main()
