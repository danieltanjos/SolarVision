from datetime import datetime, timezone

from coletor import coletar_energia as ce

AGORA = datetime(2026, 11, 24, 12, 0, tzinfo=timezone.utc)


def _supabase(tabelas):
    pedidos = []

    def get(tabela, parametros):
        pedidos.append((tabela, parametros))
        linhas = tabelas.get(tabela, [])
        if "placa_id" in parametros:
            alvo = int(parametros["placa_id"].removeprefix("eq."))
            linhas = [l for l in linhas if l.get("_placa") == alvo]
        return linhas

    return get, pedidos


def test_coleta_placas_leituras_clima_e_limpezas_no_layout_da_landing():
    get, pedidos = _supabase({
        "placas": [{"id": 7, "potencia_wp": 550, "inclinacao": 20, "azimute": 0, "coef_temperatura": -0.4,
                    "instalada_em": "2024-01-15", "grupos_solares": {"latitude": -27.5, "longitude": -48.5}},
                   {"id": 8, "potencia_wp": None}],                       # sem potência: não dá para estimar
        "leituras_energia": [{"_placa": 7, "data_hora": "2026-11-01T12:00:00+00:00", "wats_gerados": "300.5"},
                             {"_placa": 7, "data_hora": "2026-11-01T12:05:00+00:00", "wats_gerados": "310"}],
        "clima_horario": [{"_placa": 7, "data_hora": "2026-11-24T11:00:00+00:00", "irradiancia": 500, "temperatura": 25,
                           "precipitacao": None},
                          {"_placa": 7, "data_hora": "2026-11-25T12:00:00+00:00", "irradiancia": 600, "temperatura": 26,
                           "precipitacao": 2.0}],
        "limpezas": [{"placa_id": 7, "data_limpeza": "2026-10-30"}],
    })
    tabelas = ce.coletar(get, AGORA)
    assert [p["placa_id"] for p in tabelas["placas"]] == ["app-7"]
    assert tabelas["placas"][0]["latitude"] == -27.5
    assert [(l["watts"], l["intervalo_min"]) for l in tabelas["leituras"]] == [(300.5, 5), (310.0, 5)]
    assert [(c["precipitacao"], c["previsao"]) for c in tabelas["clima"]] == [(0.0, False), (2.0, True)]
    assert tabelas["limpezas"] == [{"placa_id": "app-7", "dia": "2026-10-30"}]
    desde = next(p for t, p in pedidos if t == "clima_horario")["data_hora"]
    assert desde.startswith("gte.2026-09-22")                     # 40 dias antes da primeira leitura


def test_intervalo_das_leituras_pela_mediana():
    assert ce.intervalo_min(["2026-11-01T12:00:00Z", "2026-11-01T12:05:00Z", "2026-11-01T12:10:00Z",
                             "2026-11-01T13:00:00Z"]) == 5
    assert ce.intervalo_min([]) == 60


def test_sem_credenciais_para_com_mensagem(monkeypatch, capsys):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_KEY", raising=False)
    assert ce.main([]) == 1
    assert "SUPABASE_SERVICE_KEY" in capsys.readouterr().err
