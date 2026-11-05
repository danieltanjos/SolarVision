"""Assinatura Pro: checkout, compra e reembolso (a receita do SolarVision).

Roda depois de jornadas.simular, sobre os eventos limpos, com um rng só dele: assim a receita
entra no dado sem mudar nenhum evento de uso (o funil, o engajamento e o ML continuam com os
mesmos números). As sessões são remontadas como a Silver faz (mesmo user_pseudo_id, até 30 min
entre eventos), e o checkout entra no fim de uma sessão logada:

    click cta_conhecer_pro -> page_view /app/planos -> begin_checkout -> purchase

Só compra quem já tem placa e acompanha o monitoramento (a sessão tem view_monitoring), uma vez
por pessoa. O reembolso acontece numa sessão seguinte da mesma pessoa, em qualquer navegador,
até 7 dias depois da compra (direito de arrependimento). O canal de aquisição (o do sign_up;
para quem já tinha conta, "direct") muda as chances de comprar e de pedir o dinheiro de volta.
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from datetime import datetime, timedelta

from gerador import catalogo as cat
from gerador.eventos import Contexto, criar_evento, hex8, item, ler_iso

PAUSA_MAXIMA = timedelta(minutes=30)      # a mesma da Silver (R8)
P_COMPRA = 0.085        # por sessão elegível, antes dos fatores do canal
P_FINALIZA = 0.62       # de quem começou o checkout, quantos pagam
P_REEMBOLSO = 0.14      # por sessão dentro da janela de arrependimento, antes dos fatores
TELAS = {url: tela for tela, url in cat.PAGINAS.items()}


@dataclass
class Compra:
    transaction_id: str
    quando: datetime
    plano: dict
    valor: float
    fator_reembolso: float
    reembolsada: bool = False


def sessoes(eventos: list[dict]) -> list[list[dict]]:
    """Os eventos em sessões, na ordem em que o gerador os emitiu."""
    blocos: list[list[dict]] = []
    for e in eventos:
        anterior = blocos[-1][-1] if blocos else None
        if (anterior is None or anterior["user_pseudo_id"] != e["user_pseudo_id"]
                or ler_iso(e["event_ts"]) - ler_iso(anterior["event_ts"]) > PAUSA_MAXIMA):
            blocos.append([])
        blocos[-1].append(e)
    return blocos


def _canal_de_aquisicao(eventos: list[dict]) -> dict[str, tuple[str, str]]:
    """user_id -> (source, medium) do primeiro sign_up."""
    canais: dict[str, tuple[str, str]] = {}
    for e in eventos:
        if e["event_name"] == "sign_up" and e["user_id"] and e["user_id"] not in canais:
            canais[e["user_id"]] = (e["traffic"]["source"], e["traffic"]["medium"])
    return canais


def _continuar(ultimo: dict) -> Contexto:
    """O contexto do navegador no último evento da sessão, para os eventos seguintes."""
    return Contexto(ultimo["user_pseudo_id"], dict(ultimo["traffic"]), dict(ultimo["device"]),
                    ultimo["session_hint"], ultimo["user_id"], TELAS[ultimo["page"]["location"]],
                    ultimo["page"]["referrer"])


class _Fim:
    """Emite eventos depois do último da sessão, alguns segundos um do outro."""

    def __init__(self, rng: random.Random, ultimo: dict):
        self.rng, self.ctx, self.agora, self.eventos = rng, _continuar(ultimo), ler_iso(ultimo["event_ts"]), []

    def emitir(self, nome: str, params: dict, items: list | None = None, segundos=(4, 40)) -> None:
        self.agora += timedelta(seconds=self.rng.uniform(*segundos))
        self.eventos.append(criar_evento(self.rng, nome, self.agora, self.ctx, params, items))

    def abrir(self, tela: str, link_id: str) -> None:
        self.emitir("click", {"link_url": cat.PAGINAS[tela], "link_text": cat.TITULOS[tela],
                              "link_id": link_id, "outbound": False})
        self.ctx.referrer, self.ctx.pagina = cat.PAGINAS[self.ctx.pagina], tela
        self.emitir("page_view", {"page_title": f"{cat.TITULOS[tela]} · SolarVision"}, segundos=(1, 3))


def _checkout(rng: random.Random, ultimo: dict, fator_reembolso: float) -> tuple[list[dict], Compra | None]:
    fim = _Fim(rng, ultimo)
    fim.abrir("planos", "cta_conhecer_pro")
    plano = rng.choices(cat.PLANOS, weights=[p["peso"] for p in cat.PLANOS])[0]
    produto = item(plano)
    fim.emitir("begin_checkout", {"plano": plano["item_id"], "value": plano["price"], "currency": cat.MOEDA},
               [produto], segundos=(20, 120))
    if not rng.random() < P_FINALIZA:
        return fim.eventos, None
    pagamento = rng.choices(cat.PAGAMENTOS, weights=cat.PESOS_PAGAMENTO)[0]
    valor = round(plano["price"] * (1 - cat.DESCONTO_PIX if pagamento == "pix" else 1), 2)
    transacao = "T-" + hex8(rng) + hex8(rng)
    fim.emitir("purchase", {"transaction_id": transacao, "plano": plano["item_id"], "value": valor,
                            "currency": cat.MOEDA, "payment_type": pagamento},
               [item(plano, price=valor)], segundos=(30, 150))
    return fim.eventos, Compra(transacao, fim.agora, plano, valor, fator_reembolso * plano["fator_reembolso"])


def _reembolso(rng: random.Random, ultimo: dict, compra: Compra) -> list[dict]:
    fim = _Fim(rng, ultimo)
    fim.abrir("configuracoes", "cta_assinatura")
    fim.emitir("refund", {"transaction_id": compra.transaction_id, "plano": compra.plano["item_id"],
                          "value": compra.valor, "currency": cat.MOEDA},
               [item(compra.plano, price=compra.valor)], segundos=(15, 90))
    compra.reembolsada = True
    return fim.eventos


def simular_assinaturas(rng: random.Random, eventos: list[dict]) -> list[dict]:
    """Os eventos de checkout, compra e reembolso; `eventos` (o uso, sem sujeira) não muda."""
    canais = _canal_de_aquisicao(eventos)
    compras: dict[str, Compra] = {}
    tentou: set[str] = set()
    novos: list[dict] = []
    for sessao in sessoes(eventos):
        ultimo = sessao[-1]
        user_id = ultimo["user_id"]
        if user_id is None or ultimo["event_name"] == "logout":
            continue
        fator_compra, fator_reembolso = cat.FATORES_RECEITA.get(canais.get(user_id, ("direct", "(none)")), (1.0, 1.0))
        compra = compras.get(user_id)
        if compra is not None:
            na_janela = ler_iso(sessao[0]["event_ts"]) - compra.quando <= timedelta(days=cat.DIAS_ARREPENDIMENTO)
            if not compra.reembolsada and na_janela and rng.random() < P_REEMBOLSO * compra.fator_reembolso:
                novos += _reembolso(rng, ultimo, compra)
            continue
        monitorou = any(e["event_name"] == "view_monitoring" for e in sessao)
        if user_id in tentou or not monitorou or not rng.random() < P_COMPRA * fator_compra:
            continue
        tentou.add(user_id)
        evs, compra = _checkout(rng, ultimo, fator_reembolso)
        novos += evs
        if compra is not None:
            compras[user_id] = compra
    return novos
