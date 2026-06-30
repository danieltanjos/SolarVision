// Coloca a primeira letra de cada palavra em maiúscula (ex.: "luiz gustavo" -> "Luiz Gustavo").
// Usado para exibir o nome do usuário de forma consistente, independente de como foi digitado.
export function titleCase(value) {
  if (!value) return value ?? "";
  return String(value)
    .toLowerCase()
    .replace(/(^|\s|-)([\p{L}])/gu, (_, sep, letter) => sep + letter.toUpperCase());
}
