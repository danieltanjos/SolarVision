"""Job de exportação para o app (R11): Gold -> frontend/public/bi/mapa_calor.js e bi.js.

    docker compose run --rm app python pipeline/exportar_bi.py

O docker-compose monta frontend/public/bi do repositório em /projeto/app-bi. Os dois arquivos são
resultado gerado (dados de negócio): ficam fora do git.

- mapa_calor.js: window.MAPA_CALOR = {"gerado_em", "cliques", "rolagem"}, com os nomes de coluna
  exatos das Golds do mapa de calor; o overlay do app pinta os elementos data-heat da tela atual.
- bi.js: window.SOLARVISION_BI = {...}, as tabelas pequenas da Gold para a página "Uso da plataforma".
  Só agregados: nenhuma linha por pessoa ou por sessão sai do datalake.
"""

from __future__ import annotations

import json
from datetime import date, datetime, timezone
from decimal import Decimal

from pyspark.sql import DataFrame
from pyspark.sql import functions as F

from comum import arquivo_do_projeto, caminho, criar_sessao, exigir_camada, titulo

PASTA = "app-bi"
# tabela Gold -> job que a grava (para a mensagem do exigir_camada, R2)
GOLDS = {
    "funil_ativacao": "gold_funil", "funil_login": "gold_funil",
    "sessoes": "gold_engajamento", "uso_telas": "gold_engajamento",
    "buscas_seletor": "gold_engajamento", "saidas_downloads": "gold_engajamento",
    "ativacao_diaria": "gold_aquisicao", "retencao": "gold_aquisicao",
    "taxa_abandono": "gold_aquisicao", "cadastro_para_ativacao": "gold_aquisicao",
    "propensao_ativacao": "gold_ml", "metricas_modelo": "gold_ml", "segmentos_usuarios": "gold_ml",
    "mapa_calor_cliques": "gold_mapa_calor", "mapa_calor_rolagem": "gold_mapa_calor",
}
DIRETAS = ("funil_ativacao", "funil_login", "uso_telas", "buscas_seletor", "saidas_downloads",
           "ativacao_diaria", "retencao", "taxa_abandono", "cadastro_para_ativacao", "metricas_modelo")


def _valor(v):
    if isinstance(v, (datetime, date)):
        return v.isoformat()
    if isinstance(v, Decimal):
        return float(v)
    return v


def linhas(df: DataFrame) -> list[dict]:
    """As linhas de uma tabela pequena como dicts prontos para JSON."""
    return [{k: _valor(v) for k, v in r.asDict(recursive=True).items()} for r in df.collect()]


def resumo_propensao(propensao: DataFrame) -> DataFrame:
    """No conjunto de teste: sessões por faixa de probabilidade e a taxa real de ativação em cada uma
    (se o modelo é bom, a taxa real cresce com a faixa)."""
    return (propensao.filter(F.col("conjunto") == "teste")
            .withColumn("faixa", F.least(F.floor(F.col("probabilidade") * 10), F.lit(9)) / 10)
            .groupBy("faixa")
            .agg(F.count("*").alias("sessoes"), F.round(F.avg("rotulo"), 4).alias("taxa_real"))
            .orderBy("faixa"))


def resumo_segmentos(segmentos: DataFrame) -> DataFrame:
    """Um perfil médio por segmento (sem as pessoas)."""
    medias = [c for c in segmentos.columns if c.startswith("media_")]
    return (segmentos.select("segmento", "pessoas_no_segmento", "k", "silhueta", *medias)
            .dropDuplicates(["segmento"]).orderBy("segmento"))


def kpis(sessoes: DataFrame, cadastro: DataFrame) -> dict:
    s = sessoes.agg(F.count("*").alias("sessoes"), F.countDistinct("pessoa").alias("pessoas"),
                    F.round(F.avg("duracao_seg"), 1).alias("duracao_media_seg"),
                    F.round(F.avg("telas_distintas"), 2).alias("telas_por_sessao")).first().asDict()
    total = cadastro.filter(F.col("canal") == "(todos)").first()
    s.update(novos_usuarios=total.pessoas if total else 0, ativados=total.ativaram if total else 0,
             taxa_ativacao=total.taxa_ativacao if total else None, mediana_dias_ativar=total.mediana_dias if total else None)
    return {k: _valor(v) for k, v in s.items()}


def montar_bi(tabelas: dict[str, DataFrame], gerado_em: str) -> dict:
    return {
        "gerado_em": gerado_em,
        "kpis": kpis(tabelas["sessoes"], tabelas["cadastro_para_ativacao"]),
        **{nome: linhas(tabelas[nome]) for nome in DIRETAS},
        "propensao_por_faixa": linhas(resumo_propensao(tabelas["propensao_ativacao"])),
        "segmentos": linhas(resumo_segmentos(tabelas["segmentos_usuarios"])),
    }


def montar_mapa(tabelas: dict[str, DataFrame], gerado_em: str) -> dict:
    return {"gerado_em": gerado_em, "cliques": linhas(tabelas["mapa_calor_cliques"]),
            "rolagem": linhas(tabelas["mapa_calor_rolagem"])}


def escrever_js(relativo: str, variavel: str, dados: dict) -> None:
    """Uma linha `window.<variavel> = {...};`, gravada de uma vez (quem lê nunca pega pela metade)."""
    destino = arquivo_do_projeto(relativo)
    destino.parent.mkdir(parents=True, exist_ok=True)
    temporario = destino.with_name(destino.name + ".tmp")
    temporario.write_text(f"window.{variavel} = {json.dumps(dados, ensure_ascii=False)};\n", encoding="utf-8")
    temporario.replace(destino)


def main() -> None:
    spark = criar_sessao("exportar_bi")
    for tabela, job in GOLDS.items():
        exigir_camada(spark, f"gold/{tabela}", f"python pipeline/{job}.py")
    tabelas = {nome: spark.read.parquet(caminho(f"gold/{nome}")) for nome in GOLDS}
    gerado_em = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    mapa, bi = montar_mapa(tabelas, gerado_em), montar_bi(tabelas, gerado_em)
    escrever_js(f"{PASTA}/mapa_calor.js", "MAPA_CALOR", mapa)
    escrever_js(f"{PASTA}/bi.js", "SOLARVISION_BI", bi)
    titulo("Exportação para o app")
    print(f"{PASTA}/mapa_calor.js: {len(mapa['cliques'])} elementos, {len(mapa['rolagem'])} marcos")
    print(f"{PASTA}/bi.js: {len(bi) - 2} tabelas + KPIs (gerado em {gerado_em})")
    spark.stop()


if __name__ == "__main__":
    main()
