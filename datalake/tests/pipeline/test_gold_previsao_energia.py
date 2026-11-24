from datetime import date, datetime, timedelta

import pytest

import gold_previsao_energia as gp

INICIO = date(2026, 1, 1)


def _tabelas(spark, dias=60, chuva_no_dia=None, razao=0.9, previsao_a_partir=None):
    """Uma placa de 1000 Wp com um dia por linha (uma hora de clima basta para as agregações)."""
    horas, medidos = [], []
    for i in range(dias):
        dia = INICIO + timedelta(days=i)
        prev = previsao_a_partir is not None and i >= previsao_a_partir
        chuva = 8.0 if chuva_no_dia == i else 0.0
        horas.append(("p1", "ufsc", datetime(dia.year, dia.month, dia.day, 15), dia, 800.0, 25.0, chuva, prev, 1000.0, None, 60))
        if not prev:
            medidos.append(("p1", dia, 1000.0 * (razao + (0.2 if i == 45 else 0.0)), True))
    hs = spark.createDataFrame(horas, "placa_id string, fonte string, data_hora timestamp, dia date, irradiancia double, "
                                      "temperatura double, precipitacao double, previsao boolean, estimada_wh double, "
                                      "real_wh double, cobertura_min long")
    ds = spark.createDataFrame(medidos, "placa_id string, dia date, real_wh double, completo boolean")
    ps = spark.createDataFrame([("p1", "ufsc", 1000.0, 20.0, 0.0, -0.4, date(2025, 1, 1), -27.4, -48.4)],
                               "placa_id string, fonte string, potencia_wp double, inclinacao double, azimute double, "
                               "coef_temperatura double, instalada_em date, latitude double, longitude double")
    ls = spark.createDataFrame([("p1", INICIO + timedelta(days=10))], "placa_id string, dia date")
    return hs, ds, ps, ls


def test_razao_ref_so_usa_a_janela_de_37_a_8_dias_antes(spark):
    tabela = {r.dia: r for r in gp.diaria(*_tabelas(spark)).collect()}
    # o dia 45 tem razão 1,1 (fora do padrão 0,9): só entra na referência de 53 a 82 dias, nunca antes
    assert tabela[INICIO + timedelta(days=53)].razao_ref == pytest.approx(0.9 + 0.2 / 30, abs=1e-3)
    assert tabela[INICIO + timedelta(days=52)].razao_ref == pytest.approx(0.9)
    sem_historico = tabela[INICIO + timedelta(days=12)]
    assert (sem_historico.tem_historico, sem_historico.razao_ref) == (0, 1.0)


def test_dias_desde_lavagem_contam_limpeza_e_chuva_que_lava(spark):
    tabela = {r.dia: r for r in gp.diaria(*_tabelas(spark, chuva_no_dia=20)).collect()}
    assert tabela[INICIO + timedelta(days=10)].dias_desde_lavagem == gp.LAVAGEM_MAXIMA_DIAS   # limpeza no próprio dia não conta ainda
    assert tabela[INICIO + timedelta(days=11)].dias_desde_lavagem == 1
    assert tabela[INICIO + timedelta(days=25)].dias_desde_lavagem == 5                        # a chuva do dia 20


def test_alvo_so_nos_dias_completos_e_a_previsao_vira_conjunto_proprio(spark):
    dados = gp.dividir(gp.diaria(*_tabelas(spark, dias=60, previsao_a_partir=55)))
    por_dia = {r.dia: r for r in dados.collect()}
    assert por_dia[INICIO + timedelta(days=5)].razao == pytest.approx(0.9)
    futuro = por_dia[INICIO + timedelta(days=57)]
    assert (futuro.conjunto, futuro.razao) == ("previsao", None)
    conjuntos = [r.conjunto for r in sorted(dados.collect(), key=lambda r: r.dia)]
    # menos de dois anos medidos: o teste é o último quinto, e o treino nunca fica vazio
    assert conjuntos[:45] == ["treino"] * 45 and conjuntos[45:55] == ["teste"] * 10


def test_erros_no_dia_na_semana_e_no_mes(spark):
    linhas = [("p1", INICIO + timedelta(days=i), (INICIO - date(2000, 1, 1)).days + i, 100.0, 110.0 if i % 2 else 90.0)
              for i in range(28)]
    df = spark.createDataFrame(linhas, "placa_id string, dia date, n int, real_wh double, prev double")
    assert gp.erros(df, "prev") == {"nmae_dia": 0.1, "nmae_semana": pytest.approx(0.0, abs=0.04), "mape_mes": 0.0}
