"""Job que publica a previsão da semana no Supabase (tabela previsoes_ml), para o card do app.

    docker compose run --rm app python pipeline/publicar_previsao.py

Lê gold/previsao_7dias pelo Spark e faz upsert por (placa, dia) com a service key do datalake/.env
(supabase_rest.py). Sem as credenciais, avisa e não falha: a previsão continua na Gold.
"""

from __future__ import annotations

from pyspark.sql import DataFrame

from comum import caminho, criar_sessao, exigir_camada, titulo
from supabase_rest import credenciais, upsert

COLUNAS = ("estimada_wh", "prevista_wh", "p10_wh", "p90_wh", "modelo")


def linhas(previsao: DataFrame) -> list[dict]:
    """As linhas no formato da tabela: placa_id numérico (app-7 -> 7), dia em texto e gerada_em em ISO."""
    saida = []
    for r in previsao.collect():
        saida.append({"placa_id": int(r.placa_id.removeprefix("app-")), "dia": r.dia.isoformat(),
                      **{c: r[c] for c in COLUNAS}, "gerada_em": r.gerada_em.isoformat()})
    return saida


def main() -> None:
    spark = criar_sessao("publicar_previsao")
    exigir_camada(spark, "gold/previsao_7dias", "python pipeline/prever_energia.py")
    dados = linhas(spark.read.parquet(caminho("gold/previsao_7dias")))
    spark.stop()

    titulo("Publicação da previsão no Supabase")
    cred = credenciais()
    if not cred:
        print("Supabase: sem SUPABASE_URL/SUPABASE_SERVICE_KEY no datalake/.env; a previsão fica só na Gold")
        return
    print(f"previsoes_ml: {upsert(cred, 'previsoes_ml', dados, 'placa_id,dia')} linhas publicadas")


if __name__ == "__main__":
    main()
