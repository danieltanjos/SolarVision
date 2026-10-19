import copy
import math
import random
from collections import Counter

from gerador.sujeira import ID_DA_ACAO, TIPOS, aplicar_sujeira


def test_total_de_defeitos_respeita_a_fracao_e_todos_os_tipos_aparecem(simulacao):
    eventos = copy.deepcopy(simulacao[0])
    n = len(eventos)
    contagem = aplicar_sujeira(random.Random(1), eventos, 0.03)
    assert set(contagem) == set(TIPOS)
    assert sum(contagem.values()) == round(n * 0.03)
    assert all(contagem[t] > 0 for t in TIPOS)
    assert len(eventos) == n + contagem["exclusao_orfa"] + contagem["evento_fora_catalogo"]


def test_exclusoes_orfas_ficam_limitadas_a_5_por_cento_dos_cadastros_de_placa(simulacao):
    eventos = copy.deepcopy(simulacao[0])
    placas = sum(1 for e in eventos if e["event_name"] == "create_panel")
    contagem = aplicar_sujeira(random.Random(1), eventos, 0.03)
    assert 0 < contagem["exclusao_orfa"] <= -(-placas * 5 // 100)


def test_cada_defeito_e_visivel_no_dado(simulacao):
    eventos = copy.deepcopy(simulacao[0])
    criadas = {e["params"]["panel_id"] for e in eventos if e["event_name"] == "create_panel"}
    aplicar_sujeira(random.Random(1), eventos, 0.03)
    assert any(e["event_ts"] is None for e in eventos)
    assert any(e["event_ts"] is not None and e["event_ts"] > "2030" for e in eventos)
    assert any(e["event_name"] in ID_DA_ACAO and e["params"][ID_DA_ACAO[e["event_name"]]] is None for e in eventos)
    assert any(e["event_name"] == "import_readings" and e["params"]["rows"] < 0 for e in eventos)
    assert any(e["event_name"] == "create_panel" and e["params"]["potencia_wp"] == 0 for e in eventos)
    assert any(e["event_name"] == "scroll" and e["params"]["percent_scrolled"] == 33 for e in eventos)
    assert any(e["event_name"] == "share_report" for e in eventos)
    assert any(e["event_name"] == "delete_panel" and (e["params"]["panel_id"] or 0) >= 900000
               and e["params"]["panel_id"] not in criadas for e in eventos)


def test_um_evento_recebe_no_maximo_um_defeito(simulacao):
    eventos = copy.deepcopy(simulacao[0])
    aplicar_sujeira(random.Random(1), eventos, 0.03)
    for e in eventos:
        p = e["params"]
        defeitos = [
            e["event_ts"] is None,
            e["event_ts"] is not None and e["event_ts"] > "2030",
            e["event_name"] == "create_panel" and p.get("potencia_wp") == 0,
            e["event_name"] == "import_readings" and (p.get("rows") or 0) < 0,
            e["event_name"] in ID_DA_ACAO and p.get(ID_DA_ACAO[e["event_name"]]) is None,
        ]
        assert sum(defeitos) <= 1


def test_fracao_zero_nao_altera_nada(simulacao):
    eventos = copy.deepcopy(simulacao[0])
    contagem = aplicar_sujeira(random.Random(1), eventos, 0.0)
    assert sum(contagem.values()) == 0
    assert eventos == simulacao[0]


def test_cada_nome_de_evento_recebe_no_maximo_5_por_cento_de_mutacoes(simulacao):
    eventos = copy.deepcopy(simulacao[0])
    antes = {e["event_id"]: copy.deepcopy(e) for e in eventos}
    total = Counter(e["event_name"] for e in eventos)
    aplicar_sujeira(random.Random(1), eventos, 0.03)
    mutados = Counter(e["event_name"] for e in eventos
                      if e["event_id"] in antes and e != antes[e["event_id"]])
    assert mutados
    for nome, n in mutados.items():
        assert n <= math.ceil(total[nome] * 0.05), nome
