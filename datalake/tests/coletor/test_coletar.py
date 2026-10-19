import json
from datetime import datetime, timezone

from coletor.coletar_supabase import ler_ultimo_id, main, montar_arquivos

AGORA = datetime(2026, 10, 20, 21, 0, tzinfo=timezone.utc)


def _linha(i, nome, recebido):
    return {"id": i, "recebido_em": recebido, "evento": {"event_id": f"e{i}", "event_name": nome, "params": {"x": "ã"}}}


def test_um_arquivo_por_evento_e_dia_de_chegada_no_layout_da_landing():
    arquivos = montar_arquivos([
        _linha(1, "page_view", "2026-10-19T23:59:00+00:00"),
        _linha(2, "page_view", "2026-10-20T00:01:00+00:00"),
        _linha(3, "create_panel", "2026-10-20T10:00:00+00:00"),
        _linha(4, "page_view", "2026-10-20T11:00:00+00:00"),
    ], AGORA)
    assert sorted(arquivos) == [
        "landing/event_name=create_panel/year=2026/month=10/day=20/app-20261020T210000.jsonl",
        "landing/event_name=page_view/year=2026/month=10/day=19/app-20261020T210000.jsonl",
        "landing/event_name=page_view/year=2026/month=10/day=20/app-20261020T210000.jsonl",
    ]
    linhas = arquivos["landing/event_name=page_view/year=2026/month=10/day=20/app-20261020T210000.jsonl"].splitlines()
    assert [json.loads(l)["event_id"] for l in linhas] == ["e2", "e4"]
    assert "ã" in linhas[0]                                       # sem escapar acento


def test_evento_sem_nome_vai_para_a_particao_padrao_do_spark():
    arquivos = montar_arquivos([{"id": 1, "recebido_em": "2026-10-20T10:00:00Z", "evento": {"event_id": "x"}}], AGORA)
    assert list(arquivos)[0].startswith("landing/event_name=__HIVE_DEFAULT_PARTITION__/")


def test_ultimo_id_comeca_do_zero_sem_estado(tmp_path):
    assert ler_ultimo_id(tmp_path / "nao-existe") == 0
    (tmp_path / "id").write_text("42\n", encoding="utf-8")
    assert ler_ultimo_id(tmp_path / "id") == 42


def test_sem_credenciais_para_com_mensagem(monkeypatch, capsys):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_KEY", raising=False)
    assert main([]) == 1
    assert "SUPABASE_SERVICE_KEY" in capsys.readouterr().err
