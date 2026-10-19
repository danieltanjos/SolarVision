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


def _validar(spark, eventos):
    validos, rejeitados = silver.validar(silver.tipar(bronze(spark, eventos)))
    return {r.event_id for r in validos.collect()}, {r.event_id: r.motivo_rejeicao for r in rejeitados.collect()}


def test_validar_aplica_cada_regra_com_o_motivo(spark):
    validos, rejeitados = _validar(spark, [
        evento("ok", "page_view"),
        evento("fora", "share_report"),
        evento("sem-nome", None),
        evento("sem-ts", "page_view", minutos=None),
        evento("futuro", "page_view", minutos=60 * 24 * 3650),
        evento("placa-sem-id", "create_panel", params={"group_id": 1, "potencia_wp": 550}),
        evento("grupo-sem-id", "delete_group", params={"panels_removed": 2}),
        evento("linhas", "import_readings", params={"panel_id": 1001, "rows": -288}),
        evento("potencia", "create_panel", params={"panel_id": 1002, "group_id": 1, "potencia_wp": 0}),
        evento("scroll-33", "scroll", params={"percent_scrolled": 33}),
        evento("scroll-50", "scroll", params={"percent_scrolled": 50}),
    ])
    assert validos == {"ok", "scroll-50"}
    assert rejeitados == {
        "fora": silver.FORA_DO_CATALOGO, "sem-nome": silver.FORA_DO_CATALOGO,
        "sem-ts": silver.TIMESTAMP_INVALIDO, "futuro": silver.TIMESTAMP_INVALIDO,
        "placa-sem-id": silver.ACAO_SEM_ID, "grupo-sem-id": silver.ACAO_SEM_ID,
        "linhas": silver.VALOR_INVALIDO, "potencia": silver.VALOR_INVALIDO,
        "scroll-33": silver.MARCO_FORA,
    }


def test_exclusao_so_vale_com_criacao_valida_e_a_cascata_rejeita(spark):
    validos, rejeitados = _validar(spark, [
        evento("cria-g", "create_group", params={"group_id": 7}),
        evento("cria-p", "create_panel", params={"panel_id": 10, "group_id": 7, "potencia_wp": 550}),
        evento("cria-p-ruim", "create_panel", params={"panel_id": 11, "group_id": 7, "potencia_wp": 0}),
        evento("exclui-p", "delete_panel", 5, params={"panel_id": 10, "group_id": 7}),
        evento("exclui-p-cascata", "delete_panel", 5, params={"panel_id": 11, "group_id": 7}),
        evento("exclui-antiga", "delete_panel", 5, params={"panel_id": 3, "group_id": 1}),
        evento("exclui-g", "delete_group", 9, params={"group_id": 7, "panels_removed": 0}),
        evento("exclui-g-antigo", "delete_group", 9, params={"group_id": 2, "panels_removed": 1}),
    ])
    assert validos == {"cria-g", "cria-p", "exclui-p", "exclui-g"}
    assert rejeitados == {
        "cria-p-ruim": silver.VALOR_INVALIDO,
        "exclui-p-cascata": silver.EXCLUSAO_ORFA,
        "exclui-antiga": silver.EXCLUSAO_ORFA,
        "exclui-g-antigo": silver.EXCLUSAO_ORFA,
    }
