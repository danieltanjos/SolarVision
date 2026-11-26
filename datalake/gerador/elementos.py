"""Qual elemento da tela foi clicado: o `params.element_id` dos eventos de clique.

O valor é o atributo `data-heat` do elemento no app (frontend/src). O passo é
determinístico (não usa o rng), então ligar a marcação não muda nenhum outro
campo nem os números do gerador.
"""

from __future__ import annotations

from urllib.parse import urlparse

from gerador import catalogo as cat

SAIDAS = {urlparse(url).hostname: "saida-" + texto.lower().replace(" ", "-") for texto, url in cat.SAIDAS}
# atalhos (CTA) que o app tem, além do menu lateral
CTAS = ("cta_criar_conta", "cta_entrar", "cta_relatorio_mes", "cta_registrar_limpeza", "cta_importar")
FIXOS = {
    "site_search": "busca-seletor",
    "view_alerts": "btn-alertas",
    "view_cleaning_recommendation": "card-recomendacao",
    "file_download": "btn-imprimir",
    "create_group": "btn-salvar-grupo",
    "create_panel": "btn-salvar-placa",
    "import_readings": "btn-importar",
    "register_cleaning": "btn-registrar-limpeza",
    "delete_panel": "btn-excluir-placa",
    "delete_group": "btn-excluir-grupo",
    "sign_up": "btn-signup",
    "login": "btn-login",
    "logout": "btn-sair",
}
SELECAO = {"grupo": "seletor-grupo", "placa": "seletor-placa"}


def _link(link_id: str) -> str:
    """'nav_monitoramento' -> 'nav-monitoramento' (o link_id com - no lugar de _)."""
    return link_id.replace("_", "-")


ELEMENTOS = frozenset(
    set(SAIDAS.values()) | {_link(f"nav_{tela}") for tela in cat.MENU} | {_link(c) for c in CTAS}
    | set(FIXOS.values()) | set(SELECAO.values()) | {f"visao-{v}" for v in cat.VISOES}
    | {f"cfg-{c}" for c in cat.CONFIGURACOES}
)


def elemento(evento: dict, anterior: dict | None = None, seguinte: dict | None = None) -> str | None:
    """O element_id do evento, pela tabela do contrato. `anterior`/`seguinte` ficam pela
    compatibilidade com o gerador do projeto-modelo: no SolarVision o elemento não depende dos vizinhos."""
    nome = evento["event_name"]
    params = evento.get("params") or {}
    if nome == "click":
        if params.get("outbound"):
            return SAIDAS.get(params.get("link_domain") or "")
        return _link(params["link_id"]) if params.get("link_id") else None
    if nome == "select_content":
        if params.get("content_type") == "visao" and params.get("content_id") in cat.VISOES:
            return f"visao-{params['content_id']}"
        return SELECAO.get(params.get("content_type"))
    if nome == "change_settings" and params.get("setting") in cat.CONFIGURACOES:
        return f"cfg-{params['setting']}"
    return FIXOS.get(nome)


def marcar_elementos(eventos: list[dict]) -> int:
    """Põe params.element_id nos eventos de clique, no lugar. Devolve quantos marcou."""
    marcados = 0
    for e in eventos:
        valor = elemento(e)
        if valor is not None:
            e.setdefault("params", {})["element_id"] = valor
            marcados += 1
    return marcados
