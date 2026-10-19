// Rastreamento de uso: a track() do app, no contrato de datalake/docs/CONTRATO_EVENTO.md.
// Porta da track() do site/index.html do projeto-modelo do professor (identidade, contexto, element_id),
// com envio em lotes para um transporte (a tabela eventos_coletados do Supabase) e opt-out.
//
// Nunca entram no evento: e-mail, nome, coordenadas, tarifa ou texto livre do usuário.

const CHAVE_PSEUDO = "sv-pseudo";
const CHAVE_DESLIGADO = "sv-rastreamento-desligado";
const INTERVALO_ENVIO_MS = 5000;
const MAX_FILA = 500;          // eventos guardados se o envio falhar (o resto é descartado)
const MAX_REGISTRO = 1000;     // eventos da sessão para o "Exportar JSONL" do painel de desenvolvedor
export const MARCOS_SCROLL = [25, 50, 75, 90];

// ---------------------------------------------------------------- funções puras (testadas no Node)

export function uuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 3) | 8).toString(16);
  });
}

// FNV-1a de 32 bits: o datalake liga os eventos da mesma pessoa sem saber quem ela é.
export function hashCurto(texto) {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function userIdDe(idSupabase) {
  return idSupabase ? `u-${hashCurto(String(idSupabase))}` : null;
}

const REDES = [
  [/(^|\.)google\./, "google", "organic"],
  [/(^|\.)bing\.com$/, "bing", "organic"],
  [/(^|\.)instagram\.com$/, "instagram", "social"],
  [/(^|\.)facebook\.com$/, "facebook", "social"],
  [/(^|\.)linkedin\.com$/, "linkedin", "social"],
  [/(^|\.)t\.co$/, "twitter", "social"]
];

// Canal de aquisição: utm_* da URL; senão o site de onde veio (referrer de outro domínio); senão direto.
export function canalDe({ search = "", referrer = "", host = "" } = {}) {
  const utm = new URLSearchParams(search);
  if (utm.get("utm_source")) {
    return { source: utm.get("utm_source"), medium: utm.get("utm_medium") || "(none)", campaign: utm.get("utm_campaign") || null };
  }
  let origem = null;
  try {
    origem = referrer ? new URL(referrer).hostname : null;
  } catch {
    origem = null;
  }
  if (!origem || origem === host) return { source: "direct", medium: "(none)", campaign: null };
  const rede = REDES.find(([padrao]) => padrao.test(origem));
  return rede
    ? { source: rede[1], medium: rede[2], campaign: null }
    : { source: origem.replace(/^www\./, ""), medium: "referral", campaign: null };
}

export function dispositivoDe(ua = "", largura = 1280) {
  const os = /Android/i.test(ua) ? "Android" : /iPhone|iPad/i.test(ua) ? "iOS" : /Windows/i.test(ua) ? "Windows"
    : /Mac/i.test(ua) ? "macOS" : "Linux";
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox/.test(ua) ? "Firefox" : /Chrome/.test(ua) ? "Chrome"
    : /Safari/.test(ua) ? "Safari" : "Outro";
  return { category: largura < 768 ? "mobile" : largura < 1024 ? "tablet" : "desktop", os, browser };
}

// Uma placa como item do evento (as placas envolvidas viram a tabela silver/itens do datalake).
export function placaItem(placa) {
  return { item_id: `placa-${placa.id}`, item_category: "placa", potencia_wp: Number(placa.potenciaWp) || null, quantity: 1 };
}

// element_id = data-heat do elemento clicado (ou do ancestral mais próximo).
export function elementoDe(alvo) {
  return alvo?.closest?.("[data-heat]")?.getAttribute("data-heat") ?? null;
}

export function montarEvento(nome, params, items, ctx, agora = new Date(), id = uuid()) {
  return {
    event_id: id,
    event_name: nome,
    event_ts: agora.toISOString(),
    user_pseudo_id: ctx.pseudo,
    user_id: ctx.userId ?? null,
    session_hint: ctx.sessao,
    page: { location: ctx.location, referrer: ctx.referrer ?? null },
    traffic: { ...ctx.canal },
    device: { ...ctx.dispositivo },
    params: Object.fromEntries(Object.entries(params ?? {}).filter(([, valor]) => valor !== undefined)),
    items: items ?? []
  };
}

// Marcos de scroll atingidos agora e ainda não registrados nesta tela.
export function marcosNovos(percentual, jaRegistrados) {
  return MARCOS_SCROLL.filter((marco) => percentual >= marco && !jaRegistrados.has(marco));
}

// ---------------------------------------------------------------- estado do navegador

const navegador = typeof window !== "undefined";

function ler(chave) {
  try {
    return window.localStorage.getItem(chave);
  } catch {
    return null;
  }
}

function gravar(chave, valor) {
  try {
    if (valor === null) window.localStorage.removeItem(chave);
    else window.localStorage.setItem(chave, valor);
  } catch {
    // modo privado ou armazenamento cheio: o rastreamento segue só na memória
  }
}

const estado = {
  iniciado: false,
  pseudo: null,
  userId: null,
  sessao: `s-${uuid().slice(0, 8)}`,
  canal: { source: "direct", medium: "(none)", campaign: null },
  referrerDaTela: null,
  ultimaTela: null,
  ultimoPageView: { caminho: null, quando: 0 },
  marcos: new Set(),
  fila: [],
  registro: [],
  transporte: null
};

function desligado() {
  return ler(CHAVE_DESLIGADO) === "1";
}

function contexto() {
  return {
    pseudo: estado.pseudo,
    userId: estado.userId,
    sessao: estado.sessao,
    location: window.location.origin + window.location.pathname,
    referrer: estado.referrerDaTela,
    canal: estado.canal,
    dispositivo: dispositivoDe(window.navigator.userAgent, window.innerWidth)
  };
}

async function enviar() {
  if (!estado.transporte || estado.fila.length === 0) return;
  const lote = estado.fila.splice(0, estado.fila.length);
  try {
    await estado.transporte(lote);
  } catch {
    estado.fila.unshift(...lote.slice(-MAX_FILA)); // tenta de novo no próximo ciclo
    estado.fila.splice(MAX_FILA);
  }
}

function aoRolar() {
  const doc = document.documentElement;
  const maximo = doc.scrollHeight - window.innerHeight;
  if (maximo <= 0) return;
  for (const marco of marcosNovos((window.scrollY / maximo) * 100, estado.marcos)) {
    estado.marcos.add(marco);
    track("scroll", { percent_scrolled: marco });
  }
}

// Chamado uma vez no main.jsx. transporte(lote) grava os eventos (Promise); sem ele, só registra na memória.
export function iniciarRastreamento({ transporte = null } = {}) {
  if (!navegador || estado.iniciado) return;
  estado.iniciado = true;
  estado.transporte = transporte;
  estado.pseudo = ler(CHAVE_PSEUDO) || `anon-${uuid().slice(0, 8)}`;
  gravar(CHAVE_PSEUDO, estado.pseudo);
  estado.canal = canalDe({ search: window.location.search, referrer: document.referrer, host: window.location.hostname });
  estado.referrerDaTela = document.referrer || null;

  let pausa;
  window.addEventListener("scroll", () => {
    clearTimeout(pausa);
    pausa = setTimeout(aoRolar, 150);
  }, { passive: true });
  window.setInterval(enviar, INTERVALO_ENVIO_MS);
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && enviar());
}

// id do usuário no Supabase (ou null ao sair): vira o user_id pseudonimizado dos próximos eventos.
export function definirUsuario(idSupabase) {
  estado.userId = userIdDe(idSupabase);
}

export function rastreamentoLigado() {
  return !desligado();
}

// Opt-out: desligado, nenhum evento novo é criado nem enviado (vale para este navegador).
export function definirRastreamento(ligado) {
  gravar(CHAVE_DESLIGADO, ligado ? null : "1");
  if (!ligado) estado.fila.length = 0;
}

export function track(nome, params = {}, items = []) {
  if (!navegador || !estado.iniciado || desligado()) return null;
  const evento = montarEvento(nome, params, items, contexto());
  estado.fila.push(evento);
  estado.registro.push(evento);
  if (estado.registro.length > MAX_REGISTRO) estado.registro.shift();
  return evento;
}

// Mesmo track(), com o element_id do elemento clicado (data-heat).
export function trackClique(nome, alvo, params = {}, items = []) {
  const elemento = elementoDe(alvo);
  return track(nome, elemento ? { ...params, element_id: elemento } : params, items);
}

// Entrada numa tela: page_view, referrer = tela anterior, marcos de scroll zerados.
// Ignora a repetição imediata da mesma tela (o StrictMode do React monta os efeitos duas vezes).
export function telaVista(titulo) {
  if (!navegador) return;
  const caminho = window.location.pathname;
  const agora = Date.now();
  if (estado.ultimoPageView.caminho === caminho && agora - estado.ultimoPageView.quando < 1000) return;
  estado.ultimoPageView = { caminho, quando: agora };
  if (estado.ultimaTela) estado.referrerDaTela = estado.ultimaTela;
  estado.ultimaTela = window.location.origin + caminho;
  estado.marcos = new Set();
  track("page_view", { page_title: titulo });
}

// Os eventos desta sessão, em JSON Lines (painel de desenvolvedor -> gerador/importar_site.py).
export function eventosEmJsonl() {
  return estado.registro.map((evento) => JSON.stringify(evento)).join("\n") + (estado.registro.length ? "\n" : "");
}
