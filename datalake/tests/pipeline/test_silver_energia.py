from datetime import datetime, timedelta

import pytest
from pyspark.sql import functions as F

import silver_energia as se

T0 = datetime(2026, 9, 1, 12, 0)          # 12h UTC = 9h em São Paulo
INGESTAO = datetime(2026, 10, 1)


def _df(spark, linhas, esquema):
    return spark.createDataFrame(linhas, esquema)


def _placas(spark, wp=1000.0):
    return _df(spark, [("p1", "ufsc", wp, 20.0, 0.0, -0.4, "2025-01-01", -27.4, -48.4, "a", INGESTAO)],
               "placa_id string, fonte string, potencia_wp double, inclinacao double, azimute double, "
               "coef_temperatura double, instalada_em string, latitude double, longitude double, "
               "arquivo_origem string, ingerido_em timestamp")


def test_potencia_estimada_e_a_formula_do_app(spark):
    df = _df(spark, [(1000.0, -0.4, 1000.0, 20.0), (1000.0, -0.4, 0.0, 20.0)], "wp double, g double, i double, t double")
    valores = [r.p for r in df.select(se.potencia_estimada(F.col("wp"), F.col("g"), F.col("i"), F.col("t")).alias("p")).collect()]
    # célula = 20 + 1000 × 25/800 = 51,25 °C; 1000 × 1 × 0,82 × (1 − 0,004 × 26,25)
    assert valores[0] == pytest.approx(1000 * 0.82 * (1 - 0.004 * 26.25))
    assert valores[1] == 0.0


def test_clima_observado_vale_mais_que_a_previsao_da_mesma_hora(spark):
    bronze = _df(spark, [("p1", T0, 500.0, 25.0, None, True, "b", INGESTAO + timedelta(days=1)),
                         ("p1", T0, 450.0, 24.0, 1.0, False, "a", INGESTAO)],
                 "placa_id string, data_hora timestamp, irradiancia double, temperatura double, precipitacao double, "
                 "previsao boolean, arquivo_origem string, ingerido_em timestamp")
    [linha] = se.clima(bronze).collect()
    assert (linha.irradiancia, linha.previsao, linha.precipitacao) == (450.0, False, 1.0)


def test_leituras_invalidas_saem_com_o_motivo(spark):
    leituras = _df(spark, [("p1", T0, 300.0, 5, "a", INGESTAO), ("p1", T0 + timedelta(minutes=5), -1.0, 5, "a", INGESTAO),
                           ("p1", T0 + timedelta(minutes=10), 5000.0, 5, "a", INGESTAO),
                           ("p9", T0, 100.0, 5, "a", INGESTAO)],
                   "placa_id string, data_hora timestamp, watts double, intervalo_min int, arquivo_origem string, "
                   "ingerido_em timestamp")
    validas, rejeitadas = se.validar_leituras(leituras, se.placas(_placas(spark)))
    assert [r.watts for r in validas.collect()] == [300.0]
    assert sorted((r.watts, r.motivo_rejeicao) for r in rejeitadas.collect()) == [
        (-1.0, se.VALOR_INVALIDO), (100.0, se.PLACA_DESCONHECIDA), (5000.0, se.VALOR_INVALIDO)]


def test_dia_completo_pelo_criterio_da_validacao(spark):
    def leituras_do_dia(dia, inicio_local, fim_local, buraco=None):
        linhas, t = [], datetime(2026, 9, dia, inicio_local + 3)        # hora local + 3 = UTC
        while t <= datetime(2026, 9, dia, fim_local + 3):
            if not (buraco and buraco[0] <= t.hour - 3 < buraco[1]):
                linhas.append(("p1", t, 600.0, 5))
            t += timedelta(minutes=5)
        return linhas
    validas = _df(spark, leituras_do_dia(1, 8, 17) + leituras_do_dia(2, 10, 17) + leituras_do_dia(3, 8, 17, (12, 13)),
                  "placa_id string, data_hora timestamp, watts double, intervalo_min int")
    dias = {str(r.dia): r for r in se.dias_medidos(validas).collect()}
    assert dias["2026-09-01"].completo and dias["2026-09-01"].real_wh == pytest.approx(600 * (9 * 12 + 1) * 5 / 60)
    assert not dias["2026-09-02"].completo                  # começou às 10h
    assert not dias["2026-09-03"].completo                  # buraco de uma hora


def test_hora_sem_sol_com_geracao_e_rejeitada_e_a_medida_exige_45_minutos(spark):
    clima = _df(spark, [("p1", T0, 600.0, 25.0, 0.0, False), ("p1", T0 + timedelta(hours=1), 0.0, 20.0, 0.0, False),
                        ("p1", T0 + timedelta(hours=2), 300.0, 22.0, 0.0, False)],
                "placa_id string, data_hora timestamp, irradiancia double, temperatura double, precipitacao double, "
                "previsao boolean")
    medidas = _df(spark, [("p1", T0, 500.0, 60), ("p1", T0 + timedelta(hours=1), 200.0, 60),
                          ("p1", T0 + timedelta(hours=2), 100.0, 30)],
                  "placa_id string, data_hora timestamp, medido_wh double, cobertura_min long")
    tabela, rejeitadas = se.horas(clima, se.placas(_placas(spark)), medidas)
    por_hora = {r.data_hora.hour: r for r in tabela.collect()}
    assert por_hora[12].real_wh == 500.0 and por_hora[12].estimada_wh > 0 and str(por_hora[12].dia) == "2026-09-01"
    assert por_hora[13].real_wh is None and [r.motivo_rejeicao for r in rejeitadas.collect()] == [se.NOITE_COM_GERACAO]
    assert por_hora[14].real_wh is None                     # só 30 min de leitura
