import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TODOS,
  buscasSemResultado,
  cliquesDaTela,
  corDoCalor,
  duracao,
  funilTotal,
  paginaDe,
  pct,
  retencaoPorCanal,
  rolagemDaTela
} from "../src/lib/bi.js";

const BI = {
  funil_ativacao: [
    { canal: TODOS, dispositivo: TODOS, ordem: 2, etapa: "create_group", pessoas: 765 },
    { canal: "google / cpc", dispositivo: "desktop", ordem: 1, etapa: "sign_up", pessoas: 155 },
    { canal: TODOS, dispositivo: TODOS, ordem: 1, etapa: "sign_up", pessoas: 1500 }
  ],
  retencao: [
    { canal: "instagram / social", dia: 1, elegiveis: 198, taxa_retencao: 0.1869 },
    { canal: TODOS, dia: 7, elegiveis: 1125, taxa_retencao: 0.312 },
    { canal: TODOS, dia: 1, elegiveis: 1453, taxa_retencao: 0.4563 }
  ],
  buscas_seletor: [
    { termo: "bateria", buscas: 47, buscas_sem_resultado: 47 },
    { termo: "casa", buscas: 28, buscas_sem_resultado: 0 }
  ]
};

test("BI-FUNIL: só o total, na ordem das etapas", () => {
  assert.deepEqual(funilTotal(BI).map((l) => l.etapa), ["sign_up", "create_group"]);
  assert.deepEqual(funilTotal(null), []);
});

test("BI-RETENCAO: uma linha por canal com D1/D7, o total primeiro", () => {
  const linhas = retencaoPorCanal(BI);
  assert.equal(linhas[0].canal, TODOS);
  assert.equal(linhas[0].d1, 0.4563);
  assert.equal(linhas[0].d7, 0.312);
  assert.equal(linhas[1].d7, undefined);
});

test("BI-BUSCAS: só as que não acharam nada", () => {
  assert.deepEqual(buscasSemResultado(BI).map((l) => l.termo), ["bateria"]);
});

test("BI-FORMATO: percentual e duração", () => {
  assert.equal(pct(0.4563), "46%");
  assert.equal(pct(0.4563, 1), "45,6%");
  assert.equal(pct(null), "—");
  assert.equal(duracao(45), "45 s");
  assert.equal(duracao(125), "2 min 05 s");
});

test("BI-CALOR: azul a vermelho, limitado de 0 a 1", () => {
  assert.equal(corDoCalor(0), "hsl(240, 90%, 50%)");
  assert.equal(corDoCalor(1), "hsl(0, 90%, 50%)");
  assert.equal(corDoCalor(7), "hsl(0, 90%, 50%)");
  assert.equal(corDoCalor(null), "hsl(240, 90%, 50%)");
});

test("BI-MAPA: filtra cliques e rolagem pela página do caminho", () => {
  const mapa = {
    cliques: [{ pagina: "/app/home", element_id: "nav-monitoramento" }, { pagina: "/app/cadastro", element_id: "btn-salvar-placa" }],
    rolagem: [{ pagina: "/app/home", marco: 25 }, { pagina: "/app/home", marco: 0 }]
  };
  assert.equal(paginaDe("/app/home/?grupo=1#x"), "/app/home");
  assert.equal(paginaDe("/"), "/");
  assert.deepEqual(cliquesDaTela(mapa, "/app/home").map((l) => l.element_id), ["nav-monitoramento"]);
  assert.deepEqual(rolagemDaTela(mapa, "/app/home").map((l) => l.marco), [0, 25]);
  assert.deepEqual(cliquesDaTela(null, "/app/home"), []);
});
