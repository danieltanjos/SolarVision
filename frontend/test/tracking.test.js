import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canalDe,
  criarFila,
  dispositivoDe,
  elementoDe,
  erroPermanente,
  hashCurto,
  marcosNovos,
  montarEvento,
  placaItem,
  telaRastreada,
  userIdDe
} from "../src/lib/tracking.js";

test("TRK-HASH: hash curto é estável, com 8 dígitos hex, e o user_id não revela o id", () => {
  assert.equal(hashCurto("abc"), hashCurto("abc"));
  assert.match(hashCurto("6f1c-uuid-do-supabase"), /^[0-9a-f]{8}$/);
  assert.notEqual(hashCurto("a"), hashCurto("b"));
  assert.match(userIdDe("6f1c-uuid"), /^u-[0-9a-f]{8}$/);
  assert.ok(!userIdDe("6f1c-uuid").includes("6f1c"));
  assert.equal(userIdDe(null), null);
});

for (const [entrada, esperado] of [
  [{ search: "?utm_source=instagram&utm_medium=social&utm_campaign=energia_limpa" },
    { source: "instagram", medium: "social", campaign: "energia_limpa" }],
  [{ search: "?utm_source=newsletter" }, { source: "newsletter", medium: "(none)", campaign: null }],
  [{ referrer: "https://www.google.com/", host: "solarvision-senai.vercel.app" }, { source: "google", medium: "organic", campaign: null }],
  [{ referrer: "https://l.instagram.com/", host: "x.app" }, { source: "instagram", medium: "social", campaign: null }],
  [{ referrer: "https://www.integrador-parceiro.com.br/obras", host: "x.app" },
    { source: "integrador-parceiro.com.br", medium: "referral", campaign: null }],
  [{ referrer: "https://x.app/app/home", host: "x.app" }, { source: "direct", medium: "(none)", campaign: null }],
  [{}, { source: "direct", medium: "(none)", campaign: null }],
  [{ referrer: "não é url" }, { source: "direct", medium: "(none)", campaign: null }]
]) {
  test(`TRK-CANAL: ${JSON.stringify(entrada)}`, () => assert.deepEqual(canalDe(entrada), esperado));
}

test("TRK-DISPOSITIVO: categoria pela largura, sistema e navegador pelo user agent", () => {
  const android = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36";
  const edge = "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/126 Safari/537.36 Edg/126";
  assert.deepEqual(dispositivoDe(android, 400), { category: "mobile", os: "Android", browser: "Chrome" });
  assert.deepEqual(dispositivoDe(edge, 1440), { category: "desktop", os: "Windows", browser: "Edge" });
  assert.equal(dispositivoDe(edge, 900).category, "tablet");
});

test("TRK-EVENTO: segue o contrato e descarta params indefinidos", () => {
  const ctx = {
    pseudo: "anon-1", userId: "u-abc", sessao: "s-1", location: "https://x.app/app/cadastro", referrer: "https://x.app/app/home",
    canal: { source: "google", medium: "organic", campaign: null }, dispositivo: { category: "desktop", os: "Windows", browser: "Chrome" }
  };
  const ev = montarEvento("create_panel", { panel_id: 10, group_id: undefined }, [placaItem({ id: 10, potenciaWp: "550" })],
    ctx, new Date("2026-10-03T14:22:05.123Z"), "id-1");
  assert.deepEqual(Object.keys(ev).sort(), ["device", "event_id", "event_name", "event_ts", "items", "page", "params",
    "session_hint", "traffic", "user_id", "user_pseudo_id"]);
  assert.equal(ev.event_ts, "2026-10-03T14:22:05.123Z");
  assert.deepEqual(ev.params, { panel_id: 10 });
  assert.deepEqual(ev.items, [{ item_id: "placa-10", item_category: "placa", potencia_wp: 550, quantity: 1 }]);
  assert.deepEqual(ev.page, { location: "https://x.app/app/cadastro", referrer: "https://x.app/app/home" });
});

test("TRK-SCROLL: marcos atingidos uma vez por tela", () => {
  assert.deepEqual(marcosNovos(60, new Set()), [25, 50]);
  assert.deepEqual(marcosNovos(95, new Set([25, 50])), [75, 90]);
  assert.deepEqual(marcosNovos(10, new Set()), []);
});

test("TRK-ELEMENTO: data-heat do elemento ou do ancestral mais próximo", () => {
  const botao = { closest: (sel) => (sel === "[data-heat]" ? { getAttribute: () => "btn-salvar-placa" } : null) };
  const solto = { closest: () => null };
  assert.equal(elementoDe(botao), "btn-salvar-placa");
  assert.equal(elementoDe(solto), null);
  assert.equal(elementoDe(null), null);
});

test("TRK-FILA: só envia depois de liberada (o opt-out da conta vale antes do primeiro envio)", async () => {
  const enviados = [];
  const fila = criarFila({ transporte: async (lote) => enviados.push(...lote) });
  fila.adicionar({ event_name: "login" });
  assert.equal(await fila.enviar(), "parada");
  assert.deepEqual(enviados, []);
  fila.descartar();                                         // a conta tinha desligado o rastreamento
  fila.liberar();
  assert.equal(await fila.enviar(), "parada");
  fila.adicionar({ event_name: "page_view" });
  assert.equal(await fila.enviar(), "enviada");
  assert.deepEqual(enviados.map((e) => e.event_name), ["page_view"]);
});

test("TRK-FILA: falha passageira devolve o lote, guardando só os mais novos", async () => {
  let falhar = true;
  const enviados = [];
  const fila = criarFila({ maximo: 3, transporte: async (lote) => {
    if (falhar) throw new Error("rede");
    enviados.push(...lote);
  } });
  fila.liberar();
  for (const n of [1, 2]) fila.adicionar({ n });
  assert.equal(await fila.enviar(), "falhou");
  for (const n of [3, 4]) fila.adicionar({ n });
  assert.deepEqual(fila.itens.map((e) => e.n), [2, 3, 4]);
  falhar = false;
  assert.equal(await fila.enviar(), "enviada");
  assert.deepEqual(enviados.map((e) => e.n), [2, 3, 4]);
});

test("TRK-FILA: tabela inexistente para a fila de vez, sem reenviar a cada 5 s", async () => {
  let chamadas = 0;
  const fila = criarFila({ transporte: async () => {
    chamadas += 1;
    throw { code: "PGRST205", message: "Could not find the table 'public.eventos_coletados'" };
  } });
  fila.liberar();
  fila.adicionar({ n: 1 });
  assert.equal(await fila.enviar(), "desligada");
  fila.adicionar({ n: 2 });
  assert.equal(await fila.enviar(), "parada");
  assert.equal(chamadas, 1);
  assert.equal(fila.ativa, false);
});

test("TRK-ERRO: erros permanentes são tabela ausente, sem permissão ou 404", () => {
  assert.ok(erroPermanente({ code: "42P01" }));
  assert.ok(erroPermanente({ code: "PGRST205" }));
  assert.ok(erroPermanente({ code: "42501" }));
  assert.ok(erroPermanente({ status: 404 }));
  assert.ok(!erroPermanente(new Error("Failed to fetch")));
  assert.ok(!erroPermanente(null));
});

test("TRK-TELA: o painel do ADMIN não é rastreado; as telas do produto são", () => {
  assert.equal(telaRastreada("/app/uso"), false);
  assert.equal(telaRastreada("/app/home"), true);
  assert.equal(telaRastreada("/login"), true);
});
