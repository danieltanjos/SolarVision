"""Job Silver (R5 a R10): bronze -> silver limpa, sem duplicatas, tipada, com sessões e identidades.

    docker compose run --rm app python pipeline/silver.py

Grava:
    silver/event_name=…/year=…/month=…/day=…   eventos válidos
    silver/eventos_rejeitados/                 eventos inválidos, com o motivo (R7)
    silver/itens/year=…/month=…/day=…          uma linha por placa por evento (R10)
"""

from pyspark.sql import DataFrame, Window
from pyspark.sql import functions as F

from comum import caminho, criar_sessao, exigir_camada, glob_eventos, gravar_eventos, ler_eventos, titulo

# Os 20 eventos do contrato (docs/CONTRATO_EVENTO.md). O pipeline não importa o gerador:
# os dois só compartilham o contrato.
CATALOGO = (
    "page_view", "scroll", "click", "site_search", "select_content",
    "view_alerts", "view_cleaning_recommendation", "file_download", "change_settings",
    "create_group", "create_panel", "view_monitoring", "import_readings",
    "register_cleaning", "generate_report", "delete_panel", "delete_group",
    "sign_up", "login", "logout",
)
# o id que cada ação precisa ter (regra "ação sem id")
ACOES_DE_GRUPO = ("create_group", "delete_group")
ACOES_DE_PLACA = ("create_panel", "import_readings", "register_cleaning", "delete_panel")
MARCOS_SCROLL = (25, 50, 75, 90)
PAUSA_MAXIMA = 30 * 60          # segundos sem evento que abrem uma sessão nova (R8)

FORA_DO_CATALOGO = "evento fora do catálogo"
TIMESTAMP_INVALIDO = "timestamp ausente ou futuro"
ACAO_SEM_ID = "ação sem id"
VALOR_INVALIDO = "valor numérico inválido"
MARCO_FORA = "marco fora do padrão"
EXCLUSAO_ORFA = "exclusão órfã"

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


def motivo(e) -> F.Column:
    """O primeiro motivo de rejeição de cada evento (as cinco regras que olham só a linha), ou nulo."""
    nome = e.event_name
    return (
        F.when(nome.isNull() | ~nome.isin(*CATALOGO), F.lit(FORA_DO_CATALOGO))
        .when(e.event_ts.isNull() | (e.event_ts > e.ingerido_em), F.lit(TIMESTAMP_INVALIDO))
        .when((nome.isin(*ACOES_DE_GRUPO) & e.group_id.isNull())
              | (nome.isin(*ACOES_DE_PLACA) & e.panel_id.isNull()), F.lit(ACAO_SEM_ID))
        .when(((nome == "import_readings")
               & (e.rows.isNull() | (e.rows < 0) | (F.coalesce(e.rows_ignored, F.lit(0)) < 0)))
              | ((nome == "create_panel") & (e.potencia_wp.isNull() | (e.potencia_wp <= 0))), F.lit(VALOR_INVALIDO))
        .when((nome == "scroll") & (e.percent_scrolled.isNull() | ~e.percent_scrolled.isin(*MARCOS_SCROLL)),
              F.lit(MARCO_FORA))
    )


def _orfas(eventos: DataFrame, exclusao: str, criacao: str, chave: str) -> DataFrame:
    """event_id das exclusões cujo id não aparece em nenhuma criação válida."""
    criados = eventos.filter(F.col("event_name") == criacao).select(chave).distinct()
    return (eventos.filter(F.col("event_name") == exclusao)
            .join(F.broadcast(criados), chave, "left_anti").select("event_id"))


def validar(eventos: DataFrame) -> tuple[DataFrame, DataFrame]:
    """Separa (válidos, rejeitados) (R7). Os rejeitados ganham `motivo_rejeicao`, um por linha.

    A exclusão órfã olha as criações que passaram nas outras regras: uma placa cujo create_panel
    foi rejeitado deixa a exclusão dela sem cadastro válido (efeito em cascata)."""
    marcados = eventos.withColumn("motivo_rejeicao", motivo(eventos)).cache()
    candidatos = marcados.filter(F.col("motivo_rejeicao").isNull())
    orfas = (_orfas(candidatos, "delete_panel", "create_panel", "panel_id")
             .unionByName(_orfas(candidatos, "delete_group", "create_group", "group_id"))
             .withColumn("_orfa", F.lit(True)))
    com_orfas = (marcados.join(orfas, "event_id", "left")
                 .withColumn("motivo_rejeicao", F.coalesce("motivo_rejeicao",
                                                           F.when(F.col("_orfa"), F.lit(EXCLUSAO_ORFA))))
                 .drop("_orfa"))
    validos = com_orfas.filter(F.col("motivo_rejeicao").isNull()).drop("motivo_rejeicao")
    rejeitados = com_orfas.filter(F.col("motivo_rejeicao").isNotNull())
    return validos, rejeitados


def costurar_identidade(eventos: DataFrame) -> DataFrame:
    """Identity stitching (R9): todo evento de um user_pseudo_id que em algum momento teve user_id
    recebe esse user_id (o primeiro que apareceu), inclusive os eventos anteriores ao login.
    `pessoa` é o user_id resolvido ou, sem ele, o próprio user_pseudo_id (enunciado 5.4.2)."""
    navegador = (Window.partitionBy("user_pseudo_id").orderBy("event_ts", "event_id")
                 .rowsBetween(Window.unboundedPreceding, Window.unboundedFollowing))
    return (eventos
            .withColumn("user_id_resolvido",
                        F.coalesce("user_id", F.first("user_id", ignorenulls=True).over(navegador)))
            .withColumn("pessoa", F.coalesce("user_id_resolvido", "user_pseudo_id")))


def sessionizar(eventos: DataFrame) -> DataFrame:
    """Sessões próprias (R8): nova sessão quando o mesmo user_pseudo_id fica mais de 30 min sem evento.
    session_hint não é usado. Canal e dispositivo da sessão são os do primeiro evento (5.4.3)."""
    ordem = Window.partitionBy("user_pseudo_id").orderBy("event_ts", "event_id")
    anterior = F.lag("event_ts").over(ordem)
    nova = anterior.isNull() | ((F.unix_seconds("event_ts") - F.unix_seconds(anterior)) > PAUSA_MAXIMA)
    numerado = (eventos.withColumn("_nova", nova.cast("int"))
                .withColumn("_n", F.sum("_nova").over(ordem.rowsBetween(Window.unboundedPreceding, 0))))
    com_id = numerado.withColumn("sessao_id", F.concat_ws("#", "user_pseudo_id", F.col("_n").cast("string")))
    sessao = (Window.partitionBy("sessao_id").orderBy("event_ts", "event_id")
              .rowsBetween(Window.unboundedPreceding, Window.unboundedFollowing))
    return (com_id
            .withColumn("sessao_inicio", F.first("event_ts").over(sessao))
            .withColumn("canal_sessao", F.first("canal").over(sessao))
            .withColumn("dispositivo_sessao", F.first("device_category").over(sessao))
            .drop("_nova", "_n"))


def explodir_itens(eventos: DataFrame) -> DataFrame:
    """Uma linha por placa por evento (R10)."""
    return (eventos.select("event_id", "event_name", "event_ts", "sessao_id", "pessoa", "pagina",
                           "year", "month", "day", F.explode("items").alias("item"))
            .select("event_id", "event_name", "event_ts", "sessao_id", "pessoa", "pagina",
                    F.col("item.item_id").alias("item_id"),
                    F.col("item.item_category").alias("item_category"),
                    F.col("item.potencia_wp").alias("potencia_wp"),
                    F.col("item.quantity").alias("quantity"),
                    "year", "month", "day"))


def main() -> None:
    spark = criar_sessao("silver")
    exigir_camada(spark, glob_eventos("bronze"), "python pipeline/bronze.py")
    bronze = ler_eventos(spark, "bronze")
    unicos = deduplicar(bronze).cache()
    validos, rejeitados = validar(tipar(unicos))
    eventos = sessionizar(costurar_identidade(validos)).cache()

    gravar_eventos(eventos, "silver", "overwrite")
    rejeitados.write.mode("overwrite").parquet(caminho("silver/eventos_rejeitados"))
    (explodir_itens(eventos).write.mode("overwrite").option("partitionOverwriteMode", "dynamic")
     .partitionBy("year", "month", "day").parquet(caminho("silver/itens")))

    titulo("Silver")
    total, n_unicos = bronze.count(), unicos.count()
    print(f"bronze: {total} linhas · duplicatas descartadas: {total - n_unicos}")
    print(f"silver: {eventos.count()} eventos válidos em "
          f"{eventos.select('sessao_id').distinct().count()} sessões de "
          f"{eventos.select('pessoa').distinct().count()} pessoas")
    print("rejeitados por motivo:")
    for linha in rejeitados.groupBy("motivo_rejeicao").count().orderBy(F.desc("count")).collect():
        print(f"  {linha.motivo_rejeicao:<30}{linha['count']:>8}")
    spark.stop()


if __name__ == "__main__":
    main()
