// Validação do modelo de geração estimada (public.potencia_estimada) contra leituras reais.
// Energia diária medida (CSV de 5 em 5 min) x energia diária estimada pelo MESMO modelo do app
// (GTI + temperatura do arquivo do Open-Meteo), com um fator de escala k = Wp × PR ajustado por mínimos quadrados.
// Uso, na raiz do repositório: node docs/validacao/validar-modelo.mjs   (GAMA=-0.30 para outro coef. de temperatura)
// Node 24, só stdlib + fetch. As respostas do Open-Meteo ficam em cache em <tmp>/solarvision-validacao.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CSV = new URL("../../supabase/seed/Dados_Tratados_CDTE-PSI.csv", import.meta.url);
// Suposição: laboratório Fotovoltaica-UFSC (Sapiens Parque, Florianópolis), de onde vieram os dados (commit b355a51).
const LOCAL = { latitude: -27.43, longitude: -48.44 };
const GAMA = Number(process.env.GAMA ?? -0.4); // %/°C, o padrão do app (CdTe costuma ter -0,25 a -0,34)
const ORIENTACOES = [
  [0, 0],
  ...[10, 20, 27, 35].flatMap((inclinacao) => [0, 45, 315, 90, 270].map((azimute) => [inclinacao, azimute]))
]; // [inclinação, azimute] com azimute 0 = Norte, 90 = Leste (convenção do app)
const NOME_AZIMUTE = { 0: "Norte", 45: "Nordeste", 315: "Noroeste", 90: "Leste", 270: "Oeste" };
const CACHE = join(tmpdir(), "solarvision-validacao");
const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const somar = (lista, f) => lista.reduce((total, item) => total + f(item), 0);
const pct = (x) => `${(x * 100).toFixed(1)}%`;

// 1. Energia medida por dia (horário de São Paulo, UTC-3 fixo: o centro de massa diário da potência fica perto do
//    meio-dia solar o ano todo, sem salto de horário de verão). Cada leitura = potência média de 5 min: Wh = W × 5/60.
const dias = new Map();
for (const linha of (await readFile(CSV, "utf8")).split(/\r?\n/).slice(1)) {
  const [dia, hora, watts] = linha.split(",");
  if (!watts) continue;
  const minuto = Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));
  const d = dias.get(dia) ?? { wh: 0, primeira: minuto, ultima: minuto, lacuna: 0 };
  d.lacuna = Math.max(d.lacuna, minuto - d.ultima);
  d.ultima = minuto;
  d.wh += (Number(watts) * 5) / 60;
  dias.set(dia, d);
}
// O datalogger só grava com geração: dia completo começa até 9h, vai além das 16h e não tem buraco > 15 min.
const completos = [...dias].filter(([, d]) => d.primeira <= 9 * 60 && d.ultima >= 16 * 60 && d.lacuna <= 15);
const [inicio, fim] = [[...dias.keys()][0], [...dias.keys()].at(-1)];

// 2. Clima horário do Open-Meteo no plano da placa (mesma URL do app: azimute deles é 0 = Sul).
async function clima(inclinacao, azimute) {
  const arquivo = join(CACHE, `${LOCAL.latitude}_${LOCAL.longitude}_${inclinacao}_${azimute}_${inicio}_${fim}.json`);
  try {
    return JSON.parse(await readFile(arquivo, "utf8"));
  } catch {
    // sem cache: busca
  }
  const url =
    `https://archive-api.open-meteo.com/v1/archive?latitude=${LOCAL.latitude}&longitude=${LOCAL.longitude}` +
    `&tilt=${inclinacao}&azimuth=${azimute - 180}&hourly=global_tilted_irradiance,temperature_2m&timezone=UTC` +
    `&start_date=${inicio}&end_date=${fim}`;
  for (;;) {
    const resposta = await fetch(url);
    if (resposta.status === 429) {
      console.error("Limite do Open-Meteo; esperando 60 s...");
      await esperar(60000);
      continue;
    }
    if (!resposta.ok) throw new Error(`Open-Meteo respondeu ${resposta.status}: ${await resposta.text()}`);
    const { hourly } = await resposta.json();
    await mkdir(CACHE, { recursive: true });
    await writeFile(arquivo, JSON.stringify(hourly));
    await esperar(15000); // 5 anos contam como ~136 chamadas; o limite gratuito é 600 por minuto
    return hourly;
  }
}

// potencia_estimada() com Wp = 1 e sem o PR 0,82 (os dois ficam no fator k), somada por dia de São Paulo.
// O Open-Meteo marca cada hora pelo fim do intervalo; o início é 1 h antes (como no app).
function estimadoPorDia({ time, global_tilted_irradiance: gti, temperature_2m: temperatura }) {
  const porDia = new Map();
  time.forEach((t, i) => {
    if (gti[i] == null || temperatura[i] == null) return;
    const dia = new Date(Date.parse(`${t}Z`) - 3600e3 - 3 * 3600e3).toISOString().slice(0, 10);
    const celula = temperatura[i] + (gti[i] * (45 - 20)) / 800;
    porDia.set(dia, (porDia.get(dia) ?? 0) + Math.max(0, (gti[i] / 1000) * (1 + (GAMA / 100) * (celula - 25))));
  });
  return porDia;
}

// 3. Ajuste k (mínimos quadrados pela origem) e erros depois do ajuste.
function avaliar(pares) {
  const k = somar(pares, (p) => p.medido * p.estimado) / somar(pares, (p) => p.estimado ** 2);
  const mediaM = somar(pares, (p) => p.medido) / pares.length;
  const mediaE = somar(pares, (p) => p.estimado) / pares.length;
  const r =
    somar(pares, (p) => (p.medido - mediaM) * (p.estimado - mediaE)) /
    Math.sqrt(somar(pares, (p) => (p.medido - mediaM) ** 2) * somar(pares, (p) => (p.estimado - mediaE) ** 2));
  const nmae = somar(pares, (p) => Math.abs(p.medido - k * p.estimado)) / somar(pares, (p) => p.medido);
  const meses = new Map();
  for (const p of pares) {
    const m = meses.get(p.dia.slice(0, 7)) ?? { medido: 0, estimado: 0 };
    m.medido += p.medido;
    m.estimado += k * p.estimado;
    meses.set(p.dia.slice(0, 7), m);
  }
  const mapeMensal = somar([...meses.values()], (m) => Math.abs(m.medido - m.estimado) / m.medido) / meses.size;
  return { k, r, nmae, mapeMensal, dias: pares.length, meses };
}

const pares = (porDia, filtro = () => true) =>
  completos
    .filter(([dia]) => porDia.has(dia) && filtro(dia))
    .map(([dia, d]) => ({ dia, medido: d.wh, estimado: porDia.get(dia) }));

console.log(`CSV: ${dias.size} dias com leitura (${inicio} a ${fim}), ${completos.length} completos.`);
console.log(`Local ${LOCAL.latitude}, ${LOCAL.longitude}; coef. de temperatura ${GAMA} %/°C.\n`);
console.log("| Inclinação | Orientação | r diário | nMAE diário | MAPE mensal | k = Wp × PR (W) |");
console.log("|---|---|---|---|---|---|");
const resultados = [];
for (const [inclinacao, azimute] of ORIENTACOES) {
  const porDia = estimadoPorDia(await clima(inclinacao, azimute));
  const a = avaliar(pares(porDia));
  resultados.push({ inclinacao, azimute, porDia, ...a });
  console.log(
    `| ${inclinacao}° | ${inclinacao ? NOME_AZIMUTE[azimute] : "—"} | ${a.r.toFixed(3)} | ${pct(a.nmae)} | ${pct(a.mapeMensal)} | ${a.k.toFixed(0)} |`
  );
}

// 4. Melhor orientação: k por ano e por mês do ano (um PR fixo só serve se k for estável),
//    e os meses fora da curva (k do mês < 75% da mediana), que são falha/sombra/sujeira, não clima.
const melhor = resultados.reduce((a, b) => (b.nmae < a.nmae ? b : a));
console.log(`\nMelhor ajuste: ${melhor.inclinacao}° ${NOME_AZIMUTE[melhor.azimute] ?? ""} (k = ${melhor.k.toFixed(0)} W).`);
const razaoMes = [...melhor.meses].map(([mes, m]) => [mes, (m.medido / m.estimado) * melhor.k]);
const mediana = razaoMes.map(([, k]) => k).sort((a, b) => a - b)[Math.floor(razaoMes.length / 2)];
const foraDaCurva = new Set(razaoMes.filter(([, k]) => k < 0.75 * mediana).map(([mes]) => mes));
console.log(`Meses fora da curva (k < 75% da mediana de ${mediana.toFixed(0)} W): ${[...foraDaCurva].join(", ") || "nenhum"}`);

const limpo = avaliar(pares(melhor.porDia, (dia) => !foraDaCurva.has(dia.slice(0, 7))));
console.log(
  `Sem esses meses: r diário ${limpo.r.toFixed(3)}, nMAE diário ${pct(limpo.nmae)}, MAPE mensal ${pct(limpo.mapeMensal)}, ` +
    `k = ${limpo.k.toFixed(0)} W (${limpo.dias} dias). Com PR 0,82, isso equivale a ${(limpo.k / 0.82).toFixed(0)} Wp.`
);

const kPor = (chave) => {
  const grupos = new Map();
  for (const p of pares(melhor.porDia, (dia) => !foraDaCurva.has(dia.slice(0, 7)))) {
    const g = grupos.get(chave(p.dia)) ?? [];
    g.push(p);
    grupos.set(chave(p.dia), g);
  }
  return [...grupos]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([g, lista]) => `${g}: ${(somar(lista, (p) => p.medido) / somar(lista, (p) => p.estimado)).toFixed(0)}`)
    .join(" · ");
};
console.log(`k por ano (W): ${kPor((dia) => dia.slice(0, 4))}`);
console.log(`k por mês do ano (W): ${kPor((dia) => dia.slice(5, 7))}`);
