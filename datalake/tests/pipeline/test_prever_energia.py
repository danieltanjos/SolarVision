from datetime import date, datetime, timezone

import pytest
from pyspark.ml import Pipeline
from pyspark.ml.feature import VectorAssembler
from pyspark.ml.regression import LinearRegression

import prever_energia as pe
import publicar_previsao as pp

HOJE = date(2026, 11, 24)


def _diaria(spark):
    linhas = [("app-7", "app", date(2026, 11, 24 + i), 1000.0, "previsao", 0.9, 1) for i in range(7)]
    linhas += [("app-7", "app", date(2026, 12, 1), 1000.0, "previsao", 0.9, 1),        # fora da semana
               ("ufsc-1", "ufsc", date(2026, 11, 25), 1000.0, "previsao", 0.9, 1),       # referência, sem previsão
               ("app-7", "app", date(2026, 11, 20), 1000.0, "treino", 0.9, 1)]
    return spark.createDataFrame(linhas, "placa_id string, fonte string, dia date, estimada_wh double, conjunto string, "
                                         "razao_ref double, tem_historico int")


def _modelo(spark):
    treino = spark.createDataFrame([(r / 10, r / 10) for r in range(5, 15)], "razao_ref double, razao double")
    return Pipeline(stages=[VectorAssembler(inputCols=["razao_ref"], outputCol="features"),
                            LinearRegression(labelCol="razao")]).fit(treino)


def test_hoje_e_o_dia_de_sao_paulo():
    assert pe.hoje_local(datetime(2026, 11, 25, 2, 0, tzinfo=timezone.utc)) == date(2026, 11, 24)


def test_preve_so_as_placas_do_app_nos_proximos_7_dias_com_a_faixa(spark):
    tabela = pe.prever(_modelo(spark), _diaria(spark), (-0.1, 0.2), HOJE, "teste")
    linhas = sorted(tabela.collect(), key=lambda r: r.dia)
    assert [r.dia for r in linhas] == [date(2026, 11, 24 + i) for i in range(7)]
    primeira = linhas[0]
    assert primeira.prevista_wh == pytest.approx(900.0, abs=1)
    assert (primeira.p10_wh, primeira.p90_wh) == (pytest.approx(810.0, abs=1), pytest.approx(1080.0, abs=1))


def test_linhas_publicadas_no_formato_da_tabela(spark):
    df = spark.createDataFrame([("app-7", date(2026, 11, 24), 1000.0, 900.0, 810.0, 1080.0, "gbt",
                                 datetime(2026, 11, 24, 10, 0))],
                               "placa_id string, dia date, estimada_wh double, prevista_wh double, p10_wh double, "
                               "p90_wh double, modelo string, gerada_em timestamp")
    assert pp.linhas(df) == [{"placa_id": 7, "dia": "2026-11-24", "estimada_wh": 1000.0, "prevista_wh": 900.0,
                              "p10_wh": 810.0, "p90_wh": 1080.0, "modelo": "gbt", "gerada_em": "2026-11-24T10:00:00"}]
