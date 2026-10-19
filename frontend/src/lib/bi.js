// BI do uso da plataforma: o que o datalake exporta (datalake/pipeline/exportar_bi.py) para o app.
// frontend/public/bi/bi.js        -> window.SOLARVISION_BI  (página Uso da plataforma)
// frontend/public/bi/mapa_calor.js -> window.MAPA_CALOR      (overlay do mapa de calor)
// Os dois arquivos são gerados pelo datalake e ficam fora do git (dados de negócio).

export const TODOS = "(todos)";

// Carrega um dos arquivos do datalake e devolve a variável que ele define, ou null se não houver.
// Sem o arquivo, a Vercel devolve o index.html: o script não define nada e o resultado é null.
export function carregarExportacao(src, variavel) {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window[variavel]) return Promise.resolve(window[variavel]);
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = `${src}?v=${Date.now()}`;
    script.onload = () => resolve(window[variavel] ?? null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
}

export const carregarBi = () => carregarExportacao("/bi/bi.js", "SOLARVISION_BI");
export const carregarMapaCalor = () => carregarExportacao("/bi/mapa_calor.js", "MAPA_CALOR");

export function pct(fracao, casas = 0) {
  if (fracao == null || !Number.isFinite(Number(fracao))) return "—";
  return `${(Number(fracao) * 100).toLocaleString("pt-BR", { maximumFractionDigits: casas })}%`;
}

export function duracao(segundos) {
  if (segundos == null) return "—";
  const s = Math.round(Number(segundos));
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s`;
}

// Linhas do funil no total (canal e dispositivo "(todos)"), na ordem das etapas.
export function funilTotal(bi) {
  return (bi?.funil_ativacao ?? [])
    .filter((linha) => linha.canal === TODOS && linha.dispositivo === TODOS)
    .sort((a, b) => a.ordem - b.ordem);
}

// Retenção em formato de tabela: uma linha por canal com D1, D7 e D14 (o total primeiro).
export function retencaoPorCanal(bi) {
  const porCanal = new Map();
  for (const linha of bi?.retencao ?? []) {
    const atual = porCanal.get(linha.canal) ?? { canal: linha.canal };
    atual[`d${linha.dia}`] = linha.taxa_retencao;
    atual[`elegiveis_d${linha.dia}`] = linha.elegiveis;
    porCanal.set(linha.canal, atual);
  }
  return [...porCanal.values()].sort((a, b) => (a.canal === TODOS ? -1 : b.canal === TODOS ? 1 : a.canal.localeCompare(b.canal)));
}

// O que se busca no seletor de usinas e não se encontra (lacunas do produto).
export function buscasSemResultado(bi, limite = 6) {
  return (bi?.buscas_seletor ?? []).filter((linha) => linha.buscas_sem_resultado > 0).slice(0, limite);
}

// Escala de calor: azul (pouco clique) -> verde -> amarelo -> vermelho (muito clique).
export function corDoCalor(intensidade) {
  const t = Math.min(1, Math.max(0, Number(intensidade) || 0));
  return `hsl(${Math.round(240 * (1 - t))}, 90%, 50%)`;
}

// Página de um caminho como no datalake: sem domínio, # e ?; a raiz vira "/".
export function paginaDe(caminho) {
  return caminho.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
}

export function cliquesDaTela(mapa, caminho) {
  const pagina = paginaDe(caminho);
  return (mapa?.cliques ?? []).filter((linha) => linha.pagina === pagina);
}

export function rolagemDaTela(mapa, caminho) {
  const pagina = paginaDe(caminho);
  return (mapa?.rolagem ?? []).filter((linha) => linha.pagina === pagina).sort((a, b) => a.marco - b.marco);
}
