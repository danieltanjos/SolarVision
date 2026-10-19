from collections import defaultdict

from gerador import catalogo as cat


def _por_pseudo(eventos):
    grupos = defaultdict(list)
    for e in eventos:
        grupos[e["user_pseudo_id"]].append(e)
    for evs in grupos.values():
        evs.sort(key=lambda e: e["event_ts"])
    return grupos


def _por_usuario(eventos):
    grupos = defaultdict(list)
    for e in eventos:
        if e["user_id"]:
            grupos[e["user_id"]].append(e)
    for evs in grupos.values():
        evs.sort(key=lambda e: e["event_ts"])
    return grupos


def test_todos_os_eventos_do_catalogo_aparecem(simulacao):
    eventos, _ = simulacao
    assert {e["event_name"] for e in eventos} == set(cat.EVENTOS)


def test_catalogo_tem_20_eventos_e_o_funil_esta_nele():
    assert len(cat.EVENTOS) == len(set(cat.EVENTOS)) == 20
    assert set(cat.FUNIL_ATIVACAO) <= set(cat.EVENTOS)


def test_toda_jornada_comeca_com_page_view(simulacao):
    for evs in _por_pseudo(simulacao[0]).values():
        assert evs[0]["event_name"] == "page_view"


def test_paginas_sao_as_telas_do_app(simulacao):
    telas = set(cat.PAGINAS.values())
    for e in simulacao[0]:
        assert e["page"]["location"] in telas


def test_user_id_so_aparece_a_partir_do_sign_up_ou_login(simulacao):
    """Num navegador novo, o primeiro evento com user_id é sign_up ou login (ou a volta já logado)."""
    casos = 0
    for evs in _por_pseudo(simulacao[0]).values():
        logados = [i for i, e in enumerate(evs) if e["user_id"]]
        if not logados or logados[0] == 0:
            continue
        casos += 1
        primeiro = evs[logados[0]]
        assert primeiro["event_name"] in ("sign_up", "login")
        assert all(e["user_id"] is None for e in evs[:logados[0]])
    assert casos > 0


def test_mesma_pessoa_aparece_em_mais_de_um_navegador(simulacao):
    """O identity stitching (R9) tem o que costurar: user_id com dois user_pseudo_id."""
    pseudos = defaultdict(set)
    for e in simulacao[0]:
        if e["user_id"]:
            pseudos[e["user_id"]].add(e["user_pseudo_id"])
    assert any(len(p) > 1 for p in pseudos.values())


def test_placa_criada_cita_um_grupo_criado_antes_ou_antigo(simulacao):
    grupos = {}
    for evs in _por_usuario(simulacao[0]).values():
        for e in evs:
            if e["event_name"] == "create_group":
                grupos[e["params"]["group_id"]] = e["event_ts"]
            elif e["event_name"] == "create_panel":
                g = e["params"]["group_id"]
                assert g < cat.ID_INICIAL_NOVOS or grupos[g] <= e["event_ts"]
                assert e["params"]["potencia_wp"] in cat.POTENCIAS_WP
                assert e["items"][0]["item_id"] == f"placa-{e['params']['panel_id']}"


def test_exclusoes_de_placas_antigas_existem_e_nao_tem_create(simulacao):
    """Armadilha: usuários antigos excluem placas criadas antes do rastreamento (exclusão "órfã" legítima)."""
    criadas = {e["params"]["panel_id"] for e in simulacao[0] if e["event_name"] == "create_panel"}
    excluidas = [e["params"]["panel_id"] for e in simulacao[0] if e["event_name"] == "delete_panel"]
    assert excluidas
    assert all(p >= cat.ID_INICIAL_NOVOS for p in criadas)
    assert any(p < cat.ID_INICIAL_NOVOS and p not in criadas for p in excluidas)


def test_ativacao_e_maior_por_indicacao_que_pelo_instagram(simulacao):
    eventos, _ = simulacao
    canal_do_cadastro, ativados = {}, set()
    for e in eventos:
        if e["event_name"] == "sign_up":
            canal_do_cadastro[e["user_id"]] = (e["traffic"]["source"], e["traffic"]["medium"])
        elif e["event_name"] == "create_panel":
            ativados.add(e["user_id"])
    n, a = defaultdict(int), defaultdict(int)
    for uid, canal in canal_do_cadastro.items():
        n[canal] += 1
        a[canal] += uid in ativados
    indicacao, insta = ("indicacao", "referral"), ("instagram", "social")
    assert n[indicacao] and n[insta]
    assert a[indicacao] / n[indicacao] > a[insta] / n[insta]


def test_funil_de_ativacao_afunila(simulacao):
    pessoas = {nome: {e["user_id"] for e in simulacao[0] if e["event_name"] == nome}
               for nome in cat.FUNIL_ATIVACAO}
    novos = pessoas["sign_up"]
    contagens = [len(pessoas[nome] & novos) for nome in cat.FUNIL_ATIVACAO]
    assert contagens[0] > contagens[2] > contagens[-1] > 0


def test_session_hint_muda_mais_vezes_que_as_sessoes(simulacao):
    eventos, sessoes = simulacao
    assert len({e["session_hint"] for e in eventos}) > sessoes


def test_marcos_de_scroll_sao_os_do_contrato(simulacao):
    for e in simulacao[0]:
        if e["event_name"] == "scroll":
            assert e["params"]["percent_scrolled"] in (25, 50, 75, 90)


def test_busca_sem_resultado_existe(simulacao):
    buscas = [e for e in simulacao[0] if e["event_name"] == "site_search"]
    assert any(e["params"]["search_results"] == 0 for e in buscas)
    assert any(e["params"]["search_results"] > 0 for e in buscas)


def test_nenhum_dado_pessoal_nos_eventos(simulacao):
    proibidas = {"email", "nome", "latitude", "longitude", "tarifa_kwh", "senha"}
    for e in simulacao[0]:
        assert not proibidas & set(e["params"])


def test_simular_e_deterministico():
    from datetime import datetime, timezone

    from gerador.jornadas import simular

    data = datetime(2026, 9, 1, tzinfo=timezone.utc)
    a, _, _ = simular(seed=3, dias=3, visitantes=50, data_inicial=data)
    b, _, _ = simular(seed=3, dias=3, visitantes=50, data_inicial=data)
    assert a == b
