import gold_engajamento as eng
from tests.pipeline.fabrica import evento, silver_de


def _eventos(spark):
    return silver_de(spark, [
        evento("a1", "page_view", 0, tela="/app/home", user_id="u-a"),
        evento("a2", "scroll", 1, tela="/app/home", user_id="u-a", params={"percent_scrolled": 50}),
        evento("a3", "click", 2, tela="/app/home", user_id="u-a",
               params={"link_id": "nav_monitoramento", "outbound": False}),
        evento("a4", "page_view", 3, tela="/app/monitoramento", user_id="u-a"),
        evento("a5", "site_search", 4, tela="/app/monitoramento", user_id="u-a",
               params={"search_term": " Bateria ", "search_results": 0, "search_area": "seletor"}),
        evento("a6", "click", 5, tela="/app/monitoramento", user_id="u-a",
               params={"link_domain": "open-meteo.com", "outbound": True}),
        evento("a7", "create_panel", 6, tela="/app/cadastro", user_id="u-a",
               params={"panel_id": 10, "group_id": 7, "potencia_wp": 550}),
        evento("b1", "page_view", 0, pseudo="anon-2", tela="/app/home", device="mobile"),
        evento("b2", "site_search", 1, pseudo="anon-2", tela="/app/home",
               params={"search_term": "bateria", "search_results": 0}),
        evento("b3", "site_search", 2, pseudo="anon-2", tela="/app/home",
               params={"search_term": "casa", "search_results": 1}),
        evento("b4", "file_download", 3, pseudo="anon-2", tela="/app/relatorio",
               params={"file_name": "relatorio-2026-08.pdf", "file_extension": "pdf", "report_month": "2026-08"}),
    ])


def test_sessoes_resume_cada_visita(spark):
    linhas = {r.pessoa: r for r in eng.sessoes(_eventos(spark)).collect()}
    a = linhas["u-a"]
    assert (a.eventos, a.duracao_seg, a.telas_distintas, a.scroll_maximo, a.ativou) == (7, 360, 2, 50, True)
    assert (a.canal, a.dispositivo) == ("google / organic", "desktop")
    assert linhas["anon-2"].ativou is False and linhas["anon-2"].dispositivo == "mobile"


def test_uso_telas_mede_tempo_ate_a_tela_seguinte(spark):
    telas = {r.pagina: r for r in eng.uso_telas(_eventos(spark)).collect()}
    assert telas["/app/home"].visualizacoes == 2 and telas["/app/home"].sessoes == 2
    # home de "a": 3 min até o monitoramento; home de "b": 3 min até o último evento dela
    assert telas["/app/home"].tempo_medio_seg == 180.0
    assert telas["/app/home"].scroll_medio == 25.0                  # 50 numa visita, 0 na outra
    assert telas["/app/monitoramento"].tempo_medio_seg == 180.0      # última tela: até o último evento


def test_buscas_normaliza_o_termo_e_conta_as_sem_resultado(spark):
    buscas = {r.termo: r for r in eng.buscas_seletor(_eventos(spark)).collect()}
    assert (buscas["bateria"].buscas, buscas["bateria"].buscas_sem_resultado, buscas["bateria"].pessoas) == (2, 2, 2)
    assert buscas["casa"].buscas_sem_resultado == 0


def test_saidas_e_relatorios_impressos(spark):
    linhas = {(r.tipo, r.alvo): r.total for r in eng.saidas_downloads(_eventos(spark)).collect()}
    assert linhas == {("saida", "open-meteo.com"): 1, ("relatorio_impresso", "2026-08"): 1}
