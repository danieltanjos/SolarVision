from datetime import datetime, timezone

import silver
from tests.pipeline.fabrica import bronze, evento


def test_deduplicar_deixa_um_por_event_id_e_fica_com_a_primeira_ingestao(spark):
    a = bronze(spark, [evento("e1", "page_view"), evento("e2", "scroll", params={"percent_scrolled": 25})],
               arquivo="lote-1", ingerido_em=datetime(2026, 9, 2, tzinfo=timezone.utc))
    b = bronze(spark, [evento("e1", "page_view")], arquivo="lote-2",
               ingerido_em=datetime(2026, 9, 3, tzinfo=timezone.utc))
    unicos = silver.deduplicar(a.unionByName(b))
    linhas = {r.event_id: r.arquivo_origem for r in unicos.collect()}
    assert linhas == {"e1": "lote-1", "e2": "lote-1"}


def test_tipar_extrai_params_com_o_tipo_certo(spark):
    df = bronze(spark, [
        evento("e1", "create_panel", tela="/app/cadastro",
               params={"panel_id": 10, "group_id": 17, "potencia_wp": 550, "element_id": "btn-salvar-placa"}),
        evento("e2", "click", params={"outbound": True, "link_domain": "open-meteo.com"}),
        evento("e3", "scroll", params={"percent_scrolled": "abc"}),
    ])
    linhas = {r.event_id: r for r in silver.tipar(df).collect()}
    assert linhas["e1"].panel_id == 10 and linhas["e1"].group_id == 17 and linhas["e1"].potencia_wp == 550.0
    assert linhas["e1"].element_id == "btn-salvar-placa"
    assert linhas["e1"].pagina == "/app/cadastro"
    assert linhas["e1"].canal == "google / organic"
    assert linhas["e1"].device_category == "desktop"
    assert linhas["e2"].outbound is True
    assert linhas["e3"].percent_scrolled is None          # não converte: nulo (a validação decide)


def test_pagina_tira_dominio_hash_e_query(spark):
    df = spark.createDataFrame(
        [("https://x.app/app/relatorio?mes=2026-08",), ("https://x.app/#topo",), ("https://x.app",), (None,)], ["u"])
    assert [r.p for r in df.select(silver.pagina(df.u).alias("p")).collect()] == ["/app/relatorio", "/", "/", None]
