import gold_aquisicao as aq
from gold_funil import TODOS
from tests.pipeline.fabrica import jornada, silver_de

DIA = 24 * 60     # minutos


def _eventos(spark):
    return silver_de(spark, [
        # a (indicação): cadastra no dia 0, ativa 1 dia e meio depois, volta no dia 8 e exclui a única placa
        *jornada("a", 0, [("page_view", {"_tela": "/register"}), ("sign_up", {"method": "email"})],
                 source="indicacao", medium="referral"),
        *jornada("a", 1.5 * DIA, [("page_view", None),
                                  ("create_panel", {"panel_id": 10, "group_id": 7, "potencia_wp": 550})],
                 user_id="u-a"),
        *jornada("a", 8 * DIA, [("page_view", None), ("delete_panel", {"panel_id": 10, "group_id": 7})],
                 user_id="u-a"),
        # b (instagram): cadastra no dia 0, ativa na hora com duas placas e exclui só uma
        *jornada("b", 0, [("page_view", {"_tela": "/register"}), ("sign_up", {"method": "email"}),
                          ("create_panel", {"panel_id": 20, "group_id": 8, "potencia_wp": 400}),
                          ("create_panel", {"panel_id": 21, "group_id": 8, "potencia_wp": 400}),
                          ("delete_panel", {"panel_id": 20, "group_id": 8})],
                 source="instagram", medium="social"),
        # c (instagram): cadastra no dia 10 e não ativa
        *jornada("c", 10 * DIA, [("page_view", {"_tela": "/register"}), ("sign_up", {"method": "email"})],
                 source="instagram", medium="social"),
    ])


def test_ativacao_e_os_dias_ate_a_primeira_placa(spark):
    pessoas = {r.pessoa: r for r in aq.com_ativacao(_eventos(spark)).collect()}
    assert pessoas["u-a"].dias_ate_ativar == 1.5                         # sign_up e placa no 2º passo
    assert pessoas["u-c"].ativado_em is None


def test_cadastro_para_ativacao_total_e_por_canal(spark):
    linhas = {r.canal: r for r in aq.cadastro_para_ativacao(aq.com_ativacao(_eventos(spark))).collect()}
    assert (linhas[TODOS].pessoas, linhas[TODOS].ativaram) == (3, 2)
    assert linhas["instagram / social"].taxa_ativacao == 0.5
    assert linhas["indicacao / referral"].mediana_dias == 1.5


def test_retencao_so_conta_quem_teve_tempo_de_voltar(spark):
    eventos = _eventos(spark)
    linhas = {(r.canal, r.dia): r for r in aq.retencao(aq.com_ativacao(eventos), eventos).collect()}
    # último evento ~dia 10: em D7 só a e b são elegíveis (c se cadastrou no dia 10)
    assert (linhas[(TODOS, 7)].elegiveis, linhas[(TODOS, 7)].retidos) == (2, 1)
    assert (linhas[(TODOS, 1)].elegiveis, linhas[(TODOS, 1)].retidos) == (2, 1)
    assert (TODOS, 14) not in linhas or linhas[(TODOS, 14)].elegiveis == 0


def test_abandono_e_excluir_todas_as_placas_criadas(spark):
    eventos = _eventos(spark)
    linhas = {r.canal: r for r in aq.taxa_abandono(aq.com_ativacao(eventos), eventos).collect()}
    assert (linhas[TODOS].ativaram, linhas[TODOS].abandonaram) == (2, 1)
    assert linhas["indicacao / referral"].taxa_abandono == 1.0
    assert linhas["instagram / social"].abandonaram == 0
