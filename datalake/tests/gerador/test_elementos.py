import copy
import json
from datetime import datetime, timezone

import pytest

from gerador.elementos import ELEMENTOS, elemento, marcar_elementos
from gerador.gerar_eventos import gerar

DATA = datetime(2026, 9, 1, tzinfo=timezone.utc)
SEM_CLIQUE = {"page_view", "scroll", "view_monitoring", "generate_report"}


def _ev(nome, params=None, items=None):
    return {"event_name": nome, "params": params or {}, "items": items or []}


@pytest.mark.parametrize("evento, esperado", [
    (_ev("click", {"link_domain": "open-meteo.com", "outbound": True}), "saida-open-meteo"),
    (_ev("click", {"link_domain": "exemplo.com", "outbound": True}), None),
    (_ev("click", {"link_id": "nav_monitoramento", "outbound": False}), "nav-monitoramento"),
    (_ev("click", {"link_id": "cta_relatorio_mes", "outbound": False}), "cta-relatorio-mes"),
    (_ev("select_content", {"content_type": "visao", "content_id": "mes"}), "visao-mes"),
    (_ev("select_content", {"content_type": "placa", "content_id": "10"}), "seletor-placa"),
    (_ev("change_settings", {"setting": "tema"}), "cfg-tema"),
    (_ev("change_settings", {"setting": "xyz"}), None),
    (_ev("create_panel"), "btn-salvar-placa"),
    (_ev("delete_group"), "btn-excluir-grupo"),
    (_ev("site_search"), "busca-seletor"),
    (_ev("sign_up"), "btn-signup"),
    (_ev("page_view"), None),
    (_ev("view_monitoring"), None),
    (_ev("share_report"), None),
])
def test_elemento_segue_a_tabela_do_contrato(evento, esperado):
    assert elemento(evento) == esperado


def test_todo_id_produzido_esta_no_catalogo_de_elementos():
    assert "nav-cadastro" in ELEMENTOS and "visao-ano" in ELEMENTOS and "cfg-rastreamento" in ELEMENTOS
    assert all(i == i.lower() and " " not in i and "_" not in i for i in ELEMENTOS)


def test_gerador_marca_so_eventos_de_clique_e_nao_muda_o_resto():
    arquivos, resumo = gerar(seed=5, dias=5, visitantes=300, sujeira=0.03, data_inicial=DATA)
    eventos = [json.loads(l) for v in arquivos.values() for l in v.splitlines()]
    for e in eventos:
        eid = (e.get("params") or {}).get("element_id")
        if e["event_name"] in SEM_CLIQUE or e["event_name"] == "share_report":
            assert eid is None
        else:
            assert eid in ELEMENTOS, e
    assert resumo["linhas_gravadas"] == len(eventos)


def test_marcar_elementos_nao_muda_outros_campos():
    eventos = [_ev("create_group", {"group_id": 7}), _ev("page_view")]
    antes = copy.deepcopy(eventos)
    assert marcar_elementos(eventos) == 1
    assert eventos[0]["params"] == {"group_id": 7, "element_id": "btn-salvar-grupo"}
    assert eventos[1] == antes[1]
