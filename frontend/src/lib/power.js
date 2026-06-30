// Formatação de potência com auto-escala de unidade (W, kW, MW, GW).
// Usada no gráfico de geração e no resumo do dashboard para manter consistência.

export function powerUnit(value) {
  const v = Math.abs(Number(value) || 0);
  if (v >= 1e9) return { divisor: 1e9, suffix: "GW" };
  if (v >= 1e6) return { divisor: 1e6, suffix: "MW" };
  if (v >= 1e3) return { divisor: 1e3, suffix: "kW" };
  return { divisor: 1, suffix: "W" };
}

// Formata um valor em watts. Se `unit` for informado (ex.: unidade comum do gráfico,
// derivada do valor máximo da série), usa-o; senão deriva a unidade do próprio valor.
export function formatPower(value, unit) {
  const v = Number(value) || 0;
  const u = unit ?? powerUnit(v);
  const scaled = v / u.divisor;
  const decimals = u.suffix === "W" ? 0 : scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
  return `${scaled.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })} ${u.suffix}`;
}
