import { createClient } from "@supabase/supabase-js";

// No navegador o Vite injeta import.meta.env; no Node (teste e2e) as variáveis vêm de process.env.
const env = import.meta.env ?? process.env;

export const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);

// Devolve os dados da consulta ou lança o erro do Supabase.
async function unwrap(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// Os aliases (campo:coluna) mantêm o mesmo formato JSON que a API Spring Boot devolvia.
export async function listGroups() {
  const groups = await unwrap(
    supabase
      .from("grupos_solares")
      .select(
        "id, nome, status, latitude, longitude, criadoEm:criado_em, tarifaKwh:tarifa_kwh, custoLimpeza:custo_limpeza, placas(count)"
      )
      .order("id")
  );
  return groups.map(({ placas, ...group }) => ({ ...group, totalPlacas: placas[0]?.count ?? 0 }));
}

export function listPanels() {
  return unwrap(
    supabase
      .from("placas")
      .select(
        "id, modelo, status, grupoId:grupo_id, criadoEm:criado_em, potenciaWp:potencia_wp, inclinacao, azimute, " +
          "instaladaEm:instalada_em, climaHistoricoEm:clima_historico_em, perdaSujeira:perda_sujeira, " +
          "...grupos_solares(grupoNome:nome, latitude, longitude, tarifaKwh:tarifa_kwh, custoLimpeza:custo_limpeza)"
      )
      .order("id")
  );
}

export function listCleanings() {
  return unwrap(
    supabase
      .from("limpezas")
      .select("id, placaId:placa_id, dataLimpeza:data_limpeza, observacao, criadoEm:criado_em, ...placas(placaModelo:modelo)")
      .order("data_limpeza", { ascending: false })
      .order("id", { ascending: false })
  );
}

// Campos da tela -> colunas. Campo undefined some do JSON, então o update altera só o que foi informado.
const colunasGrupo = ({ nome, status, latitude, longitude, tarifaKwh, custoLimpeza }) => ({
  nome: nome?.trim(),
  status,
  latitude,
  longitude,
  tarifa_kwh: tarifaKwh,
  custo_limpeza: custoLimpeza
});

const colunasPlaca = ({ grupoId, modelo, status, potenciaWp, inclinacao, azimute, instaladaEm }) => ({
  grupo_id: grupoId,
  modelo: modelo?.trim(),
  status,
  potencia_wp: potenciaWp,
  inclinacao,
  azimute,
  instalada_em: instaladaEm
});

const colunasLimpeza = ({ placaId, dataLimpeza, observacao }) => ({
  placa_id: placaId,
  data_limpeza: dataLimpeza,
  observacao: observacao?.trim()
});

// Devolve { id } do grupo criado.
export function createGroup(grupo) {
  return unwrap(supabase.from("grupos_solares").insert(colunasGrupo(grupo)).select("id").single());
}

// Mudar latitude/longitude faz o pg_cron recarregar o clima das placas do grupo (trigger no banco).
export function updateGroup(id, grupo) {
  return unwrap(supabase.from("grupos_solares").update(colunasGrupo(grupo)).eq("id", id));
}

// Cascata: placas, limpezas e clima do grupo.
export function deleteGroup(id) {
  return unwrap(supabase.from("grupos_solares").delete().eq("id", id));
}

// Com local (no grupo), potência, inclinação e azimute, o pg_cron carrega 5 anos de clima em ~1 min.
export function createPanel(placa) {
  return unwrap(supabase.from("placas").insert(colunasPlaca(placa)));
}

// Mudar inclinação, azimute ou grupo faz o pg_cron recarregar o clima da placa (trigger no banco).
export function updatePanel(id, placa) {
  return unwrap(supabase.from("placas").update(colunasPlaca(placa)).eq("id", id));
}

export function deletePanel(id) {
  return unwrap(supabase.from("placas").delete().eq("id", id));
}

export function createCleaning(limpeza) {
  return unwrap(supabase.from("limpezas").insert(colunasLimpeza(limpeza)));
}

export function updateCleaning(id, limpeza) {
  return unwrap(supabase.from("limpezas").update(colunasLimpeza(limpeza)).eq("id", id));
}

export function deleteCleaning(id) {
  return unwrap(supabase.from("limpezas").delete().eq("id", id));
}

// A RLS só devolve a linha do próprio usuário logado. Limiares em fração (0,10 = 10 %).
export function getCurrentUser() {
  return unwrap(
    supabase
      .from("usuarios")
      .select(
        "id, nome, email, role, criadoEm:criado_em, alertaLimpeza:alerta_limpeza, alertaPrevisao:alerta_previsao, " +
          "alertaDesempenho:alerta_desempenho, limiarLimpeza:limiar_limpeza, limiarPrevisao:limiar_previsao, " +
          "tarifaPadrao:tarifa_padrao, custoLimpezaPadrao:custo_limpeza_padrao"
      )
      .single()
  );
}

// Nome e preferências do usuário logado; só os campos informados mudam. O banco recusa role e email (grant por coluna).
export function salvarPerfil(id, perfil) {
  const colunas = {
    nome: perfil.nome?.trim(),
    alerta_limpeza: perfil.alertaLimpeza,
    alerta_previsao: perfil.alertaPrevisao,
    alerta_desempenho: perfil.alertaDesempenho,
    limiar_limpeza: perfil.limiarLimpeza,
    limiar_previsao: perfil.limiarPrevisao,
    tarifa_padrao: perfil.tarifaPadrao,
    custo_limpeza_padrao: perfil.custoLimpezaPadrao
  };
  return unwrap(supabase.from("usuarios").update(colunas).eq("id", id));
}

export function getDashboardSummary() {
  return unwrap(supabase.rpc("dashboard_resumo"));
}

// medida = real: leituras importadas nas horas que as têm (medidaSensorWh), senão simulado (estimado menos a sujeira).
// grupoId/placaId opcionais: sem eles, soma todas as placas.
export function getDashboardMetrics({ granularidade, dataInicio, dataFim, grupoId = null, placaId = null }) {
  return unwrap(
    supabase.rpc("dashboard_metricas", {
      granularidade,
      data_inicio: dataInicio,
      data_fim: dataFim,
      grupo: grupoId,
      placa: placaId
    }).select("x, medida, estimada, medidaWh:medida_wh, estimadaWh:estimada_wh, medidaSensorWh:medida_sensor_wh")
  );
}

// Grava um lote de leituras { dataHora, watts } de uma placa; reimportar o mesmo instante atualiza em vez de duplicar.
export function salvarLeituras(placaId, leituras) {
  return unwrap(
    supabase.from("leituras_energia").upsert(
      leituras.map(({ dataHora, watts }) => ({ placa_id: placaId, data_hora: dataHora, wats_gerados: watts })),
      { onConflict: "placa_id,data_hora" }
    )
  );
}

// kWh/kWp e desempenho (real ÷ estimado) de cada placa no período; anomalia = mais de 10 p.p. abaixo da mediana do grupo.
export function getRankingPlacas({ dataInicio, dataFim, grupoId = null }) {
  return unwrap(
    supabase.rpc("ranking_placas", { data_inicio: dataInicio, data_fim: dataFim, grupo: grupoId }).select(
      "placaId:placa_id, realWh:real_wh, estimadaWh:estimada_wh, kwhKwp:kwh_kwp, desempenho, desempenhoGrupo:desempenho_grupo, anomalia"
    )
  );
}

// Valores do período: realWh, economia (R$), perdaSujeiraWh, perdaSujeira (R$), co2EvitadoKg e placasSemTarifa.
export function getFinanceiro({ dataInicio, dataFim, grupoId = null, placaId = null }) {
  return unwrap(
    supabase.rpc("dashboard_financeiro", { data_inicio: dataInicio, data_fim: dataFim, grupo: grupoId, placa: placaId })
  );
}

// Por placa visível: perda, quanto se perde na semana sem limpar, chuva prevista e se vale limpar agora (motivo).
export function getRecomendacoesLimpeza() {
  return unwrap(
    supabase
      .rpc("recomendacoes_limpeza")
      .select(
        "placaId:placa_id, perda, perdaKwhSemana:perda_kwh_semana, perdaRsSemana:perda_rs_semana, custoLimpeza:custo_limpeza, " +
          "chuvaPrevistaEm:chuva_prevista_em, diasParaCompensar:dias_para_compensar, limpar, motivo"
      )
  );
}

// Estimado (só o clima) da mesma janela nos 5 anos anteriores, com os mesmos x de getDashboardMetrics.
export function getDashboardHistorico({ granularidade, dataInicio, dataFim, grupoId = null, placaId = null }) {
  return unwrap(
    supabase.rpc("dashboard_historico", {
      granularidade,
      data_inicio: dataInicio,
      data_fim: dataFim,
      grupo: grupoId,
      placa: placaId
    }).select("x, mediaW:media_w, mediaWh:media_wh, minWh:min_wh, maxWh:max_wh, anos")
  );
}

// Por dia encerrado: a previsão guardada na véspera (21:00) x o estimado com o clima que aconteceu.
export function getAcertoPrevisao({ dias = 7, grupoId = null, placaId = null } = {}) {
  return unwrap(
    supabase.rpc("acerto_previsao", { dias, grupo: grupoId, placa: placaId })
      .select("dia, previstoWh:previsto_wh, ocorridoWh:ocorrido_wh")
  );
}

// Alertas dos grupos visíveis (gerados pelo pg_cron às 07:00), mais recentes primeiro; placaModelo null = alerta do grupo.
export function listAlertas() {
  return unwrap(
    supabase
      .from("alertas")
      .select(
        "id, tipo, mensagem, grupoId:grupo_id, placaId:placa_id, criadoEm:criado_em, lidoEm:lido_em, " +
          "...grupos_solares(grupoNome:nome), ...placas(placaModelo:modelo)"
      )
      .order("criado_em", { ascending: false })
      .order("id", { ascending: false })
      .limit(20)
  );
}

// Marca um alerta (id) ou todos os não lidos; o banco só deixa o dono alterar lido_em.
export function marcarAlertasLidos(id = null) {
  const query = supabase.from("alertas").update({ lido_em: new Date().toISOString() }).is("lido_em", null);
  return unwrap(id ? query.eq("id", id) : query);
}

const MENSAGENS = {
  "Invalid login credentials": "Credenciais inválidas.",
  "User already registered": "Já existe um usuário cadastrado com este email.",
  "Email not confirmed": "Confirme seu e-mail antes de entrar.",
  "New password should be different from the old password.": "A nova senha deve ser diferente da atual."
};

export function extractErrorMessage(error) {
  const message = error?.message ?? "";

  // Sem resposta do servidor (rede fora do ar / Supabase indisponível)
  if (error?.name === "AuthRetryableFetchError" || /failed to fetch|network/i.test(message)) {
    return "Não foi possível conectar ao servidor. Tente novamente em instantes.";
  }

  // Violação de CHECK no banco (ex.: nome só com espaços)
  if (error?.code === "23514") {
    return "Dados inválidos.";
  }

  return MENSAGENS[message] || message || "Não foi possível concluir a operação.";
}
