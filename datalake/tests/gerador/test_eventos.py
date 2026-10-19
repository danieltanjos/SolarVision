import random
from datetime import datetime, timezone

from gerador import catalogo as cat
from gerador.eventos import Contexto, criar_evento, iso, item, novo_uuid
from gerador.jornadas import placa_item


def _ctx():
    return Contexto("anon-1", cat.CANAIS[2], cat.DISPOSITIVOS[0], "s-1", pagina="cadastro")


def test_iso_tem_milissegundos_e_z():
    ts = datetime(2026, 9, 1, 14, 22, 5, 123456, tzinfo=timezone.utc)
    assert iso(ts) == "2026-09-01T14:22:05.123Z"


def test_uuid_e_deterministico_pela_seed():
    assert novo_uuid(random.Random(1)) == novo_uuid(random.Random(1))
    assert len(novo_uuid(random.Random(1))) == 36


def test_criar_evento_segue_o_contrato():
    ts = datetime(2026, 9, 1, tzinfo=timezone.utc)
    placa = {"panel_id": 10, "group_id": 17, "potencia_wp": 550}
    ev = criar_evento(random.Random(1), "create_panel", ts, _ctx(), {"panel_id": 10}, [placa_item(placa)])
    assert set(ev) == {
        "event_id", "event_name", "event_ts", "user_pseudo_id", "user_id", "session_hint",
        "page", "traffic", "device", "params", "items",
    }
    assert ev["event_ts"] == "2026-09-01T00:00:00.000Z"
    assert ev["user_id"] is None
    assert ev["page"] == {"location": "https://solarvision-senai.vercel.app/app/cadastro", "referrer": None}
    assert ev["traffic"] == {"source": "google", "medium": "cpc", "campaign": "monitoramento_solar"}
    assert ev["device"] == {"category": "mobile", "os": "Android", "browser": "Chrome"}
    assert ev["items"] == [{"item_id": "placa-10", "item_category": "placa", "potencia_wp": 550, "quantity": 1}]


def test_item_aceita_campos_extras():
    produto = {"item_id": "X", "item_name": "Produto", "item_category": "outro", "price": 1.0}
    it = item(produto, index=1)
    assert it["index"] == 1 and it["quantity"] == 1
