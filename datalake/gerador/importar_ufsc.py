"""Sobe para a landing de energia a referência real da UFSC: geração medida + clima do Open-Meteo.

    docker compose run --rm app python gerador/importar_ufsc.py
    docker compose run --rm app python gerador/importar_ufsc.py --saida-local saida

O CSV (supabase/seed/Dados_Tratados_CDTE-PSI.csv, montado em /projeto/seed-ufsc) tem a potência média de
5 em 5 minutos de um sistema do laboratório Fotovoltaica-UFSC, de 2018-01 a 2023-03, em hora local de São
Paulo (UTC-3 fixo, como na validação do modelo). É o único dado real de geração com anos de histórico que
temos: o modelo de previsão aprende nele como a geração real se afasta da estimativa física.

Os parâmetros da placa vêm da validação (docs/validacao/RESULTADO.md): 20° voltada para o Norte, e o
k = Wp × PR ajustado de 1.923 W equivale a ~2.345 Wp com o PR 0,82 do app. O clima é o do arquivo histórico
do Open-Meteo no mesmo local e plano, pedido do mesmo jeito que o app pede (atualizar_clima_placa).
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from gerador.destinos import DestinoLocal, DestinoS3
from gerador import landing_energia

CSV_PADRAO = Path("seed-ufsc/Dados_Tratados_CDTE-PSI.csv")
CACHE = Path(".cache-open-meteo")
PLACA = {
    "placa_id": "ufsc-1", "fonte": "ufsc", "potencia_wp": 2345.0, "inclinacao": 20.0, "azimute": 0.0,
    "coef_temperatura": -0.40, "instalada_em": "2017-12-01", "latitude": -27.43, "longitude": -48.44,
}
FUSO = timedelta(hours=3)             # hora local de São Paulo = UTC - 3


def ler_leituras(caminho: Path, placa_id: str = PLACA["placa_id"]) -> list[dict]:
    """Cada linha do CSV vira uma leitura em UTC: potência média de 5 minutos."""
    leituras = []
    with caminho.open(encoding="utf-8") as arquivo:
        for linha in csv.DictReader(arquivo):
            if not linha.get("wats5min"):
                continue
            local = datetime.strptime(f"{linha['dia']} {linha['hora']}", "%Y-%m-%d %H:%M:%S")
            utc = (local + FUSO).replace(tzinfo=timezone.utc)
            leituras.append({"placa_id": placa_id, "data_hora": utc.strftime("%Y-%m-%dT%H:%M:%SZ"),
                             "watts": float(linha["wats5min"]), "intervalo_min": 5})
    return leituras


def url_arquivo(placa: dict, inicio: str, fim: str) -> str:
    """A mesma consulta do app: GTI no plano da placa, temperatura e chuva, horárias, em UTC.
    No Open-Meteo o azimute é 0 = Sul; no app, 0 = Norte (por isso o − 180)."""
    parametros = {
        "latitude": placa["latitude"], "longitude": placa["longitude"], "tilt": placa["inclinacao"],
        "azimuth": placa["azimute"] - 180, "hourly": "global_tilted_irradiance,temperature_2m,precipitation",
        "timezone": "UTC", "start_date": inicio, "end_date": fim,
    }
    return "https://archive-api.open-meteo.com/v1/archive?" + urllib.parse.urlencode(parametros)


def clima_das_horas(horas: dict, placa_id: str) -> list[dict]:
    """O Open-Meteo marca cada hora pelo FIM do intervalo; guardamos o início, como o app."""
    linhas = []
    for t, g, temp, chuva in zip(horas["time"], horas["global_tilted_irradiance"], horas["temperature_2m"],
                                 horas["precipitation"]):
        if g is None or temp is None:
            continue
        inicio = datetime.fromisoformat(t).replace(tzinfo=timezone.utc) - timedelta(hours=1)
        linhas.append({"placa_id": placa_id, "data_hora": inicio.strftime("%Y-%m-%dT%H:%M:%SZ"),
                       "irradiancia": g, "temperatura": temp, "precipitacao": chuva or 0.0, "previsao": False})
    return linhas


def buscar_clima(placa: dict, inicio: str, fim: str, abrir=urllib.request.urlopen) -> dict:
    """Uma chamada ao arquivo do Open-Meteo, com cache em disco (5 anos de horas é uma resposta só)."""
    CACHE.mkdir(exist_ok=True)
    arquivo = CACHE / f"{placa['placa_id']}_{inicio}_{fim}.json"
    if arquivo.exists():
        return json.loads(arquivo.read_text(encoding="utf-8"))
    for tentativa in range(5):
        try:
            with abrir(url_arquivo(placa, inicio, fim), timeout=300) as resposta:
                horas = json.loads(resposta.read())["hourly"]
            arquivo.write_text(json.dumps(horas), encoding="utf-8")
            return horas
        except urllib.error.HTTPError as erro:
            if erro.code != 429 or tentativa == 4:
                raise
            time.sleep(60)          # limite do plano gratuito: espera e tenta de novo
    raise RuntimeError("Open-Meteo não respondeu")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--csv", type=Path, default=CSV_PADRAO)
    ap.add_argument("--saida-local", type=Path, help="grava nesta pasta em vez do S3")
    a = ap.parse_args(argv)
    if not a.csv.is_file():
        print(f"erro: {a.csv} não existe (o docker-compose monta supabase/seed em /projeto/seed-ufsc)", file=sys.stderr)
        return 1

    leituras = ler_leituras(a.csv)
    inicio = (datetime.fromisoformat(leituras[0]["data_hora"][:10]) - timedelta(days=1)).strftime("%Y-%m-%d")
    fim = (datetime.fromisoformat(leituras[-1]["data_hora"][:10]) + timedelta(days=1)).strftime("%Y-%m-%d")
    clima = clima_das_horas(buscar_clima(PLACA, inicio, fim), PLACA["placa_id"])

    destino = DestinoLocal(a.saida_local) if a.saida_local else DestinoS3()
    contagem = landing_energia.gravar(destino, "ufsc", "importacao",
                                      {"placas": [PLACA], "clima": clima, "leituras": leituras})
    print(f"UFSC ({inicio} a {fim}) -> {destino.descricao()}")
    for tabela, n in contagem.items():
        print(f"  {tabela:<10}{n:>9} linhas")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
