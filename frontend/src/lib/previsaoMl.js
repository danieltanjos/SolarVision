// Previsão de energia do modelo do datalake (tabela previsoes_ml): uma linha por placa e dia. O card
// "Previsão de geração" soma as placas da seleção e mostra, ao lado da estimativa física de cada dia, o que o
// modelo prevê (a física corrigida pelo histórico real de geração) e a faixa P10-P90.

// Soma as placas por dia: { "2026-11-24": { previstaWh, p10Wh, p90Wh, estimadaWh, modelo } }.
export function somarPorDia(linhas) {
  const dias = {};
  for (const linha of linhas ?? []) {
    const atual = dias[linha.dia] ?? { previstaWh: 0, p10Wh: 0, p90Wh: 0, estimadaWh: 0, modelo: linha.modelo };
    atual.previstaWh += Number(linha.previstaWh) || 0;
    atual.p10Wh += Number(linha.p10Wh ?? linha.previstaWh) || 0;
    atual.p90Wh += Number(linha.p90Wh ?? linha.previstaWh) || 0;
    atual.estimadaWh += Number(linha.estimadaWh) || 0;
    dias[linha.dia] = atual;
  }
  return dias;
}

// O dia (AAAA-MM-DD, no fuso de São Paulo) de um ponto x do dashboard_metricas.
export function diaDe(x, timeZone = "America/Sao_Paulo") {
  return new Date(x).toLocaleDateString("en-CA", { timeZone });
}

// Junta a previsão do modelo aos dias do card; dia sem previsão do modelo fica só com a física.
export function comModelo(dias, porDia, timeZone) {
  return (dias ?? []).map((dia) => ({ ...dia, modelo: porDia[diaDe(dia.x, timeZone)] ?? null }));
}
