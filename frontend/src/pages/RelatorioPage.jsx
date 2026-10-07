import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Financeiro from "../components/Financeiro";
import MetricChart from "../components/MetricChart";
import RecomendacoesLimpeza from "../components/RecomendacoesLimpeza";
import StatCard from "../components/StatCard";
import { SujeiraBadge } from "../components/StatusBadge";
import {
  extractErrorMessage,
  getDashboardHistorico,
  getDashboardMetrics,
  getRankingPlacas,
  listCleanings,
  listGroups,
  listPanels
} from "../lib/api";
import { comparacaoClima } from "../lib/historico";
import { TIME_ZONE, formatRangeLabel, mesRelatorio, rangeFor } from "../lib/periodo";
import { potenciaInstalada } from "../lib/placas";
import { formatEnergy, formatPower } from "../lib/power";
import logo from "../../img/logo.png";

const soma = (linhas, key) => linhas.reduce((total, linha) => total + (Number(linha[key]) || 0), 0);
const plural = (n, singular, pluralForm) => `${n} ${n === 1 ? singular : pluralForm}`;
const pct = (fracao) => `${Math.round(fracao * 100)}%`;
const dataHora = (valor) => new Date(valor).toLocaleString("pt-BR", { timeZone: TIME_ZONE, dateStyle: "short", timeStyle: "short" });

// Resumo de um mês da seleção para imprimir ou salvar em PDF pelo navegador (estilos de impressão no app.css).
// Filtros na URL: ?mes=AAAA-MM&grupo=G&placa=P.
export default function RelatorioPage() {
  const [params, setParams] = useSearchParams();
  const mes = mesRelatorio(params.get("mes"));
  const grupoParam = Number(params.get("grupo")) || null;
  const placaId = Number(params.get("placa")) || null;
  // Relógio de SP guardado como UTC, como em lib/periodo.js.
  const referencia = new Date(`${mes}-01T00:00:00Z`);
  const periodo = rangeFor("mes", referencia);

  const [listas, setListas] = useState(null);
  const [dados, setDados] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([listGroups(), listPanels(), listCleanings()]).then(
      ([groups, panels, cleanings]) => setListas({ groups, panels, cleanings }),
      (err) => setError(extractErrorMessage(err))
    );
  }, []);

  useEffect(() => {
    let ativo = true; // descarta a resposta se o mês ou a seleção mudar antes dela chegar
    setDados(null);
    setError("");
    const filtro = { granularidade: "dia", ...periodo, grupoId: placaId ? null : grupoParam, placaId };
    Promise.all([
      getDashboardMetrics(filtro),
      getDashboardHistorico(filtro).catch(() => []), // a média de 5 anos é extra: sem ela, o relatório sai mesmo assim
      getRankingPlacas({ ...periodo, grupoId: grupoParam })
    ]).then(
      ([points, historico, ranking]) => ativo && setDados({ points, historico, ranking }),
      (err) => ativo && setError(extractErrorMessage(err))
    );
    return () => {
      ativo = false;
    };
  }, [mes, grupoParam, placaId]); // periodo vem do mes

  const { groups = [], panels = [], cleanings = [] } = listas ?? {};
  const { points = [], historico = [], ranking = [] } = dados ?? {};
  const panel = panels.find((item) => item.id === placaId);
  const grupoId = panel?.grupoId ?? grupoParam;
  const group = groups.find((item) => item.id === grupoId);
  const selecionadas = panel ? [panel] : panels.filter((item) => !grupoId || item.grupoId === grupoId);
  const titulo = panel ? `${panel.modelo} · ${panel.grupoNome}` : group?.nome ?? "Todas as usinas";
  const mesLabel = formatRangeLabel("mes", referencia);

  // O título da aba vira o nome sugerido do PDF.
  useEffect(() => {
    const anterior = document.title;
    document.title = `Relatório ${mes} - ${titulo} - SolarVision`;
    return () => {
      document.title = anterior;
    };
  }, [mes, titulo]);

  const selecao = panel ? `grupo=${panel.grupoId}&placa=${panel.id}` : grupoId ? `grupo=${grupoId}` : "";
  const ir = (novoMes, novaSelecao) => setParams(`mes=${novoMes}${novaSelecao && `&${novaSelecao}`}`);

  const ids = new Set(selecionadas.map((item) => item.id));
  const doRanking = (id) => ranking.find((linha) => linha.placaId === id);
  const linhas = selecionadas.map((item) => doRanking(item.id)).filter(Boolean);
  // ranking_placas: estimadaWh é só o das horas com real, então a razão é justa também no mês corrente.
  const desempenho = soma(linhas, "estimadaWh") ? soma(linhas, "realWh") / soma(linhas, "estimadaWh") : null;
  const realWh = soma(points, "medidaWh");
  // Parte do real que veio de leituras importadas (o resto é simulado).
  const fracaoSensor = soma(points, "medidaSensorWh") / (realWh || 1);
  const origemReal = fracaoSensor >= 0.99
    ? "Energia real medida: leituras importadas do sensor/inversor."
    : `Energia real ${fracaoSensor > 0 ? `${pct(fracaoSensor)} medida (leituras importadas do sensor/inversor), o resto ` : ""}simulada: o estimado menos a perda por sujeira desde a última limpeza ou chuva forte.`;
  const futuro = points.some((point) => new Date(point.x) > new Date());
  const clima = comparacaoClima(points, historico);
  const [inicio, fim] = [Date.parse(periodo.dataInicio), Date.parse(periodo.dataFim)];
  const limpezas = cleanings
    .filter((item) => ids.has(item.placaId) && Date.parse(item.dataLimpeza) >= inicio && Date.parse(item.dataLimpeza) <= fim)
    .reverse(); // listCleanings vem da mais recente para a mais antiga

  return (
    <div className="sv-page sv-relatorio">
      <header className="sv-page-head d-print-none">
        <div>
          <h1>Relatório mensal</h1>
          <p>Resumo do mês para imprimir ou salvar em PDF.</p>
        </div>
        <div className="sv-relatorio-filtros">
          <input
            type="month"
            className="form-control"
            aria-label="Mês"
            value={mes}
            onChange={(event) => event.target.value && ir(event.target.value, selecao)}
          />
          <select className="form-select" aria-label="Seleção" value={selecao} onChange={(event) => ir(mes, event.target.value)}>
            <option value="">Todas as usinas</option>
            {groups.map((item) => (
              <optgroup key={item.id} label={item.nome}>
                <option value={`grupo=${item.id}`}>{item.nome} (todas as placas)</option>
                {panels.filter((p) => p.grupoId === item.id).map((p) => (
                  <option key={p.id} value={`grupo=${item.id}&placa=${p.id}`}>{p.modelo}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <button type="button" className="btn btn-primary text-nowrap" onClick={() => window.print()} disabled={!listas || !dados}>
            <i className="bi bi-printer me-2" />
            Imprimir / PDF
          </button>
        </div>
      </header>

      {error ? <div className="alert alert-danger mb-0">{error}</div> : null}

      {!listas || !dados ? (
        <section className="card sv-empty">
          {error ? null : <div className="spinner-border text-primary" role="status" />}
        </section>
      ) : selecionadas.length === 0 ? (
        <section className="card sv-empty">
          <i className="bi bi-grid-3x2" />
          <p>Nenhuma placa nesta seleção.</p>
          <Link to="/app/cadastro">Cadastrar placas</Link>
        </section>
      ) : (
        <>
          <section className="card sv-relatorio-capa">
            <span className="sv-relatorio-marca">
              <img src={logo} alt="" />
              SolarVision
            </span>
            <h2>Relatório de geração · {mesLabel}</h2>
            <p className="mb-0">
              {titulo} · {plural(selecionadas.length, "placa", "placas")} · {formatPower(potenciaInstalada(selecionadas))}p instalados
            </p>
            <p className="sv-muted small mb-0">Emitido em {dataHora(new Date())}</p>
          </section>

          {points.length === 0 ? (
            <section className="card sv-empty">
              <i className="bi bi-calendar-x" />
              <p>Sem dados em {mesLabel}.</p>
              <span>A geração é estimada pelo clima dos últimos 5 anos e pela previsão dos próximos 7 dias.</span>
            </section>
          ) : (
            <>
              <section className="card">
                <div className="sv-card-head">
                  <div>
                    <h2>Resumo do mês</h2>
                    <p>Geração real comparada à estimada pelo clima.</p>
                  </div>
                </div>
                <div className="sv-stats sv-stats-compact">
                  <StatCard
                    title="Energia real"
                    value={formatEnergy(realWh)}
                    subtitle={fracaoSensor >= 0.99 ? "Medida (sensor)" : fracaoSensor > 0 ? `${pct(fracaoSensor)} medida (sensor)` : "Simulada"}
                    icon="bi-lightning"
                    tone="primary"
                  />
                  <StatCard
                    title="Energia estimada"
                    value={formatEnergy(soma(points, "estimadaWh"))}
                    subtitle={clima ?? (futuro ? "Inclui a previsão do tempo" : "Pelo clima do mês")}
                    icon="bi-sun"
                    tone="accent"
                  />
                  <StatCard
                    title="Desempenho"
                    value={desempenho != null ? pct(desempenho) : "—"}
                    subtitle="Real ÷ estimado"
                    icon="bi-speedometer2"
                    tone="success"
                  />
                </div>
              </section>

              <Financeiro {...periodo} grupoId={placaId ? null : grupoParam} placaId={placaId} totalPlacas={selecionadas.length} />

              <section className="card">
                <div className="sv-card-head">
                  <div>
                    <h2>Geração por dia</h2>
                    <p>Potência média de cada dia, com a média dos anos anteriores.</p>
                  </div>
                </div>
                <MetricChart points={points} historico={historico} view="mes" height={280} />
              </section>

              <section className="card">
                <div className="sv-card-head">
                  <div>
                    <h2>Placas</h2>
                    <p>
                      Desempenho = real ÷ estimado; "abaixo do grupo" = mais de 10 p.p. abaixo da mediana do grupo
                      (sombra, defeito ou sujeira). Sujeira: a de hoje.
                    </p>
                  </div>
                </div>
                <div className="table-responsive">
                  <table className="table sv-table align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Placa</th>
                        {group ? null : <th>Grupo</th>}
                        <th>Potência</th>
                        <th>Energia real</th>
                        <th>kWh/kWp</th>
                        <th>Desempenho</th>
                        <th>Sujeira</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selecionadas.map((p) => {
                        const linha = doRanking(p.id);
                        return (
                          <tr key={p.id}>
                            <td className="fw-semibold">{p.modelo}</td>
                            {group ? null : <td>{p.grupoNome}</td>}
                            <td className="text-nowrap">{p.potenciaWp != null ? `${p.potenciaWp} Wp` : "—"}</td>
                            <td className="text-nowrap">{linha?.realWh != null ? formatEnergy(linha.realWh) : "—"}</td>
                            <td>{linha?.kwhKwp != null ? Number(linha.kwhKwp).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "—"}</td>
                            <td className="text-nowrap">
                              {linha?.desempenho != null ? pct(linha.desempenho) : "—"}
                              {linha?.anomalia ? <span className="sv-badge sv-badge-warning ms-1">abaixo do grupo</span> : null}
                            </td>
                            <td><SujeiraBadge perda={p.perdaSujeira} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="card">
                <div className="sv-card-head">
                  <div>
                    <h2>Limpezas no mês</h2>
                    <p>{plural(limpezas.length, "registrada", "registradas")}</p>
                  </div>
                </div>
                {limpezas.length ? (
                  <ul className="sv-list">
                    {limpezas.map((item) => (
                      <li key={item.id}>
                        <span className="sv-list-icon"><i className="bi bi-droplet" /></span>
                        <div className="min-w-0">
                          <strong>{item.placaModelo}</strong>
                          <span>{item.observacao || "Sem observação"}</span>
                        </div>
                        <time>{dataHora(item.dataLimpeza)}</time>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="sv-muted mb-0">Nenhuma limpeza registrada no mês.</p>
                )}
              </section>

              <RecomendacoesLimpeza panels={selecionadas} />

              <p className="sv-relatorio-nota">
                {origemReal} Energia estimada pelo clima horário do local de cada placa (potência, inclinação e
                orientação). Sujeira e recomendações de limpeza são as do dia da emissão.
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}
