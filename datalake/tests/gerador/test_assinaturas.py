import random
from collections import defaultdict
from datetime import timedelta

import pytest

from gerador import catalogo as cat
from gerador.assinaturas import PAUSA_MAXIMA, sessoes, simular_assinaturas
from gerador.eventos import ler_iso


@pytest.fixture(scope="module")
def receita(simulacao):
    return simular_assinaturas(random.Random("receita-7"), simulacao[0])


def _por_nome(eventos, nome):
    return [e for e in eventos if e["event_name"] == nome]


def test_checkout_compra_e_reembolso_aparecem(receita):
    compras, reembolsos = _por_nome(receita, "purchase"), _por_nome(receita, "refund")
    assert len(_por_nome(receita, "begin_checkout")) > len(compras) > len(reembolsos) > 0
    assert {e["params"]["plano"] for e in compras} == {p["item_id"] for p in cat.PLANOS}


def test_uma_compra_por_pessoa_e_so_de_quem_monitora(simulacao, receita):
    compras = _por_nome(receita, "purchase")
    assert len({e["user_id"] for e in compras}) == len(compras)
    monitoram = {e["user_id"] for e in simulacao[0] if e["event_name"] == "view_monitoring"}
    assert {e["user_id"] for e in compras} <= monitoram


def test_valor_tem_o_desconto_do_pix_e_o_item_e_o_plano(receita):
    precos = {p["item_id"]: p["price"] for p in cat.PLANOS}
    for e in _por_nome(receita, "purchase"):
        p = e["params"]
        esperado = round(precos[p["plano"]] * (1 - cat.DESCONTO_PIX), 2) if p["payment_type"] == "pix" else precos[p["plano"]]
        assert p["value"] == esperado
        assert e["items"] == [{**e["items"][0], "item_id": p["plano"], "item_category": "plano", "price": esperado}]


def test_reembolso_cita_uma_compra_e_vem_ate_7_dias_depois(receita):
    compras = {e["params"]["transaction_id"]: e for e in _por_nome(receita, "purchase")}
    for e in _por_nome(receita, "refund"):
        compra = compras[e["params"]["transaction_id"]]
        assert e["user_id"] == compra["user_id"] and e["params"]["value"] == compra["params"]["value"]
        atraso = ler_iso(e["event_ts"]) - ler_iso(compra["event_ts"])
        assert timedelta(0) < atraso <= timedelta(days=cat.DIAS_ARREPENDIMENTO, hours=1)


def test_receita_continua_a_sessao_em_que_entra(simulacao, receita):
    """Cada evento novo fica a menos de 30 min do anterior do mesmo navegador: não abre sessão nova."""
    todos = sorted(simulacao[0] + receita, key=lambda e: (e["user_pseudo_id"], e["event_ts"]))
    anterior = {}
    for e in todos:
        if e["event_name"] in cat.EVENTOS_ASSINATURA:
            assert ler_iso(e["event_ts"]) - ler_iso(anterior[e["user_pseudo_id"]]["event_ts"]) <= PAUSA_MAXIMA
        anterior[e["user_pseudo_id"]] = e


def test_sessoes_quebram_por_navegador_e_por_pausa(simulacao):
    blocos = sessoes(simulacao[0])
    assert sum(map(len, blocos)) == len(simulacao[0])
    por_pseudo = defaultdict(int)
    for b in blocos:
        assert len({e["user_pseudo_id"] for e in b}) == 1
        por_pseudo[b[0]["user_pseudo_id"]] += 1
    assert max(por_pseudo.values()) > 1
