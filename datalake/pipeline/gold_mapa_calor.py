"""Job Gold do mapa de calor (enunciado 5.3 e 5.5): cliques por elemento e rolagem por tela.

    docker compose run --rm app python pipeline/gold_mapa_calor.py

Grava gold/mapa_calor_cliques e gold/mapa_calor_rolagem, com os nomes de coluna exatos que o
overlay do app lê (R11). O projeto-modelo só desenhava a landing ("/"); aqui toda tela do app tem mapa.
"""

from pyspark.sql import DataFrame, Window
from pyspark.sql import functions as F

from comum import caminho, criar_sessao, exigir_camada, glob_eventos, ler_eventos, titulo

MARCOS = (0, 25, 50, 75, 90)


def _sessoes_na_pagina(eventos: DataFrame) -> DataFrame:
    return (eventos.filter((F.col("event_name") == "page_view") & F.col("pagina").isNotNull())
            .groupBy("pagina").agg(F.countDistinct("sessao_id").alias("sessoes_na_pagina")))


def mapa_calor_cliques(eventos: DataFrame) -> DataFrame:
    """Por página e element_id (só eventos com os dois): cliques, sessões que clicaram, sessões com
    page_view na página, taxa_clique = sessoes ÷ sessoes_na_pagina e intensidade = cliques ÷ o maior
    da página (0 a 1). Taxas a 4 casas."""
    cliques = (eventos.filter(F.col("element_id").isNotNull() & F.col("pagina").isNotNull())
               .groupBy("pagina", "element_id")
               .agg(F.count("*").alias("cliques"), F.countDistinct("sessao_id").alias("sessoes")))
    maior = F.max("cliques").over(Window.partitionBy("pagina"))
    return (cliques.join(_sessoes_na_pagina(eventos), "pagina", "left")
            .fillna(0, subset=["sessoes_na_pagina"])
            .withColumn("taxa_clique", F.round(F.try_divide(F.col("sessoes"), F.col("sessoes_na_pagina")), 4))
            .withColumn("intensidade", F.round(F.col("cliques") / maior, 4))
            .select("pagina", "element_id", "cliques", "sessoes", "sessoes_na_pagina", "taxa_clique", "intensidade")
            .orderBy("pagina", F.desc("cliques")))


def mapa_calor_rolagem(eventos: DataFrame) -> DataFrame:
    """Por página e marco (0, 25, 50, 75, 90): entre as sessões com page_view na página, quantas
    chegaram ao marco (o 0 são todas; os outros, as com scroll ≥ marco na página) e o percentual."""
    vistas = (eventos.filter((F.col("event_name") == "page_view") & F.col("pagina").isNotNull())
              .select("pagina", "sessao_id").distinct())
    alcance = (eventos.filter(F.col("event_name") == "scroll")
               .groupBy("pagina", "sessao_id").agg(F.max("percent_scrolled").alias("alcance")))
    por_sessao = vistas.join(alcance, ["pagina", "sessao_id"], "left").fillna(0, subset=["alcance"])
    marcos = eventos.sparkSession.createDataFrame([(m,) for m in MARCOS], "marco int")
    chegaram = (por_sessao.crossJoin(marcos)
                .groupBy("pagina", "marco")
                .agg(F.sum((F.col("alcance") >= F.col("marco")).cast("int")).alias("sessoes_que_chegaram")))
    todas = F.max(F.when(F.col("marco") == 0, F.col("sessoes_que_chegaram"))).over(Window.partitionBy("pagina"))
    return (chegaram.withColumn("pct_sessoes", F.round(F.try_divide(F.col("sessoes_que_chegaram"), todas), 4))
            .select("pagina", "marco", "sessoes_que_chegaram", "pct_sessoes")
            .orderBy("pagina", "marco"))


def calcular(eventos: DataFrame) -> dict[str, DataFrame]:
    return {"mapa_calor_cliques": mapa_calor_cliques(eventos), "mapa_calor_rolagem": mapa_calor_rolagem(eventos)}


def main() -> None:
    spark = criar_sessao("gold_mapa_calor")
    exigir_camada(spark, glob_eventos("silver"), "python pipeline/silver.py")
    eventos = ler_eventos(spark, "silver").cache()
    titulo("Gold · mapa de calor")
    for nome, tabela in calcular(eventos).items():
        tabela.write.mode("overwrite").parquet(caminho(f"gold/{nome}"))
        print(f"gold/{nome}: {tabela.count()} linhas")
    spark.stop()


if __name__ == "__main__":
    main()
