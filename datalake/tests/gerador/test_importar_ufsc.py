import json

import pytest

from gerador import importar_ufsc as ufsc
from gerador import landing_energia


def test_leitura_local_de_sao_paulo_vira_utc(tmp_path):
    csv = tmp_path / "ufsc.csv"
    csv.write_text("dia,hora,wats5min\n2018-01-01,06:15:00,1.25\n2018-01-01,23:55:00,\n", encoding="utf-8")
    assert ufsc.ler_leituras(csv) == [
        {"placa_id": "ufsc-1", "data_hora": "2018-01-01T09:15:00Z", "watts": 1.25, "intervalo_min": 5}]


def test_clima_guarda_o_inicio_da_hora_como_o_app():
    horas = {"time": ["2018-01-01T10:00", "2018-01-01T11:00"], "global_tilted_irradiance": [300.0, None],
             "temperature_2m": [25.0, 26.0], "precipitation": [None, 1.0]}
    assert ufsc.clima_das_horas(horas, "ufsc-1") == [
        {"placa_id": "ufsc-1", "data_hora": "2018-01-01T09:00:00Z", "irradiancia": 300.0, "temperatura": 25.0,
         "precipitacao": 0.0, "previsao": False}]


def test_url_pede_o_plano_da_placa_com_o_azimute_do_open_meteo():
    url = ufsc.url_arquivo(ufsc.PLACA, "2018-01-01", "2018-01-31")
    assert "archive-api.open-meteo.com" in url
    assert "tilt=20.0" in url and "azimuth=-180.0" in url          # 0 = Norte no app, −180 no Open-Meteo
    assert "global_tilted_irradiance%2Ctemperature_2m%2Cprecipitation" in url


def test_landing_de_energia_um_arquivo_por_tabela_e_fonte():
    gravados = {}

    class Destino:
        def gravar(self, chave, conteudo):
            gravados[chave] = conteudo

    contagem = landing_energia.gravar(Destino(), "ufsc", "importacao",
                                      {"placas": [{"placa_id": "ufsc-1"}], "leituras": [], "clima": [{"a": "ã"}]})
    assert contagem == {"placas": 1, "leituras": 0, "clima": 1}
    assert sorted(gravados) == ["landing_energia/clima/fonte=ufsc/importacao.jsonl",
                                "landing_energia/placas/fonte=ufsc/importacao.jsonl"]
    assert json.loads(gravados["landing_energia/clima/fonte=ufsc/importacao.jsonl"]) == {"a": "ã"}
    with pytest.raises(ValueError):
        landing_energia.chave("eventos", "ufsc", "x")
