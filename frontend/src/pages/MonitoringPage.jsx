import { startTransition, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Financeiro from "../components/Financeiro";
import MetricChart from "../components/MetricChart";
import { MotivoLimpeza } from "../components/RecomendacoesLimpeza";
import PrevisaoSemana from "../components/PrevisaoSemana";
import StatCard from "../components/StatCard";
import StatusBadge, { SujeiraBadge } from "../components/StatusBadge";
import { extractErrorMessage, getDashboardMetrics, listCleanings, listGroups, listPanels } from "../lib/api";
import { formatRangeLabel, rangeFor, shiftDate, toSaoPaulo } from "../lib/periodo";
import { LIMPAR_A_PARTIR, climaStatus, formatPerda, orientacao, perdaMedia, potenciaInstalada } from "../lib/placas";
import { formatEnergy, formatPower } from "../lib/power";

// Cada "view" é a janela mostrada; o "bucket" (date_trunc no Supabase) dá uma quantidade de pontos adequada.
const VIEWS = [
  { value: "dia", label: "Dia", bucket: "hora" },
  { value: "semana", label: "Semana", bucket: "dia" },
  { value: "mes", label: "Mês", bucket: "dia" },
  { value: "ano", label: "Ano", bucket: "mes" }
];

const ROTA = "/app/monitoramento";
const linkGrupo = (grupoId) => `${ROTA}?grupo=${grupoId}`;
const linkPlaca = (panel) => `${ROTA}?grupo=${panel.grupoId}&placa=${panel.id}`;
const soma = (points, key) => points.reduce((total, point) => total + (Number(point[key]) || 0), 0);
const plural = (n, singular, pluralForm) => `${n} ${n === 1 ? singular : pluralForm}`;

export default function MonitoringPage() {
  const [params] = useSearchParams();
  const grupoParam = Number(params.get("grupo")) || null;
  const placaId = Number(params.get("placa")) || null;

  const [groups, setGroups] = useState([]);
  const [panels, setPanels] = useState([]);
  const [cleanings, setCleanings] = useState([]);
  const [search, setSearch] = useState("");
  const [view, setView] = useState("dia");
  // Ancorado em "agora": o estimado inclui a previsão do tempo; o real vai até a última hora completa.
  const [referenceDate, setReferenceDate] = useState(() => toSaoPaulo(new Date()));
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const config = VIEWS.find((item) => item.value === view);

  useEffect(() => {
    Promise.all([listGroups(), listPanels(), listCleanings()]).then(
      ([groupsData, panelsData, cleaningsData]) => {
        setGroups(groupsData);
        setPanels(panelsData);
        setCleanings(cleaningsData);
      },
      (err) => setError(extractErrorMessage(err))
    );
  }, []);

  useEffect(() => {
    let ativo = true; // descarta a resposta se a seleção ou o período mudar antes dela chegar
    setLoading(true);
    setError("");
    getDashboardMetrics({
      granularidade: config.bucket,
      ...rangeFor(view, referenceDate),
      grupoId: placaId ? null : grupoParam,
      placaId
    })
      .then((data) => ativo && setPoints(data), (err) => ativo && setError(extractErrorMessage(err)))
      .finally(() => ativo && setLoading(false));
    return () => {
      ativo = false;
    };
  }, [config.bucket, view, referenceDate, grupoParam, placaId]);

  const panel = panels.find((item) => item.id === placaId);
  const grupoId = panel?.grupoId ?? grupoParam;
  const group = groups.find((item) => item.id === grupoId);
  const selecionadas = panel ? [panel] : panels.filter((item) => !grupoId || item.grupoId === grupoId);

  // Busca: grupo que bate mostra todas as placas; senão, só as placas que batem.
  const termo = search.trim().toLowerCase();
  const arvore = groups
    .map((item) => {
      const doGrupo = panels.filter((p) => p.grupoId === item.id);
      const bateGrupo = !termo || item.nome.toLowerCase().includes(termo);
      return { ...item, placas: bateGrupo ? doGrupo : doGrupo.filter((p) => p.modelo.toLowerCase().includes(termo)) };
    })
    .filter((item) => !termo || item.nome.toLowerCase().includes(termo) || item.placas.length > 0);

  const titulo = panel?.modelo ?? group?.nome ?? "Todas as usinas";
  const subtitulo = panel
    ? `${panel.grupoNome} · ${panel.potenciaWp ?? "?"} Wp · ${panel.inclinacao ?? "?"}° · ${orientacao(panel.azimute)}`
    : `${group ? "" : `${plural(groups.length, "grupo", "grupos")} · `}${plural(selecionadas.length, "placa", "placas")} · ${formatPower(potenciaInstalada(selecionadas))}p instalados`;

  const temReal = points.some((point) => point.medidaWh != null);
  const futuro = points.some((point) => new Date(point.x) > new Date());
  const ultimaLimpeza = panel ? cleanings.find((item) => item.placaId === panel.id) : null;
  const perda = perdaMedia(selecionadas);
  const sujas = selecionadas.filter((p) => p.perdaSujeira >= LIMPAR_A_PARTIR).length;
  const diasDesdeLimpeza = ultimaLimpeza ? Math.floor((Date.now() - new Date(ultimaLimpeza.dataLimpeza)) / 864e5) : null;

  const item = (ativo) => `sv-picker-item ${ativo ? "active" : ""}`;

  return (
    <div className="sv-page">
      <header className="sv-page-head">
        <div>
          <h1>Monitoramento</h1>
          <p>Escolha um grupo ou uma placa e compare a geração real com a estimada pela previsão do tempo.</p>
        </div>
      </header>

      {error ? <div className="alert alert-danger mb-0">{error}</div> : null}

      <div className="sv-monitor">
        <aside className="card sv-picker">
          <div className="sv-picker-search">
            <i className="bi bi-search" />
            <input
              type="search"
              className="form-control"
              placeholder="Buscar grupo ou placa"
              aria-label="Buscar grupo ou placa"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <nav className="sv-picker-list" aria-label="Grupos e placas">
            <Link to={ROTA} className={item(!grupoId && !placaId)}>
              <i className="bi bi-grid-3x3-gap" />
              <span className="sv-picker-name">Todas as usinas</span>
              <span className="sv-picker-count">{panels.length}</span>
            </Link>

            {arvore.map((grupo) => (
              <div key={grupo.id} className="sv-picker-group">
                <Link to={linkGrupo(grupo.id)} className={item(grupoId === grupo.id && !placaId)}>
                  <i className="bi bi-collection" />
                  <span className="sv-picker-name" title={grupo.nome}>{grupo.nome}</span>
                  <span className="sv-picker-count">{grupo.totalPlacas}</span>
                </Link>
                {grupo.placas.map((p) => (
                  <Link key={p.id} to={linkPlaca(p)} className={`${item(placaId === p.id)} sv-picker-sub`}>
                    <i className="bi bi-grid-3x2" />
                    <span className="sv-picker-name" title={p.modelo}>{p.modelo}</span>
                  </Link>
                ))}
              </div>
            ))}

            {arvore.length === 0 ? (
              <p className="sv-picker-empty">
                {groups.length === 0 ? <>Nenhum grupo ainda. <Link to="/app/cadastro">Cadastrar</Link></> : "Nada encontrado."}
              </p>
            ) : null}
          </nav>
        </aside>

        <div className="sv-monitor-main">
          <section className="card">
            <div className="sv-monitor-head">
              <div className="min-w-0">
                <nav className="sv-crumbs" aria-label="Seleção">
                  <Link to={ROTA}>Todas</Link>
                  {group ? (
                    <>
                      <i className="bi bi-chevron-right" />
                      <Link to={linkGrupo(group.id)}>{group.nome}</Link>
                    </>
                  ) : null}
                  {panel ? (
                    <>
                      <i className="bi bi-chevron-right" />
                      <span>{panel.modelo}</span>
                    </>
                  ) : null}
                </nav>
                <h2 className="sv-monitor-title">{titulo}</h2>
                <p className="sv-muted mb-0">{subtitulo}</p>
              </div>

              <div className="sv-chart-controls">
                <div className="sv-segmented" role="group" aria-label="Período">
                  {VIEWS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={view === option.value ? "active" : ""}
                      onClick={() => startTransition(() => setView(option.value))}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className="sv-period">
                  <button type="button" aria-label="Período anterior" onClick={() => setReferenceDate((d) => shiftDate(d, view, -1))}>
                    <i className="bi bi-chevron-left" />
                  </button>
                  <span>{formatRangeLabel(view, referenceDate)}</span>
                  <button type="button" aria-label="Próximo período" onClick={() => setReferenceDate((d) => shiftDate(d, view, 1))}>
                    <i className="bi bi-chevron-right" />
                  </button>
                  <button type="button" className="sv-period-today" onClick={() => setReferenceDate(toSaoPaulo(new Date()))}>
                    Hoje
                  </button>
                </div>
              </div>
            </div>

            <div className="sv-stats sv-stats-compact">
              <StatCard
                title="Energia real"
                value={loading ? "…" : temReal ? formatEnergy(soma(points, "medidaWh")) : "—"}
                subtitle={temReal ? "Simulada, até a última hora completa" : "Período ainda não começou"}
                icon="bi-lightning"
                tone="primary"
              />
              <StatCard
                title="Energia estimada"
                value={loading ? "…" : formatEnergy(soma(points, "estimadaWh"))}
                subtitle={futuro ? "Inclui a previsão do tempo" : "Pelo clima do período"}
                icon="bi-sun"
                tone="accent"
              />
              <StatCard
                title="Perda por sujeira"
                value={formatPerda(perda)}
                subtitle={
                  panel
                    ? diasDesdeLimpeza != null ? `Limpa há ${plural(diasDesdeLimpeza, "dia", "dias")}` : "Nenhuma limpeza registrada"
                    : sujas ? `${plural(sujas, "placa precisa", "placas precisam")} de limpeza` : "Nenhuma placa precisa de limpeza"
                }
                icon="bi-droplet-half"
                tone={perda >= LIMPAR_A_PARTIR ? "accent" : "success"}
              />
              <StatCard
                title="Capacidade"
                value={`${formatPower(potenciaInstalada(selecionadas))}p`}
                subtitle={plural(selecionadas.length, "placa", "placas")}
                icon="bi-grid-3x2"
                tone="muted"
              />
            </div>

            <div className="sv-chart">
              {loading ? (
                <div className="sv-empty" style={{ minHeight: 340 }}>
                  <div className="spinner-border text-primary" role="status" />
                </div>
              ) : (
                <MetricChart points={points} view={view} height={340} />
              )}
            </div>
          </section>

          <Financeiro
            {...rangeFor(view, referenceDate)}
            grupoId={placaId ? null : grupoParam}
            placaId={placaId}
            totalPlacas={selecionadas.length}
          />

          <PrevisaoSemana grupoId={placaId ? null : grupoParam} placaId={placaId} />

          {panel ? (
            <section className="card">
              <div className="sv-card-head">
                <h2>Detalhes da placa</h2>
                <Link to={`/app/limpeza?placa=${panel.id}`} className="btn btn-sm btn-outline-primary">
                  <i className="bi bi-droplet me-1" /> Registrar limpeza
                </Link>
              </div>
              <dl className="sv-details">
                <div><dt>Grupo</dt><dd><Link to={linkGrupo(panel.grupoId)}>{panel.grupoNome}</Link></dd></div>
                <div><dt>Status</dt><dd><StatusBadge status={panel.status} /></dd></div>
                <div><dt>Potência</dt><dd>{panel.potenciaWp != null ? `${panel.potenciaWp} Wp` : "—"}</dd></div>
                <div><dt>Inclinação</dt><dd>{panel.inclinacao != null ? `${panel.inclinacao}°` : "—"}</dd></div>
                <div><dt>Orientação</dt><dd>{panel.azimute != null ? `${orientacao(panel.azimute)} (${panel.azimute}°)` : "—"}</dd></div>
                <div>
                  <dt>Local</dt>
                  <dd>
                    {panel.latitude != null ? (
                      <a href={`https://www.google.com/maps?q=${panel.latitude},${panel.longitude}`} target="_blank" rel="noreferrer">
                        {panel.latitude}, {panel.longitude} <i className="bi bi-box-arrow-up-right small" />
                      </a>
                    ) : "—"}
                  </dd>
                </div>
                <div><dt>Clima</dt><dd>{climaStatus(panel).texto}</dd></div>
                <div><dt>Perda por sujeira</dt><dd><SujeiraBadge perda={panel.perdaSujeira} /></dd></div>
                <div><dt>Recomendação</dt><dd><MotivoLimpeza placaId={panel.id} /></dd></div>
                <div>
                  <dt>Última limpeza</dt>
                  <dd>{ultimaLimpeza ? new Date(ultimaLimpeza.dataLimpeza).toLocaleDateString("pt-BR") : "Nenhuma"}</dd>
                </div>
              </dl>
            </section>
          ) : (
            <section className="card">
              <div className="sv-card-head">
                <h2>{group ? "Placas do grupo" : "Placas"}</h2>
                <span className="sv-muted small">Clique em uma placa para ver só ela</span>
              </div>
              <div className="table-responsive">
                <table className="table sv-table align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Placa</th>
                      {group ? null : <th>Grupo</th>}
                      <th>Potência</th>
                      <th>Inclinação</th>
                      <th>Orientação</th>
                      <th>Clima</th>
                      <th>Sujeira</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selecionadas.map((p) => (
                      <tr key={p.id}>
                        <td><Link to={linkPlaca(p)} className="fw-semibold">{p.modelo}</Link></td>
                        {group ? null : <td>{p.grupoNome}</td>}
                        <td className="text-nowrap">{p.potenciaWp != null ? `${p.potenciaWp} Wp` : "—"}</td>
                        <td className="text-nowrap">{p.inclinacao != null ? `${p.inclinacao}°` : "—"}</td>
                        <td>{p.azimute != null ? orientacao(p.azimute) : "—"}</td>
                        <td className="sv-muted">{climaStatus(p).texto}</td>
                        <td><SujeiraBadge perda={p.perdaSujeira} /></td>
                        <td><StatusBadge status={p.status} /></td>
                      </tr>
                    ))}
                    {selecionadas.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="sv-muted">Nenhuma placa por aqui.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
