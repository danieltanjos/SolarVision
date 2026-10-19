import gold_mapa_calor as mc
from tests.pipeline.fabrica import jornada, silver_de


def _eventos(spark):
    def home(pessoa, passos):
        return jornada(pessoa, 0, [(n, dict(p, _tela="/app/home") if p else {"_tela": "/app/home"}) for n, p in passos],
                       user_id=f"u-{pessoa}")

    return silver_de(spark, [
        *home("a", [("page_view", None), ("scroll", {"percent_scrolled": 25}), ("scroll", {"percent_scrolled": 50}),
                    ("click", {"link_id": "nav_monitoramento", "element_id": "nav-monitoramento"}),
                    ("click", {"link_id": "nav_monitoramento", "element_id": "nav-monitoramento"})]),
        *home("b", [("page_view", None), ("scroll", {"percent_scrolled": 25}),
                    ("view_alerts", {"unread": 1, "element_id": "btn-alertas"})]),
        *home("c", [("page_view", None)]),
        *home("d", [("page_view", None), ("click", {"link_id": "nav_cadastro"})]),       # sem element_id: fora
    ])


def test_cliques_por_elemento_com_taxa_e_intensidade(spark):
    linhas = {r.element_id: r for r in mc.mapa_calor_cliques(_eventos(spark)).collect()}
    assert set(linhas) == {"nav-monitoramento", "btn-alertas"}
    nav = linhas["nav-monitoramento"]
    assert (nav.pagina, nav.cliques, nav.sessoes, nav.sessoes_na_pagina, nav.taxa_clique, nav.intensidade) == \
        ("/app/home", 2, 1, 4, 0.25, 1.0)
    assert linhas["btn-alertas"].intensidade == 0.5


def test_colunas_com_os_nomes_exatos_do_r11(spark):
    eventos = _eventos(spark)
    assert mc.mapa_calor_cliques(eventos).columns == [
        "pagina", "element_id", "cliques", "sessoes", "sessoes_na_pagina", "taxa_clique", "intensidade"]
    assert mc.mapa_calor_rolagem(eventos).columns == ["pagina", "marco", "sessoes_que_chegaram", "pct_sessoes"]


def test_rolagem_por_marco(spark):
    linhas = {r.marco: (r.sessoes_que_chegaram, r.pct_sessoes)
              for r in mc.mapa_calor_rolagem(_eventos(spark)).collect() if r.pagina == "/app/home"}
    assert linhas == {0: (4, 1.0), 25: (2, 0.5), 50: (1, 0.25), 75: (0, 0.0), 90: (0, 0.0)}
