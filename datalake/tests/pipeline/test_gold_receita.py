import gold_receita as rc
from gold_funil import TODOS
from tests.pipeline.fabrica import evento, jornada, silver_de

DIA = 24 * 60     # minutos


def _plano(plano, preco):
    return [{"item_id": plano, "item_category": "plano", "price": preco, "quantity": 1}]


def _compra(pseudo, minutos, transacao, plano, valor, pagamento="cartao", **contexto):
    return evento(f"{pseudo}-{transacao}", "purchase", minutos, pseudo=pseudo, user_id=f"u-{pseudo}",
                  tela="/app/planos", items=_plano(plano, valor),
                  params={"transaction_id": transacao, "plano": plano, "value": valor, "payment_type": pagamento},
                  **contexto)


def _eventos(spark):
    return silver_de(spark, [
        # a (indicação): cadastra no dia 0 e assina o mensal no Pix no dia 2, pela sessão direta
        *jornada("a", 0, [("page_view", {"_tela": "/register"}), ("sign_up", {"method": "email"})],
                 source="indicacao", medium="referral"),
        evento("a-pv", "page_view", 2 * DIA, pseudo="a", user_id="u-a", tela="/app/planos",
               source="direct", medium="(none)"),
        evento("a-co", "begin_checkout", 2 * DIA + 1, pseudo="a", user_id="u-a", tela="/app/planos",
               params={"plano": "pro_mensal", "value": 19.9}, source="direct", medium="(none)"),
        _compra("a", 2 * DIA + 2, "T-a", "pro_mensal", 18.91, "pix", source="direct", medium="(none)"),
        # b (instagram): cadastra e assina o anual na mesma sessão; pede reembolso no dia 3
        *jornada("b", 0, [("page_view", {"_tela": "/register"}), ("sign_up", {"method": "email"})],
                 source="instagram", medium="social"),
        _compra("b", 2, "T-b", "pro_anual", 199.0, source="instagram", medium="social"),
        evento("b-rf", "refund", 3 * DIA, pseudo="b", user_id="u-b", tela="/app/configuracoes",
               params={"transaction_id": "T-b", "value": 199.0}, items=_plano("pro_anual", 199.0)),
        # c (instagram): cadastra, vê os planos, começa o checkout e desiste
        *jornada("c", 0, [("page_view", {"_tela": "/register"}), ("sign_up", {"method": "email"}),
                          ("page_view", {"_tela": "/app/planos"}),
                          ("begin_checkout", {"plano": "pro_mensal", "value": 19.9, "_tela": "/app/planos"})],
                 source="instagram", medium="social"),
    ])


def test_compras_tem_plano_canal_da_sessao_e_reembolso_atribuido(spark):
    linhas = {r.transaction_id: r for r in rc.compras(_eventos(spark)).collect()}
    assert set(linhas) == {"T-a", "T-b"}
    assert (linhas["T-a"].plano, linhas["T-a"].canal, linhas["T-a"].reembolsado) == ("pro_mensal", "direct / (none)", 0)
    assert (linhas["T-b"].plano, linhas["T-b"].reembolsado) == ("pro_anual", 199.0)


def test_receita_diaria_bruta_reembolsada_liquida_e_ticket(spark):
    linhas = {(str(r.data), r.plano): r for r in rc.receita_diaria(rc.compras(_eventos(spark))).collect()}
    anual = linhas[("2026-09-01", "pro_anual")]
    assert (anual.receita_bruta, anual.receita_reembolsada, anual.receita_liquida) == (199.0, 199.0, 0.0)
    mensal = linhas[("2026-09-03", "pro_mensal")]          # a receita fica na data da compra
    assert (mensal.pedidos, mensal.receita_liquida, mensal.ticket_medio) == (1, 18.91, 18.91)


def test_taxa_reembolso_por_plano_canal_e_no_total(spark):
    linhas = {(r.plano, r.canal): r for r in rc.taxa_reembolso(rc.compras(_eventos(spark))).collect()}
    assert (linhas[(TODOS, TODOS)].pedidos, linhas[(TODOS, TODOS)].taxa_reembolso) == (2, 0.5)
    assert linhas[("pro_anual", TODOS)].taxa_reembolso == 1.0
    assert linhas[(TODOS, "instagram / social")].receita_liquida == 0.0
    assert linhas[("pro_mensal", "direct / (none)")].pedidos_reembolsados == 0


def test_adesao_ao_plano_anual_e_ao_pix(spark):
    total = {r.canal: r for r in rc.adesao_plano_anual(rc.compras(_eventos(spark))).collect()}[TODOS]
    assert (total.pedidos, total.taxa_adesao_anual, total.taxa_pix) == (2, 0.5, 0.5)


def test_cadastro_para_compra_conta_dias_ate_a_primeira_compra(spark):
    eventos = _eventos(spark)
    linhas = {r.canal: r for r in rc.cadastro_para_compra(eventos, rc.compras(eventos)).collect()}
    assert (linhas[TODOS].pessoas, linhas[TODOS].compraram) == (3, 2)
    assert linhas["instagram / social"].taxa_compra == 0.5
    # sign_up no minuto 1, compra em 2 dias e 2 min: (2·1440 + 1) min ÷ 1440
    assert linhas["indicacao / referral"].mediana_dias == round((2 * DIA + 1) / DIA, 3)


def test_funil_da_assinatura_por_sessao(spark):
    linhas = {(r.canal, r.etapa): r for r in rc.funil_assinatura(_eventos(spark)).collect()}
    assert [linhas[(TODOS, e)].sessoes for e in rc.ETAPAS] == [2, 2, 2]
    # a compra de b não passou pela tela de planos: conta assim mesmo (qualquer momento)
    insta = [linhas[("instagram / social", e)] for e in rc.ETAPAS]
    assert [r.sessoes for r in insta] == [1, 1, 1]
    assert linhas[("direct / (none)", "purchase")].conversao_topo == 1.0
