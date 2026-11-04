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


DIA = 24 * 60


def _uso_em_dias(spark):
    """a usa nos dias 1, 2 e 3; b no dia 1 e volta no dia 9; c só aparece no dia 3."""
    return silver_de(spark, [
        evento("a1", "view_monitoring", 0, pseudo="pa", user_id="u-a", params={"view": "dia"}),
        evento("a2", "view_monitoring", DIA, pseudo="pa", user_id="u-a", params={"view": "semana"}),
        evento("a3", "page_view", 2 * DIA, pseudo="pa", user_id="u-a"),
        evento("b1", "view_monitoring", 10, pseudo="pb", user_id="u-b", params={"view": "dia"}),
        evento("b2", "view_alerts", 8 * DIA, pseudo="pb", user_id="u-b"),
        evento("c1", "page_view", 2 * DIA + 5, pseudo="pc", user_id="u-c"),
    ])


def test_adocao_de_recursos_sobre_as_pessoas_ativas(spark):
    linhas = {r.evento: r for r in eng.adocao_recursos(_uso_em_dias(spark)).collect()}
    assert len(linhas) == len(eng.RECURSOS)                         # todos os recursos, mesmo sem uso
    mon = linhas["view_monitoring"]
    assert (mon.pessoas_ativas, mon.pessoas_que_usaram, mon.usos) == (3, 2, 3)
    assert mon.taxa_adocao == round(2 / 3, 4)
    assert mon.usos_por_pessoa == 1.5 and mon.dias_de_uso_por_pessoa == 1.5
    relatorio = linhas["generate_report"]
    assert (relatorio.pessoas_que_usaram, relatorio.taxa_adocao, relatorio.usos_por_pessoa) == (0, 0.0, None)


def test_atividade_diaria_com_janelas_moveis(spark):
    linhas = {r.data.day: r for r in eng.atividade_diaria(_uso_em_dias(spark)).collect()}
    assert sorted(linhas) == list(range(1, 10))                     # dias sem uso também aparecem
    assert [linhas[d].dau for d in range(1, 10)] == [2, 1, 2, 0, 0, 0, 0, 0, 1]
    assert (linhas[8].wau, linhas[9].wau, linhas[9].mau) == (2, 3, 3)
    assert linhas[9].aderencia_dau_mau == round(1 / 3, 4)
    assert not any(r.janela_completa for r in linhas.values())      # só 9 dias: o mês ainda não fechou
    assert [d for d in linhas if not linhas[d].dia_completo] == [9]   # o último dia ainda está em andamento
