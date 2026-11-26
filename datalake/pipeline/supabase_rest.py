"""Supabase pela REST, com a service key: o caminho de volta do datalake para o app.

    from supabase_rest import credenciais, publicar_bi, upsert

Os jobs leem e gravam o lake só pelo Spark (R1); isto é outra coisa: publica um resultado pequeno (o BI,
o mapa de calor, a previsão de energia) nas tabelas do Supabase que o app lê. Precisa de SUPABASE_URL
(datalake/.env) e da service key: de preferência como secret do compose (segredo.ps1 a guarda criptografada
no Windows e o container a lê em /run/secrets), ou SUPABASE_SERVICE_KEY no .env. Sem elas, credenciais()
devolve None e os jobs gravam só o arquivo local, como antes.
"""

from __future__ import annotations

import json
import os
import urllib.parse
import urllib.request
from pathlib import Path

LOTE = 500
SEGREDO = Path("/run/secrets/supabase_service_key")   # docker-compose.segredo.yml
abrir = urllib.request.urlopen          # trocado nos testes


def chave_de_servico() -> str | None:
    """A service key: o secret do compose, se houver, senão SUPABASE_SERVICE_KEY do ambiente."""
    if SEGREDO.is_file():
        chave = SEGREDO.read_text(encoding="utf-8").strip()
        if chave:
            return chave
    return os.environ.get("SUPABASE_SERVICE_KEY") or None


def credenciais() -> tuple[str, str] | None:
    """(url, service key), ou None se faltar algum."""
    url, chave = os.environ.get("SUPABASE_URL"), chave_de_servico()
    return (url.rstrip("/"), chave) if url and chave else None


def pedir(cred: tuple[str, str], metodo: str, caminho: str, corpo=None, prefer: str | None = None):
    """Uma chamada à REST do Supabase (PostgREST); devolve o JSON da resposta, ou None se vier vazia."""
    url, chave = cred
    cabecalhos = {"apikey": chave, "Authorization": f"Bearer {chave}", "Content-Type": "application/json"}
    if prefer:
        cabecalhos["Prefer"] = prefer
    dados = None if corpo is None else json.dumps(corpo, ensure_ascii=False, default=str).encode("utf-8")
    pedido = urllib.request.Request(f"{url}/rest/v1/{caminho}", data=dados, method=metodo, headers=cabecalhos)
    with abrir(pedido, timeout=120) as resposta:
        texto = resposta.read()
    return json.loads(texto) if texto else None


def upsert(cred: tuple[str, str], tabela: str, linhas: list[dict], conflito: str) -> int:
    """Insere ou atualiza (pela chave `conflito`) em lotes de LOTE linhas. Devolve quantas mandou."""
    caminho = f"{tabela}?{urllib.parse.urlencode({'on_conflict': conflito})}"
    for i in range(0, len(linhas), LOTE):
        pedir(cred, "POST", caminho, linhas[i:i + LOTE], prefer="resolution=merge-duplicates,return=minimal")
    return len(linhas)


def publicar_bi(cred: tuple[str, str], nome: str, dados: dict, gerado_em: str) -> None:
    """Uma linha de bi_exportacoes ('bi' ou 'mapa_calor'), lida só por ADMIN pela RLS."""
    upsert(cred, "bi_exportacoes", [{"nome": nome, "dados": dados, "gerado_em": gerado_em}], "nome")
