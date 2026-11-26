"""Coletor de energia: placas, clima, leituras e limpezas do Supabase -> landing de energia do datalake.

    docker compose run --rm app python coletor/coletar_energia.py
    docker compose run --rm app python coletor/coletar_energia.py --saida-local saida

Precisa de SUPABASE_URL e da service key (veja pipeline/supabase_rest.py), como o coletar_supabase.py: ela
lê as placas de todos os donos (a RLS só vale para os usuários do app). Grava em
landing_energia/<tabela>/fonte=app/coleta-<instante>.jsonl, no mesmo layout da referência da UFSC
(gerador/landing_energia.py); a Silver fica com a versão mais nova de cada linha.

O clima de cada placa vem a partir de 40 dias antes da primeira leitura (ou de 40 dias atrás, para quem não
importou leituras), mais a previsão dos próximos dias: o modelo usa o histórico recente da placa e a
previsão da semana. A hora que ainda não chegou é marcada como previsão.
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from gerador import landing_energia
from gerador.destinos import DestinoLocal, DestinoS3
from pipeline.supabase_rest import credenciais

PAGINA = 1000
HISTORICO_DIAS = 40


def cliente(url: str, chave: str):
    """get(tabela, parâmetros) -> todas as linhas, de PAGINA em PAGINA (REST do Supabase, ordem estável)."""
    def get(tabela: str, parametros: dict) -> list[dict]:
        linhas: list[dict] = []
        while True:
            consulta = urllib.parse.urlencode({**parametros, "limit": PAGINA, "offset": len(linhas)})
            pedido = urllib.request.Request(f"{url.rstrip('/')}/rest/v1/{tabela}?{consulta}",
                                            headers={"apikey": chave, "Authorization": f"Bearer {chave}"})
            with urllib.request.urlopen(pedido, timeout=120) as resposta:
                pagina = json.loads(resposta.read())
            linhas += pagina
            if len(pagina) < PAGINA:
                return linhas
    return get


def _id(placa_id) -> str:
    return f"app-{placa_id}"


def placas(get) -> list[dict]:
    linhas = get("placas", {
        "select": "id,potencia_wp,inclinacao,azimute,coef_temperatura,instalada_em,grupos_solares(latitude,longitude)",
        "order": "id"})
    return [{"placa_id": _id(p["id"]), "fonte": "app", "potencia_wp": p["potencia_wp"], "inclinacao": p["inclinacao"],
             "azimute": p["azimute"], "coef_temperatura": p["coef_temperatura"], "instalada_em": p["instalada_em"],
             "latitude": (p.get("grupos_solares") or {}).get("latitude"),
             "longitude": (p.get("grupos_solares") or {}).get("longitude")}
            for p in linhas if p.get("potencia_wp")]


def intervalo_min(instantes: list[str], padrao: int = 60) -> int:
    """O intervalo das leituras de uma placa: a mediana entre leituras seguidas (5 min no CSV de referência)."""
    tempos = sorted(datetime.fromisoformat(t.replace("Z", "+00:00")) for t in instantes)
    passos = [(b - a).total_seconds() / 60 for a, b in zip(tempos, tempos[1:]) if b > a]
    return max(1, round(statistics.median(passos))) if passos else padrao


def leituras(get, placa_id: int) -> list[dict]:
    linhas = get("leituras_energia", {"select": "data_hora,wats_gerados", "placa_id": f"eq.{placa_id}",
                                      "order": "data_hora"})
    passo = intervalo_min([linha["data_hora"] for linha in linhas])
    return [{"placa_id": _id(placa_id), "data_hora": linha["data_hora"], "watts": float(linha["wats_gerados"]),
             "intervalo_min": passo} for linha in linhas]


def clima(get, placa_id: int, desde: datetime, agora: datetime) -> list[dict]:
    linhas = get("clima_horario", {"select": "data_hora,irradiancia,temperatura,precipitacao",
                                   "placa_id": f"eq.{placa_id}", "data_hora": f"gte.{desde.isoformat()}",
                                   "order": "data_hora"})
    return [{"placa_id": _id(placa_id), "data_hora": linha["data_hora"], "irradiancia": linha["irradiancia"],
             "temperatura": linha["temperatura"], "precipitacao": linha.get("precipitacao") or 0.0,
             "previsao": datetime.fromisoformat(linha["data_hora"].replace("Z", "+00:00")) > agora}
            for linha in linhas]


def limpezas(get) -> list[dict]:
    return [{"placa_id": _id(linha["placa_id"]), "dia": linha["data_limpeza"]}
            for linha in get("limpezas", {"select": "placa_id,data_limpeza", "order": "id"})]


def coletar(get, agora: datetime) -> dict[str, list[dict]]:
    tabelas = {"placas": placas(get), "clima": [], "leituras": [], "limpezas": limpezas(get)}
    for placa in tabelas["placas"]:
        numero = int(placa["placa_id"].removeprefix("app-"))
        lidas = leituras(get, numero)
        tabelas["leituras"] += lidas
        primeira = (datetime.fromisoformat(lidas[0]["data_hora"].replace("Z", "+00:00")) if lidas else agora)
        tabelas["clima"] += clima(get, numero, min(primeira, agora) - timedelta(days=HISTORICO_DIAS), agora)
    return tabelas


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--saida-local", type=Path, help="grava nesta pasta em vez do S3")
    a = ap.parse_args(argv)
    cred = credenciais()
    if not cred:
        print("erro: defina SUPABASE_URL no datalake/.env e a service key (segredo.ps1 ou "
              "SUPABASE_SERVICE_KEY no .env)", file=sys.stderr)
        return 1
    url, chave = cred
    agora = datetime.now(timezone.utc)
    tabelas = coletar(cliente(url, chave), agora)
    destino = DestinoLocal(a.saida_local) if a.saida_local else DestinoS3()
    contagem = landing_energia.gravar(destino, "app", f"coleta-{agora:%Y%m%dT%H%M%S}", tabelas)
    print(f"Supabase -> {destino.descricao()}")
    for tabela, n in contagem.items():
        print(f"  {tabela:<10}{n:>9} linhas")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
