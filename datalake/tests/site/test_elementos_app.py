"""O equivalente ao tests/site/test_elementos_site.py do projeto-modelo do professor, para o app React.

Lá o "site" é um index.html; aqui é o frontend/src do SolarVision, montado só para leitura em
/projeto/app-src pelo docker-compose (fora do contêiner, lido direto de ../frontend/src). Alguns
data-heat são montados por template ({`nav-${...}`}, {`visao-${...}`}, {`cfg-${...}`}): como o
professor faz com os cartões dos planos gerados por JS, o teste resolve os templates pelas listas do app.
"""

import re
from pathlib import Path

import pytest

from gerador.elementos import ELEMENTOS, PLANEJADOS

RAIZ = Path(__file__).resolve().parents[2]
APP = next((p for p in (RAIZ / "app-src", RAIZ.parent / "frontend" / "src") if p.is_dir()), None)
pytestmark = pytest.mark.skipif(APP is None, reason="frontend/src não está montado em /projeto/app-src")
SO_ADMIN = {"nav-uso"}           # o menu "Uso da plataforma" só existe para ADMIN e não é rastreado


def _fonte(relativo: str) -> str:
    return (APP / relativo).read_text(encoding="utf-8")


def _todo_o_app() -> str:
    return "\n".join(p.read_text(encoding="utf-8") for p in sorted(APP.rglob("*.js*")))


def ids_no_app() -> set[str]:
    texto = _todo_o_app()
    literais = set(re.findall(r'data-heat="([^"]+)"', texto)) | set(re.findall(r'\bheat="([^"]+)"', texto))
    menu = {f"nav-{tela}" for tela in re.findall(r'to: "/app/([a-z]+)"', _fonte("components/Sidebar.jsx"))}
    visoes = {f"visao-{v}" for v in re.findall(r'\{ value: "([a-z]+)", label:', _fonte("pages/MonitoringPage.jsx"))}
    setting = re.search(r"const SETTING = \{([^}]*)\}", _fonte("pages/SettingsPage.jsx")).group(1)
    configuracoes = {f"cfg-{v}" for v in re.findall(r':\s*"([a-z]+)"', setting)}
    return literais | menu | visoes | configuracoes


def test_todo_elemento_do_contrato_existe_no_app_e_vice_versa():
    assert ids_no_app() - SO_ADMIN == set(ELEMENTOS) - PLANEJADOS


def test_planejados_sao_so_os_da_assinatura_e_estao_no_contrato():
    assert PLANEJADOS <= ELEMENTOS
    assert not PLANEJADOS & ids_no_app()


def test_templates_do_app_estao_no_lugar_que_o_teste_resolve():
    texto = _todo_o_app()
    assert 'data-heat={`nav-${item.to.split("/").pop()}`}' in texto
    assert "data-heat={`visao-${option.value}`}" in texto
    assert "data-heat={`cfg-${SETTING[id]}`}" in texto


def test_cliques_do_app_levam_o_element_id_do_data_heat():
    tracking = _fonte("lib/tracking.js")
    assert 'closest?.("[data-heat]")?.getAttribute("data-heat")' in tracking


def test_app_carrega_o_mapa_e_tem_o_botao():
    bi = _fonte("lib/bi.js")
    assert 'carregarExportacao("/bi/mapa_calor.js", "MAPA_CALOR")' in bi
    assert 'id="mapa-calor"' in _fonte("components/MapaCalor.jsx")
