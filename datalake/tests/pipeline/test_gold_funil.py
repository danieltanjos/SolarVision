import gold_funil
from tests.pipeline.fabrica import jornada, silver_de


def _eventos(spark):
    return silver_de(spark, [
        # a: cadastra, ativa e monitora (indicação, desktop)
        *jornada("a", 0, [("page_view", {"_tela": "/register"}), ("sign_up", {"method": "email"}),
                          ("create_group", {"group_id": 7}),
                          ("create_panel", {"panel_id": 10, "group_id": 7, "potencia_wp": 550}),
                          ("view_monitoring", {"view": "dia"})],
                 source="indicacao", medium="referral", device="desktop"),
        # b: cadastra e para no grupo (instagram, mobile)
        *jornada("b", 0, [("page_view", {"_tela": "/register"}), ("sign_up", {"method": "email"}),
                          ("create_group", {"group_id": 8})],
                 source="instagram", medium="social", device="mobile"),
        # c: só cria a conta (instagram, mobile); d: abre o login e desiste
        *jornada("c", 0, [("page_view", {"_tela": "/register"}), ("sign_up", {"method": "email"})],
                 source="instagram", medium="social", device="mobile"),
        *jornada("d", 0, [("page_view", {"_tela": "/login"})], source="instagram", medium="social"),
        # e: usuário antigo, só login e monitoramento: fora do funil de ativação
        *jornada("e", 0, [("page_view", {"_tela": "/login"}), ("login", {"method": "email"}),
                          ("view_monitoring", {"view": "dia"})], source="direct", medium="(none)"),
    ])


def test_funil_de_ativacao_conta_pessoas_com_sign_up_por_etapa(spark):
    linhas = gold_funil.funil_ativacao(_eventos(spark)).collect()
    total = {r.etapa: r for r in linhas if r.canal == gold_funil.TODOS}
    assert [total[e].pessoas for e in gold_funil.ETAPAS] == [3, 2, 1, 1, 0, 0, 0]
    assert total["create_group"].conversao_etapa_anterior == round(2 / 3, 4)
    assert total["create_panel"].conversao_topo == round(1 / 3, 4)
    assert total["sign_up"].conversao_etapa_anterior is None
    assert total["import_readings"].conversao_etapa_anterior == 0.0
    assert total["register_cleaning"].conversao_etapa_anterior is None       # 0 ÷ 0: nulo, sem erro


def test_funil_de_ativacao_por_canal_e_dispositivo(spark):
    linhas = gold_funil.funil_ativacao(_eventos(spark)).collect()
    insta = {r.etapa: r.pessoas for r in linhas if r.canal == "instagram / social" and r.dispositivo == "mobile"}
    assert insta["sign_up"] == 2 and insta["create_group"] == 1 and insta["create_panel"] == 0
    assert not any(r.canal == "direct / (none)" for r in linhas)                # sem sign_up: fora


def test_funil_login_por_canal(spark):
    linhas = {r.canal: r for r in gold_funil.funil_login(_eventos(spark)).collect()}
    assert (linhas["instagram / social"].sessoes_tela_entrada, linhas["instagram / social"].sessoes_entraram) == (3, 2)
    assert linhas[gold_funil.TODOS].sessoes_tela_entrada == 5
    assert linhas[gold_funil.TODOS].sessoes_entraram == 4
    assert linhas[gold_funil.TODOS].taxa_entrada == 0.8
