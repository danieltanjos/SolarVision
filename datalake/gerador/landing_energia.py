"""Layout da landing de energia, comum ao importador da UFSC e ao coletor do Supabase.

    landing_energia/<tabela>/fonte=<fonte>/<nome>.jsonl

As tabelas são as do contrato da previsão de energia (datalake/docs/PREVISAO_ENERGIA.md):
    placas    placa_id, fonte, potencia_wp, inclinacao, azimute, coef_temperatura, instalada_em,
              latitude, longitude
    clima     placa_id, data_hora (início da hora, UTC), irradiancia (W/m² no plano da placa),
              temperatura (°C), precipitacao (mm), previsao (true = previsão do tempo, false = observado)
    leituras  placa_id, data_hora (UTC), watts (potência média no intervalo), intervalo_min
    limpezas  placa_id, dia (data local de São Paulo)

placa_id é texto no datalake: "ufsc-1" para a referência da UFSC, "app-<id>" para as placas do app.
"""

from __future__ import annotations

import json

PREFIXO = "landing_energia"
TABELAS = ("placas", "clima", "leituras", "limpezas")


def chave(tabela: str, fonte: str, nome: str) -> str:
    """'clima', 'ufsc', 'importacao' -> 'landing_energia/clima/fonte=ufsc/importacao.jsonl'."""
    if tabela not in TABELAS:
        raise ValueError(f"tabela desconhecida: {tabela}")
    return f"{PREFIXO}/{tabela}/fonte={fonte}/{nome}.jsonl"


def jsonl(linhas: list[dict]) -> str:
    return "".join(json.dumps(linha, ensure_ascii=False, separators=(",", ":")) + "\n" for linha in linhas)


def gravar(destino, fonte: str, nome: str, tabelas: dict[str, list[dict]]) -> dict[str, int]:
    """Grava uma lista de linhas por tabela (as vazias ficam de fora). Devolve quantas linhas por tabela."""
    contagem = {}
    for tabela, linhas in tabelas.items():
        if linhas:
            destino.gravar(chave(tabela, fonte, nome), jsonl(linhas))
        contagem[tabela] = len(linhas)
    return contagem
