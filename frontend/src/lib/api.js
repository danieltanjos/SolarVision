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

export function createGroup({ nome, status, latitude, longitude }) {
  return unwrap(supabase.from("grupos_solares").insert({ nome: nome.trim(), status, latitude, longitude }));
}

// Com local (no grupo), potência, inclinação e azimute, o pg_cron carrega 5 anos de clima em ~1 min.
export function createPanel({ grupoId, modelo, status, potenciaWp, inclinacao, azimute }) {
  return unwrap(
    supabase.from("placas").insert({
      grupo_id: grupoId,
      modelo: modelo.trim(),
      status,
      potencia_wp: potenciaWp,
      inclinacao,
      azimute
    })
  );
}

export function createCleaning({ placaId, dataLimpeza, observacao }) {
  return unwrap(
    supabase.from("limpezas").insert({ placa_id: placaId, data_limpeza: dataLimpeza, observacao: observacao.trim() })
  );
}

// A RLS só devolve a linha do próprio usuário logado.
export function getCurrentUser() {
  return unwrap(supabase.from("usuarios").select("id, nome, email, role, criadoEm:criado_em").single());
}

export function getDashboardSummary() {
  return unwrap(supabase.rpc("dashboard_resumo"));
}

// medida = real (simulado: estimado menos a sujeira). grupoId/placaId opcionais: sem eles, soma todas as placas.
export function getDashboardMetrics({ granularidade, dataInicio, dataFim, grupoId = null, placaId = null }) {
  return unwrap(
    supabase.rpc("dashboard_metricas", {
      granularidade,
      data_inicio: dataInicio,
      data_fim: dataFim,
      grupo: grupoId,
      placa: placaId
    }).select("x, medida, estimada, medidaWh:medida_wh, estimadaWh:estimada_wh")
  );
}

const MENSAGENS = {
  "Invalid login credentials": "Credenciais inválidas.",
  "User already registered": "Já existe um usuário cadastrado com este email.",
  "Email not confirmed": "Confirme seu e-mail antes de entrar."
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
