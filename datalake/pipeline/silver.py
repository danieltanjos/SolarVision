"""Job Silver (R5 a R10): bronze -> silver limpa, sem duplicatas e com colunas tipadas.

    docker compose run --rm app python pipeline/silver.py

Grava:
    silver/event_name=…/year=…/month=…/day=…   eventos válidos
"""

from pyspark.sql import DataFrame, Window
from pyspark.sql import functions as F

from comum import criar_sessao, exigir_camada, glob_eventos, gravar_eventos, ler_eventos, titulo

# Chaves de params (contrato) e o tipo de cada uma (R6). Valor que não converte vira nulo (try_cast);
# a validação decide se isso é motivo de rejeição.
PARAMS = {
    "page_title": "string",
    "percent_scrolled": "int",
    "link_url": "string", "link_domain": "string", "link_text": "string", "link_id": "string",
    "outbound": "boolean",
    "search_term": "string", "search_results": "int", "search_area": "string",
    "content_type": "string", "content_id": "string",
    "unread": "int",
    "loss_percent": "double", "recommend": "boolean",
    "file_name": "string", "file_extension": "string", "report_month": "string",
    "setting": "string",
    "group_id": "bigint", "panel_id": "bigint", "cleaning_id": "bigint",
    "has_location": "boolean", "has_tariff": "boolean",
    "potencia_wp": "double",
    "view": "string", "scope": "string",
    "rows": "bigint", "rows_ignored": "bigint", "panels_removed": "int",
    "method": "string",
    "element_id": "string",
}


def deduplicar(bronze: DataFrame) -> DataFrame:
    """Uma linha por event_id (R5). Entre as cópias, fica a primeira ingerida (e, no empate, a do
    primeiro arquivo): reprocessar a Bronze, que é append-only, também cai aqui."""
    janela = Window.partitionBy("event_id").orderBy("ingerido_em", "arquivo_origem")
    return (bronze.withColumn("_copia", F.row_number().over(janela))
            .filter(F.col("_copia") == 1).drop("_copia"))


def pagina(location) -> F.Column:
    """Caminho da URL sem domínio, '#' e '?'; a raiz vira '/' (enunciado 5.4.12)."""
    caminho = F.regexp_extract(location, r"^[a-zA-Z][a-zA-Z0-9+.-]*://[^/?#]*([^?#]*)", 1)
    return F.when(location.isNull(), None).when(caminho == "", "/").otherwise(caminho)


def tipar(eventos: DataFrame) -> DataFrame:
    """Achata page/traffic/device e extrai params para colunas tipadas (R6)."""
    colunas = [F.col("params").getItem(chave).try_cast(tipo).alias(chave) for chave, tipo in PARAMS.items()]
    return eventos.select(
        "event_id", "event_name", "event_ts", "user_pseudo_id", "user_id", "session_hint",
        F.col("page.location").alias("page_location"),
        F.col("page.referrer").alias("page_referrer"),
        pagina(F.col("page.location")).alias("pagina"),
        F.col("traffic.source").alias("traffic_source"),
        F.col("traffic.medium").alias("traffic_medium"),
        F.col("traffic.campaign").alias("traffic_campaign"),
        F.concat_ws(" / ", F.col("traffic.source"), F.col("traffic.medium")).alias("canal"),
        F.col("device.category").alias("device_category"),
        F.col("device.os").alias("device_os"),
        F.col("device.browser").alias("device_browser"),
        *colunas,
        "params", "items", "arquivo_origem", "ingerido_em",
        "year", "month", "day",
    )


def main() -> None:
    spark = criar_sessao("silver")
    exigir_camada(spark, glob_eventos("bronze"), "python pipeline/bronze.py")
    bronze = ler_eventos(spark, "bronze")
    unicos = deduplicar(bronze).cache()
    eventos = tipar(unicos)

    gravar_eventos(eventos, "silver", "overwrite")
    titulo("Silver")
    total, n_unicos = bronze.count(), unicos.count()
    print(f"bronze: {total} linhas · duplicatas descartadas: {total - n_unicos}")
    print(f"silver: {n_unicos} eventos")
    spark.stop()


if __name__ == "__main__":
    main()
