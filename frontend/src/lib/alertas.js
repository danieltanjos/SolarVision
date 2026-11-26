import { toSaoPaulo } from "./periodo.js";

const relativo = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

// Quando o alerta foi gerado, em dias do calendário de São Paulo: "hoje", "ontem", "há 3 dias".
export function quando(iso, agora = new Date()) {
  const dia = (instante) => Math.floor(toSaoPaulo(instante).getTime() / 864e5);
  return relativo.format(dia(iso) - dia(agora), "day");
}

const HORA = 36e5;
const DIAS_DEFICIT = 7;

// Período a verificar após importar leituras: os últimos 7 dias do arquivo (até o fim da última hora).
// Histórico antigo não vira alerta: só o recente ainda dá para resolver. null sem leituras.
export function periodoDeficit(leituras) {
  if (!leituras.length) return null;
  // laço em vez de Math.min(...): um CSV de anos tem centenas de milhares de leituras
  let primeira = Infinity;
  let ultima = -Infinity;
  for (const { dataHora } of leituras) {
    const instante = Date.parse(dataHora);
    if (instante < primeira) primeira = instante;
    if (instante > ultima) ultima = instante;
  }
  const fim = Math.floor(ultima / HORA) * HORA + HORA;
  const inicio = Math.max(Math.floor(primeira / HORA) * HORA, fim - DIAS_DEFICIT * 24 * HORA);
  return { dataInicio: new Date(inicio).toISOString(), dataFim: new Date(fim).toISOString() };
}
