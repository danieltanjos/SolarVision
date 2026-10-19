"""Máquina de estados do uso do SolarVision.

Um usuário novo chega pelo canal de aquisição, cria a conta e, se ativar,
cadastra a usina (grupo) e as placas; depois volta para acompanhar o
monitoramento, importar leituras, registrar limpezas e tirar o relatório
do mês. Canal e dispositivo mudam as chances de ativar e de voltar. Parte
dos usuários já tinha conta e usinas antes do rastreamento começar
("antigos"): eles só fazem login, e as placas deles nunca aparecem num
create_panel.

A estrutura (Sessao, emitir, abrir, simular_visitante, simular) é a do
gerador do projeto-modelo; o comportamento é o do SolarVision.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from urllib.parse import urlparse

from gerador import catalogo as cat
from gerador.eventos import Contexto, criar_evento, hex8

P_RECARGA = 0.20          # chance de um page_view ser recarga completa (novo session_hint)
P_ANTIGO = 0.15           # usuários que já tinham conta antes do rastreamento
P_SESSAO_SALVA = 0.70     # voltar no mesmo navegador já logado (o Supabase guarda a sessão)
P_OUTRO_DISPOSITIVO = 0.12
MAX_SESSOES = 14


@dataclass
class Ids:
    """Contadores dos ids do banco: os antigos ficam abaixo de ID_INICIAL_NOVOS."""

    antigo: int = 1
    novo: int = cat.ID_INICIAL_NOVOS
    limpeza: int = 1

    def proximo(self, antigo: bool = False) -> int:
        if antigo:
            self.antigo += 1
            return self.antigo - 1
        self.novo += 1
        return self.novo - 1

    def proxima_limpeza(self) -> int:
        self.limpeza += 1
        return self.limpeza - 1


@dataclass
class Usuario:
    """O que o usuário tem na plataforma (para os eventos citarem ids que existem)."""

    pseudo: str
    canal: dict
    dispositivo: dict
    antigo: bool = False
    user_id: str | None = None
    grupos: dict[int, list[dict]] = field(default_factory=dict)   # group_id -> placas
    importou: bool = False
    ativou: bool = False
    abandonou: bool = False
    saiu: bool = False          # fez logout na última visita (a próxima passa pelo login)

    @property
    def placas(self) -> list[dict]:
        return [p for placas in self.grupos.values() for p in placas]


@dataclass
class Sessao:
    rng: random.Random
    ctx: Contexto
    agora: datetime
    eventos: list[dict] = field(default_factory=list)

    def chance(self, p: float) -> bool:
        return self.rng.random() < min(p, 0.98)

    def emitir(self, nome: str, params: dict | None = None, items: list | None = None,
               segundos: float | None = None) -> dict:
        self.agora += timedelta(seconds=segundos if segundos is not None else self.rng.uniform(2, 40))
        evento = criar_evento(self.rng, nome, self.agora, self.ctx, params, items)
        self.eventos.append(evento)
        return evento

    def abrir(self, tela: str, recarga: bool = False) -> dict:
        if recarga and self.ctx.pagina is not None:
            self.ctx.referrer = cat.PAGINAS[self.ctx.pagina]
            self.ctx.session_hint = "s-" + hex8(self.rng)
        elif self.ctx.pagina is None:
            self.ctx.referrer = self.ctx.canal["referrer"]
        else:
            self.ctx.referrer = cat.PAGINAS[self.ctx.pagina]
            if self.chance(P_RECARGA):
                self.ctx.session_hint = "s-" + hex8(self.rng)
        self.ctx.pagina = tela
        return self.emitir("page_view", {"page_title": f"{cat.TITULOS[tela]} · SolarVision"},
                           segundos=self.rng.uniform(15, 150) if self.eventos else 0)

    def navegar(self, tela: str, link_id: str | None = None) -> None:
        """Clique no menu (ou num atalho) seguido da tela nova."""
        link_id = link_id or f"nav_{tela}"
        self.emitir("click", {"link_url": cat.PAGINAS[tela], "link_text": cat.TITULOS[tela],
                              "link_id": link_id, "outbound": False})
        self.abrir(tela)

    def rolar(self, ate: int, fator: float = 1.0) -> None:
        """Marcos de scroll da tela atual, parando no primeiro que o usuário não alcança."""
        for marco, p in ((25, 0.80), (50, 0.65), (75, 0.55), (90, 0.45)):
            if marco > ate or not self.chance(p * fator):
                return
            self.emitir("scroll", {"percent_scrolled": marco}, segundos=self.rng.uniform(3, 20))


def placa_item(placa: dict) -> dict:
    return {"item_id": f"placa-{placa['panel_id']}", "item_category": "placa",
            "potencia_wp": placa["potencia_wp"], "quantity": 1}


def _nova_placa(s: Sessao, ids: Ids, group_id: int, antigo: bool = False) -> dict:
    wp = s.rng.choices(cat.POTENCIAS_WP, weights=cat.PESOS_POTENCIA)[0]
    return {"panel_id": ids.proximo(antigo), "group_id": group_id, "potencia_wp": wp}


def _mes_anterior(quando: datetime) -> str:
    primeiro = quando.replace(day=1)
    return (primeiro - timedelta(days=1)).strftime("%Y-%m")


def _cadastrar(s: Sessao, u: Usuario, ids: Ids, fator: float) -> None:
    """Tela de Cadastro: cria o grupo se não houver e cadastra placas (a ativação)."""
    if not u.grupos:
        if not s.chance(0.90):
            return
        group_id = ids.proximo()
        s.emitir("create_group", {"group_id": group_id, "has_location": s.chance(0.85),
                                  "has_tariff": s.chance(0.55)}, segundos=s.rng.uniform(30, 180))
        u.grupos[group_id] = []
    group_id = s.rng.choice(list(u.grupos))
    quantas = 0
    while s.chance((0.80 if quantas == 0 else 0.30) * fator ** 0.5) and quantas < 4:
        placa = _nova_placa(s, ids, group_id)
        s.emitir("create_panel", {"panel_id": placa["panel_id"], "group_id": group_id,
                                  "potencia_wp": placa["potencia_wp"]}, [placa_item(placa)],
                 segundos=s.rng.uniform(25, 120))
        u.grupos[group_id].append(placa)
        u.ativou = True
        quantas += 1


def _monitorar(s: Sessao, u: Usuario, ids: Ids) -> None:
    rng = s.rng
    selecao = u.placas
    group_id = panel_id = None
    if len(u.grupos) > 1 and s.chance(0.4):
        group_id = rng.choice(list(u.grupos))
        selecao = u.grupos[group_id] or selecao
    s.emitir("view_monitoring", {"group_id": group_id, "panel_id": panel_id, "view": "dia"},
             [placa_item(p) for p in selecao], segundos=rng.uniform(1, 4))
    if s.chance(0.45):
        visao = rng.choices(cat.VISOES, weights=cat.PESOS_VISAO)[0]
        s.emitir("select_content", {"content_type": "visao", "content_id": visao})
    if s.chance(0.30):
        placa = rng.choice(u.placas)
        s.emitir("select_content", {"content_type": "placa", "content_id": str(placa["panel_id"])})
        panel_id = placa["panel_id"]
    if s.chance(0.14):
        termo, resultados = rng.choice(cat.BUSCAS_SELETOR)
        s.emitir("site_search", {"search_term": termo, "search_results": resultados, "search_area": "seletor"})
    if s.chance(0.22):
        placa = rng.choice(u.placas)
        perda = round(rng.uniform(0, 20), 1)
        s.emitir("view_cleaning_recommendation", {"panel_id": placa["panel_id"], "loss_percent": perda,
                                                  "recommend": perda >= 10}, [placa_item(placa)])
    if s.chance(0.20 if not u.importou else 0.06):
        placa = rng.choice(u.placas)
        dias_csv = rng.randint(1, 60)
        s.emitir("import_readings", {"panel_id": placa["panel_id"], "rows": dias_csv * 288,
                                     "rows_ignored": rng.choice((0, 0, 0, rng.randint(1, 40)))},
                 [placa_item(placa)], segundos=rng.uniform(20, 90))
        u.importou = True
    s.rolar(75)
    if s.chance(0.02):
        texto, url = rng.choice(cat.SAIDAS)
        s.emitir("click", {"link_url": url, "link_domain": urlparse(url).hostname,
                           "link_text": texto, "outbound": True})


def _relatorio(s: Sessao, u: Usuario, veio_do_monitoramento: bool) -> None:
    s.navegar("relatorio", "cta_relatorio_mes" if veio_do_monitoramento else None)
    escopo = s.rng.choices(("todas", "grupo", "placa"), weights=(0.6, 0.25, 0.15))[0]
    placas = u.placas if escopo == "todas" else [s.rng.choice(u.placas)]
    mes = _mes_anterior(s.agora)
    s.emitir("generate_report", {"report_month": mes, "scope": escopo}, [placa_item(p) for p in placas],
             segundos=s.rng.uniform(1, 4))
    s.rolar(90, 1.1)
    if s.chance(0.35):
        s.emitir("file_download", {"file_name": f"relatorio-{mes}.pdf", "file_extension": "pdf",
                                   "report_month": mes})


def _limpeza(s: Sessao, u: Usuario, ids: Ids) -> None:
    s.navegar("limpeza")
    placa = s.rng.choice(u.placas)
    s.emitir("register_cleaning", {"panel_id": placa["panel_id"], "cleaning_id": ids.proxima_limpeza()},
             [placa_item(placa)], segundos=s.rng.uniform(15, 60))


def _excluir(s: Sessao, u: Usuario) -> None:
    """Abandono: exclui uma placa ou um grupo inteiro."""
    s.navegar("cadastro")
    group_id = s.rng.choice(list(u.grupos))
    if s.chance(0.3) or not u.grupos[group_id]:
        removidas = u.grupos.pop(group_id)
        s.emitir("delete_group", {"group_id": group_id, "panels_removed": len(removidas)},
                 segundos=s.rng.uniform(5, 30))
    else:
        placa = u.grupos[group_id].pop(s.rng.randrange(len(u.grupos[group_id])))
        s.emitir("delete_panel", {"panel_id": placa["panel_id"], "group_id": group_id},
                 [placa_item(placa)], segundos=s.rng.uniform(5, 30))
    if not u.placas:
        u.abandonou = True


def _no_app(s: Sessao, u: Usuario, ids: Ids, primeira: bool) -> None:
    """Uma visita depois de entrar: Início e as tarefas da visita."""
    rng = s.rng
    fator = u.canal["fator_ativacao"] * u.dispositivo["fator_ativacao"]
    s.abrir("home")
    s.rolar(50, u.dispositivo["fator_scroll"])
    if u.placas and s.chance(0.25):
        s.emitir("view_alerts", {"unread": rng.choice((0, 1, 1, 2, 3))})

    if not u.placas:
        # onboarding: sem placa não há o que monitorar
        if s.chance((0.55 if primeira else 0.30) * fator):
            s.navegar("cadastro")
            _cadastrar(s, u, ids, fator)
        elif s.chance(0.30):
            s.navegar("monitoramento")
    else:
        monitorou = False
        if s.chance(0.78):
            s.navegar("monitoramento")
            _monitorar(s, u, ids)
            monitorou = True
        if s.chance(0.24):
            _relatorio(s, u, monitorou and s.chance(0.5))
        if s.chance(0.16):
            _limpeza(s, u, ids)
        if s.chance(0.08):
            s.navegar("cadastro")
            _cadastrar(s, u, ids, fator)
        if s.chance(0.035):
            _excluir(s, u)

    if s.chance(0.07):
        s.navegar("configuracoes")
        setting = rng.choices(cat.CONFIGURACOES, weights=cat.PESOS_CONFIGURACAO)[0]
        s.emitir("change_settings", {"setting": setting}, segundos=rng.uniform(10, 60))
    if s.chance(0.12):
        s.emitir("logout", {"scope": rng.choices(("local", "global"), weights=(0.9, 0.1))[0]})
        u.saiu = True


def sessao_novo_usuario(rng: random.Random, ctx: Contexto, inicio: datetime, u: Usuario, ids: Ids) -> list[dict]:
    """Primeira visita de quem ainda não tem conta: criar a conta e, talvez, ativar."""
    s = Sessao(rng, ctx, inicio)
    if s.chance(0.30):
        s.abrir("login")
        s.navegar("register", "cta_criar_conta")
    else:
        s.abrir("register")
    s.rolar(50, u.dispositivo["fator_scroll"])
    fator = u.canal["fator_ativacao"] * u.dispositivo["fator_ativacao"]
    if not s.chance(0.62 * fator ** 0.5):
        return s.eventos
    u.user_id = "u-" + hex8(rng)
    ctx.user_id = u.user_id          # o user_id só passa a valer a partir do sign_up
    s.emitir("sign_up", {"method": "email"}, segundos=rng.uniform(30, 120))
    _no_app(s, u, ids, primeira=True)
    return s.eventos


def sessao_retorno(rng: random.Random, ctx: Contexto, inicio: datetime, u: Usuario, ids: Ids,
                   logado: bool) -> list[dict]:
    """Uma volta à plataforma: já logado (sessão salva) ou passando pelo login."""
    s = Sessao(rng, ctx, inicio)
    if not logado:
        s.abrir("login")
        ctx.user_id = u.user_id
        s.emitir("login", {"method": "email"}, segundos=rng.uniform(8, 40))
    _no_app(s, u, ids, primeira=False)
    return s.eventos


def _sortear(rng: random.Random, opcoes: tuple[dict, ...]) -> dict:
    return rng.choices(opcoes, weights=[o["peso"] for o in opcoes])[0]


def _inicio(rng: random.Random, data_inicial: datetime, dia: int) -> datetime:
    hora = rng.choices(range(24), weights=cat.PESOS_HORA)[0]
    return data_inicial + timedelta(days=dia, hours=hora, seconds=rng.uniform(0, 3599))


def _usinas_antigas(rng: random.Random, u: Usuario, ids: Ids) -> None:
    for _ in range(rng.choice((1, 1, 2))):
        group_id = ids.proximo(antigo=True)
        u.grupos[group_id] = [
            {"panel_id": ids.proximo(antigo=True), "group_id": group_id,
             "potencia_wp": rng.choices(cat.POTENCIAS_WP, weights=cat.PESOS_POTENCIA)[0]}
            for _ in range(rng.randint(1, 4))
        ]
    u.ativou = True


def _chance_de_voltar(u: Usuario) -> float:
    if u.user_id is None:
        return 0.06                      # não criou a conta: quase nunca volta
    base = 0.80 if u.ativou else 0.30
    if u.abandonou:
        base *= 0.2
    return base * u.canal["fator_retencao"]


def simular_visitante(rng: random.Random, data_inicial: datetime, dias: int,
                      ids: Ids | None = None) -> tuple[list[dict], int]:
    """Devolve (eventos do usuário, número de sessões simuladas)."""
    ids = ids or Ids()
    dispositivo = _sortear(rng, cat.DISPOSITIVOS)
    antigo = rng.random() < P_ANTIGO
    canal = cat.DIRETO if antigo else _sortear(rng, cat.CANAIS)
    u = Usuario("anon-" + hex8(rng), canal, dispositivo, antigo=antigo)
    if antigo:
        u.user_id = "u-" + hex8(rng)
        _usinas_antigas(rng, u, ids)

    eventos: list[dict] = []
    sessoes = 0
    dia = rng.randrange(dias)
    sessao_salva = antigo and rng.random() < 0.5
    while dia < dias and sessoes < MAX_SESSOES:
        inicio = _inicio(rng, data_inicial, dia)
        if sessoes == 0 and not antigo:
            ctx = Contexto(u.pseudo, canal, dispositivo, "s-" + hex8(rng))
            eventos += sessao_novo_usuario(rng, ctx, inicio, u, ids)
            sessao_salva = u.user_id is not None and not u.saiu
            u.saiu = False
        elif u.user_id is not None:
            # depois da primeira visita, quase todo mundo volta direto (favorito) ou pela newsletter
            volta_por = cat.DIRETO if rng.random() < 0.65 else canal
            if rng.random() < P_OUTRO_DISPOSITIVO:
                outro = _sortear(rng, cat.DISPOSITIVOS)
                ctx = Contexto("anon-" + hex8(rng), volta_por, outro, "s-" + hex8(rng))
                eventos += sessao_retorno(rng, ctx, inicio, u, ids, logado=False)
            else:
                logado = sessao_salva and rng.random() < P_SESSAO_SALVA
                ctx = Contexto(u.pseudo, volta_por, dispositivo, "s-" + hex8(rng), u.user_id if logado else None)
                eventos += sessao_retorno(rng, ctx, inicio, u, ids, logado=logado)
                sessao_salva = not u.saiu
            u.saiu = False
        else:
            # não criou a conta na primeira visita: às vezes volta e tenta de novo
            ctx = Contexto(u.pseudo, canal, dispositivo, "s-" + hex8(rng))
            eventos += sessao_novo_usuario(rng, ctx, inicio, u, ids)
            sessao_salva = u.user_id is not None and not u.saiu
            u.saiu = False
        sessoes += 1
        if rng.random() >= _chance_de_voltar(u):
            break
        dia += 1 + int(rng.expovariate(1 / 2.5))
    return eventos, sessoes


def simular(seed: int, dias: int, visitantes: int, data_inicial: datetime
            ) -> tuple[list[dict], int, random.Random]:
    """Simula todos os usuários. Devolve (eventos, sessões, rng) — o rng segue para a sujeira e os lotes."""
    rng = random.Random(seed)
    ids = Ids()
    eventos: list[dict] = []
    sessoes = 0
    for _ in range(visitantes):
        evs, n = simular_visitante(rng, data_inicial, dias, ids)
        eventos += evs
        sessoes += n
    return eventos, sessoes, rng
