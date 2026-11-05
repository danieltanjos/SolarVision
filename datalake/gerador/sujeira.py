"""Defeitos injetados no dado, para a Silver encontrar.

Cada tipo recebe uma cota proporcional ao seu peso. Os defeitos que
alteram um evento existente atingem no máximo 5% dos candidatos daquele
tipo, para não destruir as métricas (por exemplo, tirar o id de metade dos
cadastros de placa). Além disso, somando todos os tipos, no máximo 5% dos
eventos de cada nome são alterados. As exclusões órfãs inseridas também
ficam em 5% dos cadastros de placa. O que sobra das cotas vai para
"ts_futuro", que tem candidatos de sobra. Um evento recebe no máximo um defeito.

O algoritmo é o do gerador do projeto-modelo; os tipos de defeito são os do
SolarVision (enunciado, R7).

A receita (assinaturas.py) tem a sua própria sujeira, aplicar_sujeira_receita, com o rng dela:
compra sem transaction_id, compra com valor zerado e reembolso órfão, cada um em 5% das compras.
"""

from __future__ import annotations

import copy
import itertools
import math
import random
from collections import Counter
from datetime import timedelta

from gerador.eventos import iso, ler_iso, novo_uuid

PESOS = {
    "acao_sem_id": 2,
    "linhas_negativas": 1,
    "potencia_zero": 1,
    "scroll_33": 2,
    "ts_nulo": 2,
    "ts_futuro": 2,
    "exclusao_orfa": 1,
    "evento_fora_catalogo": 2,
}
# o id que cada ação precisa ter (regra "ação sem id")
ID_DA_ACAO = {
    "create_group": "group_id", "delete_group": "group_id",
    "create_panel": "panel_id", "import_readings": "panel_id",
    "register_cleaning": "panel_id", "delete_panel": "panel_id",
}
TIPOS = tuple(PESOS)
TETO = 0.05


FILTROS = {
    "acao_sem_id": lambda e: e["event_name"] in ID_DA_ACAO,
    "linhas_negativas": lambda e: e["event_name"] == "import_readings" and (e["params"].get("rows") or 0) > 0,
    "potencia_zero": lambda e: e["event_name"] == "create_panel",
    "scroll_33": lambda e: e["event_name"] == "scroll",
    "ts_nulo": lambda e: e["event_ts"] is not None,
    "ts_futuro": lambda e: e["event_ts"] is not None,
}


def _sem_id(e: dict) -> None:
    e["params"][ID_DA_ACAO[e["event_name"]]] = None


def _linhas_negativas(e: dict) -> None:
    e["params"]["rows"] = -int(e["params"]["rows"])


def _potencia_zero(e: dict) -> None:
    e["params"]["potencia_wp"] = 0


def _scroll_33(e: dict) -> None:
    e["params"]["percent_scrolled"] = 33


def _ts_nulo(e: dict) -> None:
    e["event_ts"] = None


def _ts_futuro(e: dict) -> None:
    e["event_ts"] = iso(ler_iso(e["event_ts"]) + timedelta(days=3650))


# Os específicos antes de "acao_sem_id", que também mexe em import_readings e create_panel e
# gastaria o teto de 5% desses nomes. ts_futuro por último: absorve o que os outros não usaram.
MUTACOES = {
    "linhas_negativas": _linhas_negativas,
    "potencia_zero": _potencia_zero,
    "acao_sem_id": _sem_id,
    "scroll_33": _scroll_33,
    "ts_nulo": _ts_nulo,
    "ts_futuro": _ts_futuro,
}


def _clonar(rng: random.Random, base: dict, nome: str, params: dict) -> dict:
    novo = copy.deepcopy(base)
    novo.update(event_id=novo_uuid(rng), event_name=nome, params=params, items=[])
    return novo


def _exclusao_orfa(rng: random.Random, base: dict) -> dict:
    """Exclusão de uma placa que nunca foi cadastrada (id fora de qualquer faixa usada)."""
    return _clonar(rng, base, "delete_panel", {"panel_id": 900000 + rng.randrange(100000), "group_id": None})


def _fora_do_catalogo(rng: random.Random, base: dict) -> dict:
    return _clonar(rng, base, "share_report", {})


INSERCOES = {"exclusao_orfa": _exclusao_orfa, "evento_fora_catalogo": _fora_do_catalogo}


def _cotas(alvo: int) -> dict[str, int]:
    total = sum(PESOS.values())
    cotas = {t: alvo * p // total for t, p in PESOS.items()}
    for t in itertools.islice(itertools.cycle(TIPOS), alvo - sum(cotas.values())):
        cotas[t] += 1
    return cotas


def _limitar_orfaos(cota: int, originais: list[dict]) -> tuple[int, int]:
    """Aplica o teto de 5% dos cadastros de placa às exclusões órfãs. Devolve (cota, sobra)."""
    n_placas = sum(1 for e in originais if e["event_name"] == "create_panel")
    n = min(cota, math.ceil(n_placas * TETO))
    return n, cota - n


def aplicar_sujeira(rng: random.Random, eventos: list[dict], fracao: float) -> dict[str, int]:
    """Altera `eventos` no lugar e acrescenta os inseridos. Devolve a contagem por tipo."""
    originais = list(eventos)
    cotas = _cotas(round(len(originais) * fracao))
    cotas["exclusao_orfa"], sobra = _limitar_orfaos(cotas["exclusao_orfa"], originais)
    contagem = dict.fromkeys(TIPOS, 0)
    usados: set[int] = set()
    por_nome = Counter(e["event_name"] for e in originais)
    tetos = {nome: math.ceil(n * TETO) for nome, n in por_nome.items()}
    alterados: Counter = Counter()

    for tipo, mutar in MUTACOES.items():
        candidatos = [e for e in originais if id(e) not in usados and FILTROS[tipo](e)]
        rng.shuffle(candidatos)
        quero = cotas[tipo] + (sobra if tipo == "ts_futuro" else 0)
        teto = len(candidatos) if tipo == "ts_futuro" else math.ceil(len(candidatos) * TETO)
        n = min(quero, teto)
        if tipo != "ts_futuro":
            sobra += quero - n
        aplicados = 0
        for e in candidatos:
            if aplicados == n:
                break
            nome = e["event_name"]
            if alterados[nome] >= tetos[nome]:
                continue
            mutar(e)
            usados.add(id(e))
            alterados[nome] += 1
            aplicados += 1
        if tipo != "ts_futuro":
            sobra += n - aplicados
        contagem[tipo] = aplicados

    limpos = [e for e in originais if id(e) not in usados]
    for tipo, inserir in INSERCOES.items():
        for _ in range(cotas[tipo]):
            eventos.append(inserir(rng, rng.choice(limpos)))
        contagem[tipo] = cotas[tipo]
    return contagem


# ---- receita (assinatura Pro) ------------------------------------------------------------------
TIPOS_RECEITA = ("compra_sem_transacao", "valor_zerado", "reembolso_orfao")


def aplicar_sujeira_receita(rng: random.Random, eventos: list[dict]) -> dict[str, int]:
    """Defeitos nos eventos da receita, no lugar: 5% das compras perdem o transaction_id, outros 5%
    ficam com valor 0, e entram reembolsos órfãos (de uma transação que não existe) na mesma conta.
    O reembolso de uma compra estragada também fica órfão na Silver (efeito em cascata)."""
    compras = [e for e in eventos if e["event_name"] == "purchase"]
    n = math.ceil(len(compras) * TETO)
    rng.shuffle(compras)
    for e in compras[:n]:
        e["params"]["transaction_id"] = None
    for e in compras[n:2 * n]:
        e["params"]["value"] = 0
    reembolsos = [e for e in eventos if e["event_name"] == "refund"] or compras
    for _ in range(n):
        base = rng.choice(reembolsos)
        orfao = _clonar(rng, base, "refund", {**base["params"], "transaction_id": "T-" + f"{rng.getrandbits(64):016x}"})
        orfao["items"] = copy.deepcopy(base["items"])
        eventos.append(orfao)
    return {"compra_sem_transacao": n, "valor_zerado": len(compras[n:2 * n]), "reembolso_orfao": n}
