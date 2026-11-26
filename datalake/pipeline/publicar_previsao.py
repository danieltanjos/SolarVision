"""Job que publica a previsão da semana no Supabase (tabela previsoes_ml), para o card do app.

    docker compose run --rm app python pipeline/publicar_previsao.py

Lê gold/previsao_7dias pelo Spark e faz upsert por (placa, dia) com a service key (supabase_rest.py).
Sem as credenciais, avisa e não falha: a previsão continua na Gold. No GitHub Actions roda todo dia pelo
.github/workflows/previsao-energia.yml.
"""

from __future__ import annotations

import urllib.error

from pyspark.sql import DataFrame

from comum import caminho, criar_sessao, exigir_camada, titulo
from supabase_rest import credenciais, upsert

COLUNAS = ("estimada_wh", "prevista_wh", "p10_wh", "p90_wh", "modelo")
MIGRATION = "supabase/migrations/20261125090200_previsoes_ml.sql"


def linhas(previsao: DataFrame) -> list[dict]:
    """As linhas no formato da tabela: placa_id numérico (app-7 -> 7), dia em texto e gerada_em em ISO."""
    saida = []
    for r in previsao.collect():
        saida.append({"placa_id": int(r.placa_id.removeprefix("app-")), "dia": r.dia.isoformat(),
                      **{c: r[c] for c in COLUNAS}, "gerada_em": r.gerada_em.isoformat()})
    return saida


def publicar(cred: tuple[str, str], dados: list[dict]) -> int:
    """Upsert em previsoes_ml. Tabela inexistente (404) vira um erro que diz qual migration falta."""
    try:
        return upsert(cred, "previsoes_ml", dados, "placa_id,dia")
    except urllib.error.HTTPError as erro:
        if erro.code == 404:
            raise SystemExit(f"erro: a tabela previsoes_ml não existe no Supabase; aplique {MIGRATION} "
                             "(sobe na ida develop -> qa)") from erro
        raise


def main() -> None:
    spark = criar_sessao("publicar_previsao")
    exigir_camada(spark, "gold/previsao_7dias", "python pipeline/prever_energia.py")
    dados = linhas(spark.read.parquet(caminho("gold/previsao_7dias")))
    spark.stop()

    titulo("Publicação da previsão no Supabase")
    cred = credenciais()
    if not cred:
        print("Supabase: sem a URL ou a service key (veja o SETUP.md); a previsão fica só na Gold")
        return
    print(f"previsoes_ml: {publicar(cred, dados)} linhas publicadas")


if __name__ == "__main__":
    main()
