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

test("cliques da tela vêm do mais clicado ao menos, mesmo com o arquivo em ordem alfabética", () => {
  const mapa = {
    cliques: [
      { pagina: "/app/home", element_id: "btn-alertas", cliques: 868 },
      { pagina: "/app/home", element_id: "cta-assinatura", cliques: 4 },
      { pagina: "/app/home", element_id: "nav-cadastro", cliques: 942 },
      { pagina: "/app/home", element_id: "nav-relatorio", cliques: 868 },
      { pagina: "/app/cadastro", element_id: "btn-salvar-placa", cliques: 2000 }
    ]
  };
  assert.deepEqual(cliquesDaTela(mapa, "/app/home").map((l) => l.element_id),
    ["nav-cadastro", "btn-alertas", "nav-relatorio", "cta-assinatura"]);
});

test("funil comparado junta qualquer momento e na ordem, por etapa", async () => {
  const { funilComparado } = await import("../src/lib/bi.js");
  const bi = {
    funil_ativacao: [
      { canal: TODOS, dispositivo: TODOS, ordem: 1, etapa: "sign_up", pessoas: 100 },
      { canal: TODOS, dispositivo: TODOS, ordem: 2, etapa: "create_group", pessoas: 70 }
    ],
    funil_ordenado: [
      { canal: TODOS, dispositivo: TODOS, ordem: 2, etapa: "create_group", pessoas: 60, perdidas: 40,
        mediana_horas_desde_anterior: 0.5, maior_vazamento: true },
      { canal: "x", dispositivo: "mobile", ordem: 2, etapa: "create_group", pessoas: 1 }
    ]
  };
  const [cadastro, grupo] = funilComparado(bi);
  assert.equal(cadastro.na_ordem, 0);
  assert.deepEqual([grupo.qualquer_momento, grupo.na_ordem, grupo.perdidas, grupo.maior_vazamento], [70, 60, 40, true]);
});

test("horas legíveis: minutos, horas e dias", async () => {
  const { horas } = await import("../src/lib/bi.js");
  assert.equal(horas(0.25), "15 min");
  assert.equal(horas(5.5), "5,5 h");
  assert.equal(horas(72), "3 dias");
  assert.equal(horas(null), "—");
});

test("atividade atual prefere o último dia com a janela de 28 dias completa", async () => {
  const { atividadeAtual } = await import("../src/lib/bi.js");
  const dias = [
    { data: "2026-09-30", mau: 900, janela_completa: true },
    { data: "2026-10-01", mau: 950, janela_completa: true },
    { data: "2026-09-01", mau: 10, janela_completa: false },
    { data: "2026-10-02", mau: 960, janela_completa: true, dia_completo: false }
  ];
  assert.equal(atividadeAtual({ atividade_diaria: dias }).data, "2026-10-01");     // o dia 2 ainda não fechou
  assert.equal(atividadeAtual({ atividade_diaria: [dias[2]] }).data, "2026-09-01");
  assert.equal(atividadeAtual({}), null);
});

test("situação da qualidade separa falha bloqueante de alerta", async () => {
  const { situacaoQualidade } = await import("../src/lib/bi.js");
  const s = situacaoQualidade({ qualidade_dados: [
    { regra: "taxa de duplicatas", ok: false, bloqueante: false, executado_em: "2026-10-02T00:00:00" },
    { regra: "taxa de rejeição", ok: true, bloqueante: true, executado_em: "2026-10-02T00:00:00" }
  ] });
  assert.equal(s.ok, true);
  assert.deepEqual(s.alertas.map((r) => r.regra), ["taxa de duplicatas"]);
  assert.equal(situacaoQualidade({}), null);
});
