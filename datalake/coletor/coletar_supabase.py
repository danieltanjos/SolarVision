"""Coletor dos eventos reais do app: tabela eventos_coletados (Supabase) -> landing do datalake.

    docker compose run --rm app python coletor/coletar_supabase.py
    docker compose run --rm app python coletor/coletar_supabase.py --saida-local saida   # numa pasta

Precisa de SUPABASE_URL e SUPABASE_SERVICE_KEY no datalake/.env (fora do git): a tabela só aceita
insert pela API, e só a service key lê. Guarda o último id levado em .coletor/ultimo_id, para a próxima
execução trazer só os eventos novos.

Como o gerador, fica fora do pipeline (pode usar boto3 e HTTP); grava na landing com o mesmo layout
(lotes.pasta: event_name=…/year=…/month=…/day=…, o dia de coleta = o dia em que o evento chegou ao
Supabase) e origem "app" no nome do arquivo.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from gerador.destinos import DestinoLocal, DestinoS3
from gerador.lotes import pasta

PAGINA = 1000
ESTADO = Path(".coletor") / "ultimo_id"


def buscar(url: str, chave: str, desde_id: int) -> list[dict]:
    """Todas as linhas com id > desde_id, em ordem, de PAGINA em PAGINA (REST do Supabase)."""
    linhas: list[dict] = []
    while True:
        consulta = urllib.parse.urlencode({
            "select": "id,evento,recebido_em", "id": f"gt.{desde_id}", "order": "id", "limit": PAGINA})
        pedido = urllib.request.Request(f"{url.rstrip('/')}/rest/v1/eventos_coletados?{consulta}",
                                        headers={"apikey": chave, "Authorization": f"Bearer {chave}"})
        with urllib.request.urlopen(pedido, timeout=60) as resposta:
            pagina = json.loads(resposta.read())
        linhas += pagina
        if len(pagina) < PAGINA:
            return linhas
        desde_id = pagina[-1]["id"]


def montar_arquivos(linhas: list[dict], agora: datetime) -> dict[str, str]:
    """{chave na landing: JSONL}: um arquivo por event_name e dia de chegada, no layout do contrato."""
    por_pasta: dict[str, list[str]] = defaultdict(list)
    for linha in linhas:
        evento = linha["evento"]
        dia = linha["recebido_em"][:10]
        por_pasta[pasta(evento.get("event_name"), dia)].append(
            json.dumps(evento, ensure_ascii=False, separators=(",", ":")))
    nome = f"app-{agora:%Y%m%dT%H%M%S}.jsonl"
    return {f"{p}/{nome}": "\n".join(eventos) + "\n" for p, eventos in sorted(por_pasta.items())}


def ler_ultimo_id(arquivo: Path) -> int:
    try:
        return int(arquivo.read_text(encoding="utf-8").strip())
    except (OSError, ValueError):
        return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--saida-local", type=Path, help="grava nesta pasta em vez do S3")
    ap.add_argument("--desde-id", type=int, help="ignora o estado salvo e traz os eventos com id maior que este")
    a = ap.parse_args(argv)

    url, chave = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not chave:
        print("erro: defina SUPABASE_URL e SUPABASE_SERVICE_KEY no datalake/.env", file=sys.stderr)
        return 1
    desde = a.desde_id if a.desde_id is not None else ler_ultimo_id(ESTADO)
    linhas = buscar(url, chave, desde)
    if not linhas:
        print(f"Nenhum evento novo depois do id {desde}.")
        return 0

    destino = DestinoLocal(a.saida_local) if a.saida_local else DestinoS3()
    for chave_arquivo, conteudo in montar_arquivos(linhas, datetime.now(timezone.utc)).items():
        destino.gravar(chave_arquivo, conteudo)
    ESTADO.parent.mkdir(exist_ok=True)
    ESTADO.write_text(str(linhas[-1]["id"]), encoding="utf-8")
    print(f"{len(linhas)} eventos (ids {linhas[0]['id']} a {linhas[-1]['id']}) enviados para {destino.descricao()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
