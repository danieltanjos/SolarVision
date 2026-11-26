import json

import pytest
from pyspark.sql import functions as F

import exportar_mapa_calor as ex

COLUNAS, ORDEM = ex.TABELAS["cliques"][1], ex.TABELAS["cliques"][2]


def _cliques(spark, colunas=COLUNAS):
    linhas = [("/app/home", "nav-relatorio", 3, 2, 10, 0.2, 0.75),
              ("/app/cadastro", "btn-salvar-placa", 5, 4, 8, 0.5, 1.0),
              ("/app/home", "btn-alertas", 4, 3, 10, 0.3, 1.0)]
    df = spark.createDataFrame(linhas, "pagina string, element_id string, cliques long, sessoes long, "
                                       "sessoes_na_pagina long, taxa_clique double, intensidade double")
    return df.select(*colunas)


def test_linhas_trazem_so_as_colunas_do_app_na_ordem_de_pagina_e_elemento(spark):
    df = _cliques(spark).withColumn("extra", F.lit(1))
    linhas = ex.linhas(df, "mapa_calor_cliques", COLUNAS, ORDEM)
    assert [list(r) for r in linhas] == [COLUNAS] * 3                             # "extra" não vai para o app
    assert [(r["pagina"], r["element_id"]) for r in linhas] == [
        ("/app/cadastro", "btn-salvar-placa"), ("/app/home", "btn-alertas"), ("/app/home", "nav-relatorio")]


def test_coluna_faltando_para_o_job_com_o_que_rodar_antes(spark):
    df = _cliques(spark, [c for c in COLUNAS if c != "intensidade"])
    with pytest.raises(ex.ColunasFaltando, match=r"\['intensidade'\].*gold_mapa_calor\.py"):
        ex.linhas(df, "mapa_calor_cliques", COLUNAS, ORDEM)


def test_grava_uma_linha_com_window_mapa_calor_e_sem_sobrar_o_tmp(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    dados = ex.montar([{"pagina": "/app/home", "element_id": "btn-alertas"}],
                      [{"pagina": "/app/home", "marco": 0}], "2026-11-11T21:00:00Z")
    ex.escrever_js(ex.DESTINO, ex.VARIAVEL, dados)
    texto = (tmp_path / "app-bi" / "mapa_calor.js").read_text(encoding="utf-8")
    assert texto.count("\n") == 1 and texto.startswith("window.MAPA_CALOR = {") and texto.endswith("};\n")
    lido = json.loads(texto.removeprefix("window.MAPA_CALOR = ").removesuffix(";\n"))
    assert list(lido) == ["gerado_em", "cliques", "rolagem"] and lido["cliques"][0]["element_id"] == "btn-alertas"
    assert not (tmp_path / "app-bi" / "mapa_calor.js.tmp").exists()
