// Janelas do gráfico no relógio de São Paulo (o mesmo fuso em que o banco agrega),
// independente do fuso do navegador. Datas "de SP" são guardadas num Date lido com getUTC*/setUTC*.
// ponytail: offset fixo UTC-3 (Brasil sem horário de verão desde 2019); se voltar, trocar por Intl/Temporal.
const SP_OFFSET_MS = 3 * 60 * 60 * 1000;

export const TIME_ZONE = "America/Sao_Paulo";

// Instante real -> relógio de SP.
export function toSaoPaulo(instant) {
  return new Date(new Date(instant).getTime() - SP_OFFSET_MS);
}

// Relógio de SP -> instante real (ISO para o banco).
function toIso(spDate) {
  return new Date(spDate.getTime() + SP_OFFSET_MS).toISOString();
}

// Move a data de referencia em uma unidade da view (dia/semana/mes/ano).
export function shiftDate(date, view, direction) {
  const next = new Date(date);
  if (view === "dia") next.setUTCDate(next.getUTCDate() + direction);
  else if (view === "semana") next.setUTCDate(next.getUTCDate() + direction * 7);
  else if (view === "mes") next.setUTCMonth(next.getUTCMonth() + direction);
  else if (view === "ano") next.setUTCFullYear(next.getUTCFullYear() + direction);
  return next;
}

// Janela alinhada ao calendario a partir da data de referencia (fim inclusivo, 23:59:59.999).
export function rangeFor(view, referenceDate) {
  const start = new Date(referenceDate);
  start.setUTCHours(0, 0, 0, 0);
  if (view === "semana") start.setUTCDate(start.getUTCDate() - start.getUTCDay()); // domingo
  if (view === "mes") start.setUTCDate(1);
  if (view === "ano") start.setUTCMonth(0, 1);

  const end = shiftDate(start, view, 1);
  end.setTime(end.getTime() - 1);

  return { dataInicio: toIso(start), dataFim: toIso(end) };
}

// Mês do relatório ("AAAA-MM"): o da URL se for válido, senão o mês passado no relógio de SP.
// (shiftDate não serve: em 31/03, voltar um mês dá 31/02 = 03/03.)
export function mesRelatorio(mes, agora = new Date()) {
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(mes ?? "")) return mes;
  const hoje = toSaoPaulo(agora);
  return new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
}

// O que o relatório compara: o mês x o mês anterior; se o mês ainda não acabou, até agora x o mesmo trecho do anterior.
export function janelasRelatorio(mes, agora = new Date()) {
  const [ano, m] = mes.split("-").map(Number);
  const atual = rangeFor("mes", new Date(Date.UTC(ano, m - 1, 1)));
  const anterior = rangeFor("mes", new Date(Date.UTC(ano, m - 2, 1)));
  const [inicio, fim] = [Date.parse(atual.dataInicio), Date.parse(atual.dataFim)];
  const ate = Math.max(inicio, Math.min(fim, agora.getTime()));
  const fimAnterior = ate < fim ? Math.min(Date.parse(anterior.dataFim), Date.parse(anterior.dataInicio) + ate - inicio) : Date.parse(anterior.dataFim);
  return {
    atual: { dataInicio: atual.dataInicio, dataFim: new Date(ate).toISOString() },
    anterior: { dataInicio: anterior.dataInicio, dataFim: new Date(fimAnterior).toISOString() }
  };
}

export function formatRangeLabel(view, referenceDate) {
  const { dataInicio, dataFim } = rangeFor(view, referenceDate);
  const format = (iso, options) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: TIME_ZONE, ...options });

  if (view === "dia") {
    return format(dataInicio, { day: "2-digit", month: "2-digit", year: "numeric" });
  }
  if (view === "semana") {
    return `${format(dataInicio, { day: "2-digit", month: "2-digit" })} - ${format(dataFim, { day: "2-digit", month: "2-digit", year: "numeric" })}`;
  }
  if (view === "mes") {
    const label = format(dataInicio, { month: "long", year: "numeric" });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }
  return format(dataInicio, { year: "numeric" });
}
