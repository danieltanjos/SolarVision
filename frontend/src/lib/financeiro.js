// Dinheiro em reais no padrão pt-BR (R$ 1.234,56).
export function formatReais(valor) {
  return (Number(valor) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// CO₂ evitado: kg até 1 tonelada, depois t.
export function formatCo2(kg) {
  const v = Number(kg) || 0;
  const [valor, unidade] = v >= 1000 ? [v / 1000, "t"] : [v, "kg"];
  return `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${unidade} CO₂`;
}
