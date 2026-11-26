from datetime import date

import exportar_bi


def test_linhas_convertem_datas_para_texto(spark):
    df = spark.createDataFrame([(date(2026, 9, 1), "a", 2)], "data date, canal string, novos int")
    assert exportar_bi.linhas(df) == [{"data": "2026-09-01", "canal": "a", "novos": 2}]


def test_resumo_da_propensao_por_faixa_so_no_teste(spark):
    df = spark.createDataFrame(
        [("teste", 1, 0.95), ("teste", 0, 0.91), ("teste", 0, 0.05), ("treino", 1, 0.99), ("teste", 1, 1.0)],
        "conjunto string, rotulo int, probabilidade double")
    faixas = {r["faixa"]: (r["sessoes"], r["taxa_real"]) for r in exportar_bi.linhas(exportar_bi.resumo_propensao(df))}
    assert faixas == {0.0: (1, 0.0), 0.9: (3, round(2 / 3, 4))}


def test_resumo_dos_segmentos_nao_leva_pessoas(spark):
    df = spark.createDataFrame([("u-1", 0, 2, 2, 0.7, 3.0), ("u-2", 0, 2, 2, 0.7, 3.0), ("u-3", 1, 1, 2, 0.7, 1.0)],
                               "pessoa string, segmento int, pessoas_no_segmento long, k int, silhueta double, "
                               "media_sessoes double")
    linhas = exportar_bi.linhas(exportar_bi.resumo_segmentos(df))
    assert [r["segmento"] for r in linhas] == [0, 1]
    assert all("pessoa" not in r for r in linhas)


def test_qualidade_exporta_so_a_execucao_mais_recente(spark):
    from datetime import datetime
    antiga, nova = datetime(2026, 10, 1), datetime(2026, 10, 2)
    df = spark.createDataFrame(
        [(antiga, "taxa de rejeição", 0.2, "<= 0.1", False, True),
         (nova, "taxa de rejeição", 0.03, "<= 0.1", True, True),
         (nova, "taxa de duplicatas", 0.08, "<= 0.05", False, False)],
        "executado_em timestamp, regra string, valor double, limite string, ok boolean, bloqueante boolean")
    linhas = exportar_bi.linhas(exportar_bi.ultima_qualidade(df))
    assert [(r["regra"], r["ok"]) for r in linhas] == [("taxa de duplicatas", False), ("taxa de rejeição", True)]
    assert {r["executado_em"][:10] for r in linhas} == {"2026-10-02"}
