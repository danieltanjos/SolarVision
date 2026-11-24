import gold_ml
from tests.pipeline.fabrica import jornada, silver_de

ATIVA = [("page_view", None), ("scroll", {"percent_scrolled": 50}), ("click", {"link_id": "nav_cadastro"}),
         ("page_view", {"_tela": "/app/cadastro"}), ("create_group", {"group_id": 1}),
         ("create_panel", {"panel_id": 1, "group_id": 1, "potencia_wp": 550}),
         ("click", {"link_id": "nav_home"}), ("click", {"link_id": "nav_monitoramento"})]
OLHA = [("page_view", None), ("view_alerts", {"unread": 1})]


def _ativa(pessoa, inicio, group_id, panel_id):
    passos = [(n, dict(p, group_id=group_id) if n == "create_group" else
               dict(p, panel_id=panel_id, group_id=group_id) if n == "create_panel" else
               dict(p) if p else None) for n, p in ATIVA]
    return jornada(pessoa, inicio, passos, user_id=f"u-{pessoa}")


def test_features_param_no_primeiro_evento_de_cadastro_sem_vazamento(spark):
    eventos = silver_de(spark, [*_ativa("a", 0, 7, 70), *jornada("a", 120, OLHA, user_id="u-a")])
    linhas = sorted(gold_ml.base_propensao(eventos).collect(), key=lambda r: r.sessao_inicio)
    primeira, segunda = linhas
    # antes do create_group: page_view, scroll, clique e o page_view do Cadastro (os 2 cliques depois não contam)
    assert (primeira.eventos_antes, primeira.cliques, primeira.viu_cadastro, primeira.rotulo) == (4, 1, 1, 1)
    assert primeira.scroll_maximo == 50 and primeira.sessoes_anteriores == 0
    assert (segunda.rotulo, segunda.sessoes_anteriores, segunda.ja_ativou_antes, segunda.abriu_alertas) == (0, 1, 1, 1)
    assert not set(gold_ml.FEATURES) & {"create_group", "create_panel", "rotulo"}


def test_propensao_treina_e_mede_no_teste(spark):
    eventos = []
    for i in range(60):
        if i % 2:
            eventos += _ativa(f"p{i}", i * 100, 1000 + i, 2000 + i)
        else:
            eventos += jornada(f"p{i}", i * 100, OLHA, user_id=f"u-p{i}")
    tabela, metricas = gold_ml.propensao(silver_de(spark, eventos))
    m = metricas.first()
    assert m.sessoes_treino + m.sessoes_teste == 60 and m.sessoes_teste > 0
    assert 0.0 <= m.auc <= 1.0 and m.positivos_teste > 0
    assert m.features == list(gold_ml.FEATURES)
    conjuntos = {r.pessoa: r.conjunto for r in tabela.collect()}
    assert set(conjuntos.values()) == {"treino", "teste"}
    assert all(0.0 <= r.probabilidade <= 1.0 for r in tabela.collect())


def test_segmentos_separam_perfis_diferentes(spark):
    eventos = []
    for i in range(8):        # quem monitora e tira relatório todo dia
        for dia in range(3):
            eventos += jornada(f"m{i}", dia * 1440, [("page_view", None), ("view_monitoring", {"view": "dia"}),
                                                     ("generate_report", {"report_month": "2026-08", "scope": "todas"})],
                               user_id=f"u-m{i}")
    for i in range(8):        # quem só passou pela tela inicial uma vez
        eventos += jornada(f"v{i}", 0, [("page_view", None)], user_id=f"u-v{i}")
    linhas = gold_ml.segmentos(silver_de(spark, eventos)).collect()
    grupos = {r.pessoa: r.segmento for r in linhas}
    assert len({grupos[f"u-m{i}"] for i in range(8)}) == 1
    assert grupos["u-m0"] != grupos["u-v0"]
    assert linhas[0].silhueta > 0.5 and 2 <= linhas[0].k <= 6


def test_pouco_dado_real_nao_derruba_o_job(spark):
    # duas pessoas, ninguém ativou: sem as duas classes, a propensão grava as métricas com o motivo
    eventos = silver_de(spark, [*jornada("a", 0, OLHA, user_id="u-a"), *jornada("b", 5, OLHA, user_id="u-b")])
    tabela, metricas = gold_ml.propensao(eventos)
    m = metricas.first()
    assert tabela.count() == 0 and tabela.columns == list(gold_ml.COLUNAS_PROPENSAO)
    assert m.auc is None and "não ativaram" in m.motivo
    segmentos = gold_ml.segmentos(eventos).collect()
    assert {(r.segmento, r.k, r.silhueta) for r in segmentos} == {(0, 1, None)}


def test_com_dado_suficiente_nao_ha_motivo(spark):
    eventos = []
    for i in range(60):
        eventos += _ativa(f"q{i}", i * 100, 3000 + i, 4000 + i) if i % 2 else jornada(f"q{i}", i * 100, OLHA, user_id=f"u-q{i}")
    _, metricas = gold_ml.propensao(silver_de(spark, eventos))
    assert metricas.first().motivo is None
