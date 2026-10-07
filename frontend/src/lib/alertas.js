import { toSaoPaulo } from "./periodo.js";

const relativo = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

// Quando o alerta foi gerado, em dias do calendário de São Paulo: "hoje", "ontem", "há 3 dias".
export function quando(iso, agora = new Date()) {
  const dia = (instante) => Math.floor(toSaoPaulo(instante).getTime() / 864e5);
  return relativo.format(dia(iso) - dia(agora), "day");
}
