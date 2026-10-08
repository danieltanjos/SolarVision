// Dinheiro em reais no padrão pt-BR (R$ 1.234,56).
export function formatReais(valor) {
  return (Number(valor) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
