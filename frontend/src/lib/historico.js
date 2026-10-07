import { toSaoPaulo } from "./periodo.js";

// dashboard_historico só conta os anos com dados no período inteiro (o 5º costuma ser parcial).
export const textoAnos = (anos) => `${anos} ${anos === 1 ? "ano" : "anos"}`;

// Estimado do período x média histórica, só nos baldes que os dois têm: "Clima 12% abaixo da média de 5 anos".
// O último balde com estimativa pode estar pela metade (a previsão vai só 7 dias à frente, ex.: o mês atual
// na visão Ano); se o período continua depois dele, fica de fora.
export function comparacaoClima(points, historico) {
  const media = new Map(historico.map((h) => [Date.parse(h.x), Number(h.mediaWh)]));
  const comuns = points.filter((p) => p.estimadaWh != null && media.has(Date.parse(p.x)));
  if (comuns.length && Date.parse(comuns.at(-1).x) < Date.parse(historico.at(-1).x)) comuns.pop();

  const base = comuns.reduce((total, p) => total + media.get(Date.parse(p.x)), 0);
  if (!base) return null;
  const atual = comuns.reduce((total, p) => total + Number(p.estimadaWh), 0);
  const pct = Math.round((atual / base - 1) * 100);
  const referencia = `média de ${textoAnos(historico[0].anos)}`;
  return pct === 0 ? `Clima na ${referencia}` : `Clima ${Math.abs(pct)}% ${pct < 0 ? "abaixo" : "acima"} da ${referencia}`;
}

// Erro da previsão guardada: |previsto − ocorrido| ÷ ocorrido. Em vários dias, ponderado pela energia
// (um dia fechado, com quase nada gerado, não explode a média).
export function erroPrevisao(dias) {
  const validos = dias.filter((d) => Number(d.ocorridoWh) > 0);
  const ocorrido = validos.reduce((total, d) => total + Number(d.ocorridoWh), 0);
  return ocorrido ? validos.reduce((total, d) => total + Math.abs(d.previstoWh - d.ocorridoWh), 0) / ocorrido : null;
}

// Energia estimada por dia (balde "dia" do dashboard_metricas) numa grade mês × dia (12 × 31); sem dado = null.
export function calendarioAno(points) {
  const grade = Array.from({ length: 12 }, () => Array(31).fill(null));
  for (const point of points) {
    const dia = toSaoPaulo(point.x);
    grade[dia.getUTCMonth()][dia.getUTCDate() - 1] = Number(point.estimadaWh);
  }
  return grade;
}
