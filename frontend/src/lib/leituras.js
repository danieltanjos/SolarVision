// Leitura, no navegador, de um CSV de leituras de potência (datalogger/inversor) para importar em leituras_energia.
// ponytail: separador simples (sem aspas contendo o separador); trocar por um parser de CSV se aparecer arquivo assim.

// Separador "," ou ";" (o que mais aparece no cabeçalho) e vírgula decimal (comum com ";").
export function lerCsv(texto) {
  const [cabecalho, ...resto] = texto.replace(/^﻿/, "").split(/\r?\n/).filter((linha) => linha.trim());
  if (!cabecalho || resto.length === 0) throw new Error("Arquivo vazio ou só com o cabeçalho.");
  const contar = (caractere) => cabecalho.split(caractere).length;
  const separador = contar(";") > contar(",") ? ";" : ",";
  const celulas = (linha) => linha.split(separador).map((celula) => celula.trim().replace(/^"(.*)"$/, "$1"));
  return {
    separador,
    virgulaDecimal: separador === ";" && resto.slice(0, 20).some((linha) => /\d,\d/.test(linha)),
    colunas: celulas(cabecalho),
    linhas: resto.map(celulas)
  };
}

// "1234.5", "1234,5" ou "1.234,5" -> 1234.5; vazio ou texto -> NaN.
export function numero(texto = "") {
  const normalizado = texto.includes(",") ? texto.replace(/\./g, "").replace(",", ".") : texto;
  return normalizado.trim() === "" ? NaN : Number(normalizado);
}

// Data (aaaa-mm-dd ou dd/mm/aaaa) e hora (hh:mm[:ss]), juntas ou em colunas separadas, no horário de São Paulo -> ISO (UTC).
// Com fuso explícito (Z ou ±hh:mm) vale o do arquivo. Mesmo atalho de periodo.js: São Paulo = UTC-3 fixo.
export function paraIso(data = "", hora = "") {
  const texto = `${data} ${hora}`.trim();
  if (/T\d.*(Z|[+-]\d\d:?\d\d)$/.test(texto)) {
    const instante = new Date(texto);
    return Number.isNaN(instante.getTime()) ? null : instante.toISOString();
  }
  const m = texto.match(/^(?:(\d{4})-(\d{1,2})-(\d{1,2})|(\d{1,2})\/(\d{1,2})\/(\d{4}))[T ]+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const [ano, mes, dia] = m[1] ? [m[1], m[2], m[3]] : [m[6], m[5], m[4]];
  return new Date(Date.UTC(ano, mes - 1, dia, Number(m[7]) + 3, m[8], m[9] ?? 0)).toISOString();
}

// Palpite das colunas pelo nome; hora = -1 quando a data e a hora estão na mesma coluna.
export function adivinharColunas(colunas) {
  const achar = (regex, ...exceto) => colunas.findIndex((coluna, i) => !exceto.includes(i) && regex.test(coluna));
  const data = Math.max(0, achar(/data|dia|date|time|instante/i));
  const hora = achar(/hora|time/i, data);
  const potencia = achar(/pot|watt|wat|power|\bw\b/i, data, hora);
  return { data, hora, potencia: potencia >= 0 ? potencia : colunas.length - 1 };
}

// Linhas -> leituras { dataHora, watts }. O mesmo instante repetido fica com a última linha
// (o upsert recusa duas linhas com a mesma chave no mesmo lote).
export function montarLeituras(linhas, { data, hora, potencia }) {
  const porInstante = new Map();
  let invalidas = 0;
  for (const linha of linhas) {
    const dataHora = paraIso(linha[data], hora >= 0 ? linha[hora] : "");
    const watts = numero(linha[potencia]);
    if (dataHora && Number.isFinite(watts)) porInstante.set(dataHora, watts);
    else invalidas += 1;
  }
  return { leituras: [...porInstante].map(([dataHora, watts]) => ({ dataHora, watts })), invalidas };
}
