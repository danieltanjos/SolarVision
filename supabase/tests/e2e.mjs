// Teste de ponta a ponta: o api.js do frontend contra o Supabase real (o mesmo banco de QA e produção).
// Uso: node --env-file=frontend/.env.local --test supabase/tests/e2e.mjs
// Usa uma conta fixa (criada na 1ª execução) e apaga o grupo/placa/limpeza/clima que criar.
// O teste do clima espera o pg_cron (até ~3 min).
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

// O supabase-js está instalado só no frontend.
const { createClient } = createRequire(new URL("../../frontend/package.json", import.meta.url))("@supabase/supabase-js");
import * as api from "../../frontend/src/lib/api.js";

const { supabase } = api;
const email = process.env.E2E_EMAIL ?? "e2e-solarvision@mailinator.com";
const senha = process.env.E2E_SENHA ?? "Solar-E2E-2026!";
const sufixo = Date.now();
let grupo;
let placa;

before(async () => {
  const login = await supabase.auth.signInWithPassword({ email, password: senha });
  if (login.error) {
    const cadastro = await supabase.auth.signUp({ email, password: senha, options: { data: { nome: "E2E SolarVision" } } });
    if (cadastro.error) throw cadastro.error;
    assert.ok(cadastro.data.session, "signUp sem sessão: desligue 'Confirm email' no Supabase Auth");
  }
});

after(async () => {
  if (grupo) await supabase.from("grupos_solares").delete().eq("id", grupo.id); // cascata: placa e limpeza
  await supabase.auth.signOut();
});

test("anônimo não lê dados (RLS)", async () => {
  const rest = (caminho, init) =>
    fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/${caminho}`, {
      ...init,
      headers: { apikey: process.env.VITE_SUPABASE_PUBLISHABLE_KEY }
    });
  assert.deepEqual(await (await rest("grupos_solares?select=id")).json(), []);
  assert.ok(!(await rest("rpc/dashboard_resumo", { method: "POST" })).ok);
});

test("perfil criado pelo trigger", async () => {
  const perfil = await api.getCurrentUser();
  assert.equal(perfil.email, email);
  assert.equal(perfil.role, "USER");
});

test("cadastra grupo, placa e limpeza no formato da API antiga", async () => {
  await api.createGroup({ nome: `  Grupo E2E ${sufixo} `, status: "ATIVO", latitude: -27.59, longitude: -48.55 });
  grupo = (await api.listGroups()).find((g) => g.nome === `Grupo E2E ${sufixo}`);
  assert.equal(grupo.totalPlacas, 0);

  await api.createPanel({ grupoId: grupo.id, modelo: "Placa E2E", status: "ATIVA", potenciaWp: 3000, inclinacao: 27, azimute: 0 });
  placa = (await api.listPanels()).find((p) => p.grupoId === grupo.id);
  assert.equal(placa.grupoNome, grupo.nome);
  assert.equal(placa.potenciaWp, 3000);
  assert.equal(placa.latitude, -27.59);
  assert.equal((await api.listGroups()).find((g) => g.id === grupo.id).totalPlacas, 1);

  await api.createCleaning({ placaId: placa.id, dataLimpeza: new Date().toISOString(), observacao: " e2e " });
  const limpeza = (await api.listCleanings()).find((l) => l.placaId === placa.id);
  assert.equal(limpeza.placaModelo, "Placa E2E");
  assert.equal(limpeza.observacao, "e2e");
});

test("outro usuário não vê nem apaga o grupo (RLS por dono)", async () => {
  const outro = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false }
  });
  const conta = { email: email.replace("@", "-2@"), password: senha };
  if ((await outro.auth.signInWithPassword(conta)).error) {
    const cadastro = await outro.auth.signUp({ ...conta, options: { data: { nome: "E2E SolarVision 2" } } });
    if (cadastro.error) throw cadastro.error;
  }
  const { data: visiveis } = await outro.from("grupos_solares").select("id").eq("id", grupo.id);
  assert.deepEqual(visiveis, []);
  await outro.from("grupos_solares").delete().eq("id", grupo.id);
  assert.ok((await api.listGroups()).some((g) => g.id === grupo.id), "o grupo foi apagado por outro usuário");
  await outro.auth.signOut();
});

test("pg_cron carrega 5 anos de clima da placa nova e o dashboard estima a geração", { timeout: 240000 }, async () => {
  // o job roda a cada minuto; espera até ~3 min
  for (let tentativa = 0; tentativa < 18 && !placa.climaHistoricoEm; tentativa += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10000));
    placa = (await api.listPanels()).find((p) => p.id === placa.id);
  }
  assert.ok(placa.climaHistoricoEm, "o histórico de clima não foi carregado em 3 min");

  const anoPassado = await api.getDashboardMetrics({
    granularidade: "mes",
    dataInicio: new Date(Date.now() - 4 * 365 * 864e5).toISOString(),
    dataFim: new Date(Date.now() - 3 * 365 * 864e5).toISOString()
  });
  assert.ok(anoPassado.filter((p) => p.estimada > 0).length >= 11, "esperava ~12 meses de estimativa de 3–4 anos atrás");

  // Filtros do Monitoramento: o grupo E2E só tem esta placa, então grupo e placa dão a mesma série.
  const mes = { granularidade: "dia", dataInicio: new Date(Date.now() - 30 * 864e5).toISOString(), dataFim: new Date().toISOString() };
  const daPlaca = await api.getDashboardMetrics({ ...mes, placaId: placa.id });
  assert.ok(daPlaca.length >= 30 && daPlaca.some((p) => p.estimadaWh > 0), "sem energia estimada da placa no último mês");
  assert.deepEqual(await api.getDashboardMetrics({ ...mes, grupoId: grupo.id }), daPlaca);
  assert.deepEqual(await api.getDashboardMetrics({ ...mes, placaId: -1 }), []);

  // Real simulado = estimado menos a sujeira: antes da limpeza (registrada agora há pouco) a perda está no limite de 20%.
  const antesDaLimpeza = daPlaca.filter((p) => new Date(p.x) < Date.now() - 2 * 864e5 && p.estimadaWh > 0);
  assert.ok(antesDaLimpeza.length > 0 && antesDaLimpeza.every((p) => Math.abs(p.medidaWh - 0.8 * p.estimadaWh) < 0.05), "real deveria ser 80% do estimado");
  placa = (await api.listPanels()).find((p) => p.id === placa.id);
  assert.ok(placa.perdaSujeira < 0.001, "placa recém-limpa deveria estar sem perda");

  // Estimado com a previsão do tempo (7 dias); real nunca no futuro.
  const proximos = await api.getDashboardMetrics({
    granularidade: "dia",
    dataInicio: new Date(Date.now() + 864e5).toISOString(),
    dataFim: new Date(Date.now() + 8 * 864e5).toISOString(),
    placaId: placa.id
  });
  assert.ok(proximos.filter((p) => p.estimadaWh > 0).length >= 5, "esperava previsão para os próximos dias");
  assert.ok(proximos.every((p) => p.medidaWh == null), "real não pode existir no futuro");

  const resumo = await api.getDashboardSummary();
  assert.ok(resumo.placasAtivas >= 1);
  assert.ok(resumo.previsaoAmanha > 0, "sem previsão para amanhã");
  assert.ok(resumo.totalGeradoHoje >= 0);
});

test("média de 5 anos alinhada ao gráfico e acerto da previsão", async () => {
  const semana = { granularidade: "dia", dataInicio: new Date(Date.now() - 7 * 864e5).toISOString(), dataFim: new Date().toISOString(), placaId: placa.id };
  const [metricas, historico] = await Promise.all([api.getDashboardMetrics(semana), api.getDashboardHistorico(semana)]);
  assert.deepEqual(historico.map((h) => h.x), metricas.map((m) => m.x));
  assert.ok(historico.every((h) => h.anos >= 4 && h.minWh <= h.mediaWh && h.mediaWh <= h.maxWh), "média fora do mínimo/máximo");
  assert.deepEqual(await api.getAcertoPrevisao({ placaId: placa.id }), []); // a previsão só é guardada às 21:00
});

test("erros chegam traduzidos", async () => {
  const granularidade = await api.getDashboardMetrics({ granularidade: "ano" }).catch(api.extractErrorMessage);
  assert.match(granularidade, /Granularidade inválida/);
  const nomeEmBranco = await api.createGroup({ nome: "   ", status: "ATIVO" }).catch(api.extractErrorMessage);
  assert.equal(nomeEmBranco, "Dados inválidos.");
  const leitura = await supabase.from("leituras_energia").insert({ placa_id: placa.id, data_hora: new Date().toISOString(), wats_gerados: 1 });
  assert.ok(leitura.error, "usuário comum não deve inserir leituras");
});
