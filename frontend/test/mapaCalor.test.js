import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PALETA_CALOR,
  VEU,
  corDoPixel,
  ganho,
  gradienteDaFaixa,
  marcoY,
  pintarCalor,
  pontosDoElemento
} from "../src/lib/mapaCalor.js";

const fonte = (caminho) => readFileSync(new URL(caminho, import.meta.url), "utf-8");
const COMPONENTE = fonte("../src/components/MapaCalor.jsx");
const LIB = fonte("../src/lib/mapaCalor.js");
const CSS = fonte("../src/styles/app.css");

test("paleta vai do azul ao vermelho passando por verde e amarelo, como no site do professor", () => {
  const cor = (i) => [...PALETA_CALOR.slice(i * 4, i * 4 + 3)];
  assert.equal(PALETA_CALOR.length, 256 * 4);
  assert.deepEqual(cor(0), [0, 0, 255]);
  assert.deepEqual(cor(255), [255, 0, 0]);
  const verde = cor(Math.round(0.5 * 255));
  assert.ok(verde[0] < 10 && verde[1] === 255 && verde[2] < 80, String(verde));
  assert.ok(cor(Math.round(0.72 * 255))[0] > 240 && cor(Math.round(0.72 * 255))[1] > 240);
});

test("elemento vira pontos espalhados pela área, com peso pela intensidade da Gold", () => {
  const botao = pontosDoElemento({ left: 0, top: 0, width: 120, height: 40 }, 1);
  assert.equal(botao.length, 2);                                       // 2 colunas × 1 linha
  assert.deepEqual(botao.map((p) => [p.x, p.y]), [[30, 20], [90, 20]]);
  assert.equal(botao[0].raio, 86);                                     // 40 × 0,9 + 50
  const frio = pontosDoElemento({ left: 0, top: 0, width: 10, height: 10 }, 0.01);
  assert.equal(frio[0].peso, 0.12 * 0.85);                             // mínimo para o pouco clicado aparecer
  assert.ok(pontosDoElemento({ left: 0, top: 0, width: 9999, height: 9999 }, 1).length <= 24);
});

test("o vermelho só aparece onde a Gold diz 1: o ganho leva o mais quente à cor do teto", () => {
  assert.equal(ganho(100, 1), 2.55);
  assert.equal(ganho(100, 0.5), 1.275);
  assert.equal(ganho(0, 1), 1);
  assert.equal(ganho(100, 0.01), (255 * 0.12) / 100);
});

test("pixel sem calor é o véu azul-escuro e o mais quente é vermelho", () => {
  assert.deepEqual(corDoPixel(0), [...VEU, 150]);
  assert.deepEqual(corDoPixel(255), [255, 0, 0, 235]);
  assert.deepEqual(corDoPixel(999), corDoPixel(255));
});

test("marcos da rolagem: o 0% é a primeira tela e o 100% o fim do documento", () => {
  assert.equal(marcoY(0, 3000, 1000), 1000);
  assert.equal(marcoY(50, 3000, 1000), 2000);
  assert.equal(marcoY(100, 3000, 1000), 3000);
  assert.equal(marcoY(50, 800, 1000), 800);                            // página menor que a janela
  const fundo = gradienteDaFaixa([{ marco: 0, pct_sessoes: 1 }, { marco: 50, pct_sessoes: 0.4 }], 3000, 1000);
  assert.equal(fundo, "linear-gradient(to bottom, rgba(5,8,40,0.000) 33.33%, rgba(5,8,40,0.450) 66.67%)");
});

test("mapa vazio não tem véu: sem pontos o canvas só é limpo", () => {
  const chamadas = [];
  const contexto = new Proxy({}, { get: (_, nome) => (...args) => { chamadas.push(nome); return args; } });
  const canvas = { getContext: () => contexto };
  pintarCalor(canvas, 1600, 1000, [], 1);
  assert.deepEqual(chamadas, ["clearRect"]);
  assert.equal(canvas.width, 400);                                     // desenha a 1/4 e estica
});

test("o mapa é desenhado em canvas com manchas difusas e a paleta, não em retângulos", () => {
  assert.match(COMPONENTE, /<canvas ref=\{canvasRef\}/);
  assert.match(LIB, /createRadialGradient/);
  assert.match(LIB, /getImageData/);
  assert.match(LIB, /PALETA_CALOR/);
  assert.doesNotMatch(COMPONENTE + CSS, /sv-calor-mancha/);
});

test("camadas do overlay não recebem clique", () => {
  for (const classe of ["sv-calor", "sv-calor-canvas", "sv-calor-faixa"]) {
    assert.match(CSS, new RegExp(`\\.${classe}\\s*\\{[^}]*pointer-events:\\s*none`), classe);
  }
  assert.match(CSS, /\.sv-calor-etiqueta,\s*\.sv-calor-marco\s*\{[^}]*pointer-events:\s*none/);
});

test("overlay redesenha quando o conteúdo muda de tamanho e a cada interação", () => {
  assert.match(COMPONENTE, /new ResizeObserver\(redesenharCalorDepois\)/);
  assert.match(COMPONENTE, /\["click", "input", "change"\]/);
  assert.match(COMPONENTE, /addEventListener\("scroll", redesenharCalorDepois, true\)/);
});

test("avisos falam a língua do aluno, como os do site do professor", () => {
  assert.match(COMPONENTE, /job de exportação do mapa de calor \(R11\)/);
  assert.match(COMPONENTE, /O mapa não tem cliques/);
  assert.match(COMPONENTE, /Mapa de calor gerado em/);
});
