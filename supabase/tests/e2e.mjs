// Teste de ponta a ponta: o api.js do frontend contra o Supabase real (o mesmo banco de QA e produção).
// Uso: node --env-file=frontend/.env.local --test supabase/tests/e2e.mjs
// Usa uma conta fixa (criada na 1ª execução) e apaga o grupo/placa/limpeza que criar.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
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
  await api.createGroup({ nome: `  Grupo E2E ${sufixo} `, status: "ATIVO" });
  grupo = (await api.listGroups()).find((g) => g.nome === `Grupo E2E ${sufixo}`);
  assert.equal(grupo.totalPlacas, 0);

  await api.createPanel({ grupoId: grupo.id, modelo: "Placa E2E", status: "ATIVA" });
  placa = (await api.listPanels()).find((p) => p.grupoId === grupo.id);
  assert.equal(placa.grupoNome, grupo.nome);
  assert.equal((await api.listGroups()).find((g) => g.id === grupo.id).totalPlacas, 1);

  await api.createCleaning({ placaId: placa.id, dataLimpeza: new Date().toISOString(), observacao: " e2e " });
  const limpeza = (await api.listCleanings()).find((l) => l.placaId === placa.id);
  assert.equal(limpeza.placaModelo, "Placa E2E");
  assert.equal(limpeza.observacao, "e2e");
});

test("dashboard: resumo em Wh e métricas por hora", async () => {
  const resumo = await api.getDashboardSummary();
  assert.ok(resumo.placasAtivas >= 1);
  assert.ok(resumo.totalGeradoHoje >= 0);

  assert.ok(await api.getLastReadingDate());
  const pontos = await api.getDashboardMetrics({
    granularidade: "hora",
    dataInicio: new Date(Date.now() - 864e5).toISOString(),
    dataFim: new Date().toISOString()
  });
  assert.ok(pontos.length > 0 && "x" in pontos[0] && "y" in pontos[0]);
});

test("erros chegam traduzidos", async () => {
  const granularidade = await api.getDashboardMetrics({ granularidade: "ano" }).catch(api.extractErrorMessage);
  assert.match(granularidade, /Granularidade inválida/);
  const nomeEmBranco = await api.createGroup({ nome: "   ", status: "ATIVO" }).catch(api.extractErrorMessage);
  assert.equal(nomeEmBranco, "Dados inválidos.");
  const leitura = await supabase.from("leituras_energia").insert({ placa_id: placa.id, data_hora: new Date().toISOString(), wats_gerados: 1 });
  assert.ok(leitura.error, "usuário comum não deve inserir leituras");
});
