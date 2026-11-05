"""Job Gold de receita (a assinatura Pro): quanto entrou de fato e qual canal traz quem paga e fica.

    docker compose run --rm app python pipeline/gold_receita.py

Grava gold/receita_diaria, gold/taxa_reembolso, gold/adesao_plano_anual, gold/cadastro_para_compra
e gold/funil_assinatura. As definições seguem as do projeto-modelo (enunciado 5.4), trocando o
curso pela assinatura:
    receita bruta      soma de value dos purchase válidos (já com o desconto do Pix)
    reembolsada        soma de value dos refund válidos, atribuída à compra pelo transaction_id
    líquida            bruta − reembolsada; ticket médio = bruta ÷ pedidos
    plano da compra    o item de categoria "plano" do purchase
    canal da compra    o canal da sessão em que ela aconteceu (5.4.3)
"""

from pyspark.sql import DataFrame, Window
from pyspark.sql import functions as F

from comum import caminho, criar_sessao, exigir_camada, glob_eventos, ler_eventos, titulo
from gold_funil import TODOS, _conversoes, primeiro_cadastro

PLANO_ANUAL = "pro_anual"
SEM_PLANO = "(nenhum)"
# etapas do funil da assinatura, por sessão e em qualquer momento (5.4.4)
ETAPAS = ("viu_planos", "begin_checkout", "purchase")


def _reais(coluna) -> F.Column:
    return F.round(coluna, 2)


def com_todos(df: DataFrame, chaves: list[str], *agregados: F.Column) -> DataFrame:
    """Agrega por todas as combinações das chaves (cube): cada recorte e os subtotais, em que a chave
    agregada vira "(todos)". Ex.: chaves plano e canal dão plano × canal, cada plano, cada canal e o total."""
    marcas = [F.grouping(c).alias(f"_g_{c}") for c in chaves]
    agregado = df.cube(*chaves).agg(*agregados, *marcas)
    rotulos = [F.when(F.col(f"_g_{c}") == 1, F.lit(TODOS)).otherwise(F.col(c)).alias(c) for c in chaves]
    return agregado.select(*rotulos, *[c for c in agregado.columns if c not in chaves and not c.startswith("_g_")])


def _na_etapa(etapa: str) -> F.Column:
    """O evento conta para a etapa? viu_planos é o page_view da tela de planos; as outras, o próprio evento."""
    if etapa == "viu_planos":
        return (F.col("event_name") == "page_view") & (F.col("pagina") == "/app/planos")
    return F.col("event_name") == etapa


def compras(eventos: DataFrame) -> DataFrame:
    """Uma linha por transação (o primeiro purchase válido dela) com o plano, o canal e a data (UTC)
    da compra, o valor pago e quanto dele foi reembolsado."""
    planos = F.filter("items", lambda i: i.item_category == "plano")
    ordem = Window.partitionBy("transaction_id").orderBy("event_ts", "event_id")
    pedidos = (eventos.filter(F.col("event_name") == "purchase")
               .withColumn("_n", F.row_number().over(ordem)).filter(F.col("_n") == 1)
               .select("transaction_id", "pessoa", F.col("event_ts").alias("comprado_em"),
                       F.to_date("event_ts").alias("data"),
                       F.coalesce(F.try_element_at(planos, F.lit(1)).item_id, F.lit(SEM_PLANO)).alias("plano"),
                       F.col("canal_sessao").alias("canal"), F.col("value").alias("valor"),
                       F.col("payment_type").alias("pagamento")))
    reembolsos = (eventos.filter(F.col("event_name") == "refund")
                  .groupBy("transaction_id").agg(F.sum("value").alias("reembolsado")))
    return (pedidos.join(reembolsos, "transaction_id", "left")
            .withColumn("reembolsado", F.coalesce("reembolsado", F.lit(0.0))))


def receita_diaria(compras: DataFrame) -> DataFrame:
    """Por data da compra, plano e canal: receita bruta, reembolsada e líquida, pedidos e ticket médio."""
    return (compras.groupBy("data", "plano", "canal")
            .agg(_reais(F.sum("valor")).alias("receita_bruta"), _reais(F.sum("reembolsado")).alias("receita_reembolsada"),
                 F.count("*").alias("pedidos"))
            .withColumn("receita_liquida", _reais(F.col("receita_bruta") - F.col("receita_reembolsada")))
            .withColumn("ticket_medio", _reais(F.col("receita_bruta") / F.col("pedidos")))
            .select("data", "plano", "canal", "pedidos", "receita_bruta", "receita_reembolsada", "receita_liquida",
                    "ticket_medio")
            .orderBy("data", "plano", "canal"))


def taxa_reembolso(compras: DataFrame) -> DataFrame:
    """Pedidos com reembolso ÷ pedidos, por plano × canal, por plano, por canal e no total (5.4.7)."""
    return (com_todos(compras, ["plano", "canal"],
                      F.count("*").alias("pedidos"),
                      F.sum((F.col("reembolsado") > 0).cast("int")).alias("pedidos_reembolsados"),
                      _reais(F.sum("valor")).alias("receita_bruta"),
                      _reais(F.sum(F.col("valor") - F.col("reembolsado"))).alias("receita_liquida"))
            .withColumn("taxa_reembolso", F.round(F.col("pedidos_reembolsados") / F.col("pedidos"), 4))
            .orderBy(F.col("plano") != TODOS, "plano", F.col("canal") != TODOS, F.desc("pedidos")))


def adesao_plano_anual(compras: DataFrame) -> DataFrame:
    """Que fração dos pedidos é do plano anual (o "order bump" da assinatura) e quantos pagaram no Pix,
    por canal e no total."""
    return (com_todos(compras, ["canal"],
                      F.count("*").alias("pedidos"),
                      F.sum((F.col("plano") == PLANO_ANUAL).cast("int")).alias("pedidos_anuais"),
                      F.sum((F.col("pagamento") == "pix").cast("int")).alias("pedidos_pix"))
            .withColumn("taxa_adesao_anual", F.round(F.col("pedidos_anuais") / F.col("pedidos"), 4))
            .withColumn("taxa_pix", F.round(F.col("pedidos_pix") / F.col("pedidos"), 4))
            .orderBy(F.col("canal") != TODOS, F.desc("pedidos")))


def cadastro_para_compra(eventos: DataFrame, compras: DataFrame) -> DataFrame:
    """Pessoas com sign_up, quantas compraram depois e a mediana de dias entre o sign_up e a primeira
    compra estritamente depois dele; por canal do cadastro e no total (5.4.5 e 5.4.9)."""
    novos = primeiro_cadastro(eventos)
    primeira = (novos.join(compras.select("pessoa", "comprado_em"), "pessoa")
                .filter(F.col("comprado_em") > F.col("cadastro_em"))
                .groupBy("pessoa").agg(F.min("comprado_em").alias("comprou_em")))
    pessoas = (novos.join(primeira, "pessoa", "left")
               .withColumn("dias", (F.unix_seconds("comprou_em") - F.unix_seconds("cadastro_em")) / 86400))
    return (com_todos(pessoas, ["canal"],
                      F.count("*").alias("pessoas"), F.count("comprou_em").alias("compraram"),
                      F.percentile_approx("dias", 0.5).alias("mediana_dias"))
            .withColumn("taxa_compra", F.round(F.col("compraram") / F.col("pessoas"), 4))
            .withColumn("mediana_dias", F.round("mediana_dias", 3))
            .select("canal", "pessoas", "compraram", "taxa_compra", "mediana_dias")
            .orderBy(F.col("canal") != TODOS, F.desc("pessoas")))


def funil_assinatura(eventos: DataFrame) -> DataFrame:
    """Sessões que viram os planos, começaram o checkout e pagaram (em qualquer momento da sessão),
    com a conversão sobre a etapa anterior e sobre o topo; por canal da sessão e no total."""
    sessoes = eventos.groupBy("sessao_id", F.col("canal_sessao").alias("canal")).agg(
        *[F.max(_na_etapa(etapa).cast("int")).alias(etapa) for etapa in ETAPAS])
    alguma = sessoes.filter(F.greatest(*ETAPAS) == 1)
    contagem = com_todos(alguma, ["canal"], *[F.sum(etapa).alias(etapa) for etapa in ETAPAS])
    passos = F.array(*[F.struct(F.lit(i).alias("ordem"), F.lit(etapa).alias("etapa"), F.col(etapa).alias("pessoas"))
                       for i, etapa in enumerate(ETAPAS, start=1)])
    linhas = contagem.select("canal", F.explode(passos).alias("p")).select("canal", "p.*")
    # _conversoes (do funil de ativação) conta a coluna "pessoas"; aqui a unidade é a sessão
    return (_conversoes(linhas, ["canal"]).withColumnRenamed("pessoas", "sessoes")
            .orderBy(F.col("canal") != TODOS, "canal", "ordem"))


def calcular(eventos: DataFrame) -> dict[str, DataFrame]:
    pedidos = compras(eventos).cache()
    return {
        "receita_diaria": receita_diaria(pedidos),
        "taxa_reembolso": taxa_reembolso(pedidos),
        "adesao_plano_anual": adesao_plano_anual(pedidos),
        "cadastro_para_compra": cadastro_para_compra(eventos, pedidos),
        "funil_assinatura": funil_assinatura(eventos),
    }


def main() -> None:
    spark = criar_sessao("gold_receita")
    exigir_camada(spark, glob_eventos("silver"), "python pipeline/silver.py")
    eventos = ler_eventos(spark, "silver").cache()
    titulo("Gold · receita (assinatura Pro)")
    for nome, tabela in calcular(eventos).items():
        tabela.write.mode("overwrite").parquet(caminho(f"gold/{nome}"))
        print(f"gold/{nome}: {tabela.count()} linhas")
    spark.stop()


if __name__ == "__main__":
    main()
