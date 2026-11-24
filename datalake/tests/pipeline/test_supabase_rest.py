import io
import json

import pytest

import supabase_rest as sr


class Resposta(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


@pytest.fixture
def pedidos(monkeypatch):
    feitos = []

    def abrir(pedido, timeout):
        feitos.append(pedido)
        return Resposta(b"")

    monkeypatch.setattr(sr, "abrir", abrir)
    return feitos


def test_credenciais_vem_do_env_e_faltando_uma_e_none(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://x.supabase.co/")
    monkeypatch.setenv("SUPABASE_SERVICE_KEY", "chave")
    assert sr.credenciais() == ("https://x.supabase.co", "chave")
    monkeypatch.delenv("SUPABASE_SERVICE_KEY")
    assert sr.credenciais() is None


def test_upsert_manda_em_lotes_com_merge_pela_chave(pedidos, monkeypatch):
    monkeypatch.setattr(sr, "LOTE", 2)
    assert sr.upsert(("https://x.supabase.co", "k"), "previsoes_ml", [{"a": i} for i in range(5)], "placa_id,dia") == 5
    assert len(pedidos) == 3
    primeiro = pedidos[0]
    assert primeiro.full_url == "https://x.supabase.co/rest/v1/previsoes_ml?on_conflict=placa_id%2Cdia"
    assert primeiro.get_method() == "POST"
    assert primeiro.get_header("Prefer") == "resolution=merge-duplicates,return=minimal"
    assert primeiro.get_header("Apikey") == "k" and primeiro.get_header("Authorization") == "Bearer k"
    assert json.loads(primeiro.data) == [{"a": 0}, {"a": 1}]


def test_publicar_bi_grava_uma_linha_por_nome(pedidos):
    sr.publicar_bi(("https://x.supabase.co", "k"), "mapa_calor", {"cliques": []}, "2026-11-24T10:00:00Z")
    [pedido] = pedidos
    assert "bi_exportacoes?on_conflict=nome" in pedido.full_url
    assert json.loads(pedido.data) == [{"nome": "mapa_calor", "dados": {"cliques": []}, "gerado_em": "2026-11-24T10:00:00Z"}]
