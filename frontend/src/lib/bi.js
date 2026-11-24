// BI do uso da plataforma: o que o datalake exporta (datalake/pipeline/exportar_bi.py e
// exportar_mapa_calor.py) para o app. Em produção vem da tabela bi_exportacoes do Supabase (só ADMIN
// lê, pela RLS); em desenvolvimento, sem a linha no banco, dos arquivos locais gerados pelo datalake:
// frontend/public/bi/bi.js        -> window.SOLARVISION_BI  (página Uso da plataforma)
// frontend/public/bi/mapa_calor.js -> window.MAPA_CALOR      (overlay do mapa de calor)
// Os arquivos ficam fora do git (dados de negócio), por isso não existem na Vercel.

export const TODOS = "(todos)";

// Carrega uma exportação do datalake: primeiro do banco (doBanco, que devolve os dados ou null), depois do
// arquivo local, só fora do build de produção (lá o arquivo não existe e a Vercel devolveria o index.html).
export async function carregarExportacao(src, variavel, doBanco = null) {
  const doSupabase = doBanco ? await doBanco().catch(() => null) : null;
  if (doSupabase) return doSupabase;
  if (typeof window === "undefined" || import.meta.env?.PROD) return null;
  if (window[variavel]) return window[variavel];
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = `${src}?v=${Date.now()}`;
    script.onload = () => resolve(window[variavel] ?? null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
}

export const carregarBi = (doBanco) => carregarExportacao("/bi/bi.js", "SOLARVISION_BI", doBanco);
export const carregarMapaCalor = (doBanco) => carregarExportacao("/bi/mapa_calor.js", "MAPA_CALOR", doBanco);

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

// Os cliques da tela, do mais clicado ao menos: o arquivo vem ordenado por página e elemento
// (pipeline/exportar_mapa_calor.py), e o painel do overlay mostra os primeiros.
export function cliquesDaTela(mapa, caminho) {
  const pagina = paginaDe(caminho);
  return (mapa?.cliques ?? [])
    .filter((linha) => linha.pagina === pagina)
    .sort((a, b) => b.cliques - a.cliques || a.element_id.localeCompare(b.element_id));
}

export function rolagemDaTela(mapa, caminho) {
  const pagina = paginaDe(caminho);
  return (mapa?.rolagem ?? []).filter((linha) => linha.pagina === pagina).sort((a, b) => a.marco - b.marco);
}

// Cores das séries dos gráficos novos, nesta ordem fixa (validadas para daltonismo e contraste,
// nos temas claro e escuro).
export const CORES_SERIES = ["#2a6fb8", "#c98500", "#a1489f"];

const doTotal = (linha) => linha.canal === TODOS && linha.dispositivo === TODOS;

// Os dois funis lado a lado, por etapa: "em qualquer momento" (funil_ativacao) e "na ordem"
// (funil_ordenado, com as perdas, a mediana de horas desde a etapa anterior e o maior vazamento).
export function funilComparado(bi) {
  const ordenado = new Map((bi?.funil_ordenado ?? []).filter(doTotal).map((linha) => [linha.etapa, linha]));
  return funilTotal(bi).map((linha) => {
    const estrito = ordenado.get(linha.etapa) ?? {};
    return {
      ordem: linha.ordem,
      etapa: linha.etapa,
      qualquer_momento: linha.pessoas,
      na_ordem: estrito.pessoas ?? 0,
      perdidas: estrito.perdidas ?? null,
      mediana_horas: estrito.mediana_horas_desde_anterior ?? null,
      maior_vazamento: Boolean(estrito.maior_vazamento)
    };
  });
}

export function horas(valor) {
  if (valor == null) return "—";
  const h = Number(valor);
  if (h < 1) return `${Math.round(h * 60)} min`;
  return h < 48 ? `${h.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h` : `${Math.round(h / 24)} dias`;
}

// Recursos do produto do mais ao menos adotado.
export function recursosPorAdocao(bi) {
  return [...(bi?.adocao_recursos ?? [])].sort((a, b) => (b.taxa_adocao ?? 0) - (a.taxa_adocao ?? 0));
}

// O dia fechado mais recente com a janela de 28 dias completa (o MAU de verdade). O último dia do
// período ainda está em andamento e subestimaria o DAU. Sem nenhum assim, o último dia fechado.
export function atividadeAtual(bi) {
  const dias = (bi?.atividade_diaria ?? []).filter((dia) => dia.data).sort((a, b) => a.data.localeCompare(b.data));
  const fechados = dias.filter((dia) => dia.dia_completo !== false);
  return fechados.filter((dia) => dia.janela_completa).at(-1) ?? fechados.at(-1) ?? dias.at(-1) ?? null;
}

// Situação do portão de qualidade na última execução.
export function situacaoQualidade(bi) {
  const regras = bi?.qualidade_dados ?? [];
  if (!regras.length) return null;
  const falhas = regras.filter((r) => !r.ok && r.bloqueante);
  const alertas = regras.filter((r) => !r.ok && !r.bloqueante);
  return { executado_em: regras[0].executado_em, regras, falhas, alertas, ok: falhas.length === 0 };
}
