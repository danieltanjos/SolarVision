"""Job de exportação do mapa de calor (R11): gold/mapa_calor_cliques e gold/mapa_calor_rolagem pelo
Spark -> frontend/public/bi/mapa_calor.js, que o botão "Mapa de calor" do app carrega.

    docker compose run --rm app python pipeline/exportar_mapa_calor.py

Segue o exportar_mapa_calor do projeto-modelo do professor: um job só para o mapa, que confere os nomes
de coluna exatos que o overlay lê, ordena as linhas, grava o arquivo numa linha só e de uma vez (um .tmp
renomeado no fim: quem lê nunca pega o arquivo pela metade) e avisa se não houver clique. As duas tabelas
têm poucas centenas de linhas, então collect() cabe na memória. O arquivo local só é gravado no fim,
depois de ler tudo do S3 pelo Spark (R1).

O docker-compose monta frontend/public/bi do repositório em /projeto/app-bi; o arquivo é resultado
gerado (dado de negócio) e fica fora do git.
"""

from __future__ import annotations

import json
from datetime import date, datetime, timezone
from decimal import Decimal

from comum import arquivo_do_projeto, caminho, criar_sessao, exigir_camada, titulo

DESTINO = "app-bi/mapa_calor.js"
VARIAVEL = "MAPA_CALOR"
COMANDO_ANTES = "python pipeline/gold_mapa_calor.py"
# nomes de coluna exatos que o overlay do app lê (enunciado 5.3 e R11), com a ordem das linhas
TABELAS = {
    "cliques": ("mapa_calor_cliques",
                ["pagina", "element_id", "cliques", "sessoes", "sessoes_na_pagina", "taxa_clique",
                 "intensidade"],
                ["pagina", "element_id"]),
    "rolagem": ("mapa_calor_rolagem", ["pagina", "marco", "sessoes_que_chegaram", "pct_sessoes"], ["pagina", "marco"]),
}


class ColunasFaltando(SystemExit):
    """A tabela Gold não tem as colunas que o app lê: a mensagem diz quais e o que rodar antes."""


def _valor(v):
    if isinstance(v, (datetime, date)):
        return v.isoformat()
    if isinstance(v, Decimal):
        return float(v)
    return v


def conferir_colunas(tabela: str, existentes: list[str], exigidas: list[str]) -> None:
    faltando = [c for c in exigidas if c not in existentes]
    if faltando:
        raise ColunasFaltando(f"gold/{tabela} não tem as colunas {faltando}. Rode antes: {COMANDO_ANTES}")


def linhas(df, tabela: str, colunas: list[str], ordem: list[str]) -> list[dict]:
    """As linhas da tabela, só com as colunas do app e na ordem certa, prontas para JSON."""
    conferir_colunas(tabela, df.columns, colunas)
    return [{k: _valor(v) for k, v in r.asDict().items()} for r in df.select(*colunas).orderBy(*ordem).collect()]


def montar(cliques: list[dict], rolagem: list[dict], gerado_em: str) -> dict:
    return {"gerado_em": gerado_em, "cliques": cliques, "rolagem": rolagem}


def escrever_js(relativo: str, variavel: str, dados: dict) -> None:
    """Uma linha `window.<variavel> = {...};`, gravada de uma vez (quem lê nunca pega pela metade)."""
    destino = arquivo_do_projeto(relativo)
    destino.parent.mkdir(parents=True, exist_ok=True)
    temporario = destino.with_name(destino.name + ".tmp")
    temporario.write_text(f"window.{variavel} = {json.dumps(dados, ensure_ascii=False)};\n", encoding="utf-8")
    temporario.replace(destino)


def main() -> None:
    spark = criar_sessao("exportar_mapa_calor")
    for tabela, _, _ in TABELAS.values():
        exigir_camada(spark, f"gold/{tabela}", COMANDO_ANTES)
    try:
        lidas = {chave: linhas(spark.read.parquet(caminho(f"gold/{tabela}")), tabela, colunas, ordem)
                 for chave, (tabela, colunas, ordem) in TABELAS.items()}
    finally:
        spark.stop()
    gerado_em = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    escrever_js(DESTINO, VARIAVEL, montar(lidas["cliques"], lidas["rolagem"], gerado_em))

    titulo("Exportação do mapa de calor")
    telas = sorted({linha["pagina"] for linha in lidas["cliques"]})
    print(f"{DESTINO}: {len(lidas['cliques'])} linhas de cliques em {len(telas)} telas, "
          f"{len(lidas['rolagem'])} de rolagem (gerado em {gerado_em})")
    if not lidas["cliques"]:
        print("Aviso: nenhum clique com element_id. Se a landing é antiga, rode de novo o gerador e o pipeline.")


if __name__ == "__main__":
    main()
