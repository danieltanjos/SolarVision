import { Suspense, lazy, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import StatCard from "../components/StatCard";
import PrevisaoSemana from "../components/PrevisaoSemana";
import RecomendacoesLimpeza from "../components/RecomendacoesLimpeza";
import StatusBadge from "../components/StatusBadge";
import { useAuth, useLimiarLimpeza } from "../context/AuthContext";
import {
  extractErrorMessage,
  getDashboardMetrics,
  getDashboardSummary,
  listCleanings,
  listGroups,
  listPanels
} from "../lib/api";
import { TIME_ZONE, rangeFor, toSaoPaulo } from "../lib/periodo";
import { formatPerda, perdaMedia, potenciaInstalada } from "../lib/placas";
import { formatEnergy, formatPower } from "../lib/power";
import { titleCase } from "../lib/text";

// ApexCharts (~580 kB) carrega depois do resto da Home.
const MetricChart = lazy(() => import("../components/MetricChart"));

const hoje = () => new Date().toLocaleDateString("pt-BR", { timeZone: TIME_ZONE, weekday: "long", day: "numeric", month: "long" });

export default function HomePage() {
  const { user } = useAuth();
  const limiar = useLimiarLimpeza();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      getDashboardSummary(),
      listGroups(),
      listPanels(),
      listCleanings(),
      getDashboardMetrics({ granularidade: "hora", ...rangeFor("dia", toSaoPaulo(new Date())) })
    ]).then(
      ([summary, groups, panels, cleanings, today]) => setData({ summary, groups, panels, cleanings, today }),
      (err) => setError(extractErrorMessage(err))
    );
  }, []);

  const { summary, groups = [], panels = [], cleanings = [], today = [] } = data ?? {};
  const ativas = panels.filter((panel) => panel.status === "ATIVA").length;
  const perda = perdaMedia(panels);
  const sujas = panels.filter((panel) => panel.perdaSujeira >= limiar).length;
  // Real x estimado nas mesmas horas (o real só existe até a última hora completa).
  const desempenho = summary?.estimadoAteAgora > 0 ? Math.round((summary.totalGeradoHoje / summary.estimadoAteAgora) * 100) : null;

  return (
    <div className="sv-page">
      <header className="sv-page-head">
        <div>
          <h1>Olá, {user?.nome ? titleCase(user.nome).split(" ")[0] : "Usuário"}!</h1>
          <p>Resumo de {hoje()}.</p>
        </div>
        <Link to="/app/monitoramento" className="btn btn-primary">
          <i className="bi bi-graph-up me-2" />
          Monitorar
        </Link>
      </header>

      {error ? <div className="alert alert-danger mb-0">{error}</div> : null}

      <section className="sv-stats">
        <StatCard
          title="Real hoje"
          value={summary ? formatEnergy(summary.totalGeradoHoje) : "—"}
          subtitle={desempenho != null ? `${desempenho}% do estimado até agora` : "Até a última hora completa"}
          icon="bi-lightning"
          tone="primary"
        />
        <StatCard
          title="Estimado hoje"
          value={summary ? formatEnergy(summary.estimadoHoje) : "—"}
          subtitle={summary ? `Agora: ${formatPower(summary.potenciaAgora)}` : null}
          icon="bi-sun"
          tone="accent"
        />
        <StatCard
          title="Perda por sujeira"
          value={data ? formatPerda(perda) : "—"}
          subtitle={data ? (sujas ? `${sujas} ${sujas === 1 ? "placa precisa" : "placas precisam"} de limpeza` : "Nenhuma placa precisa de limpeza") : null}
          icon="bi-droplet-half"
          tone={perda >= limiar ? "accent" : "success"}
        />
        <StatCard
          title="Placas ativas"
          value={data ? `${ativas}/${panels.length}` : "—"}
          subtitle={data ? `${formatPower(potenciaInstalada(panels))}p instalados` : null}
          icon="bi-grid-3x2"
          tone="muted"
        />
      </section>

      <div className="sv-home-grid">
        <section className="card">
          <div className="sv-card-head">
            <div>
              <h2>Geração de hoje</h2>
              <p>Todas as placas: real até agora e estimado pela previsão do tempo.</p>
            </div>
            <Link to="/app/monitoramento" className="sv-link-arrow">
              Ver detalhes <i className="bi bi-arrow-right" />
            </Link>
          </div>
          {data ? (
            <Suspense fallback={<div className="sv-empty" style={{ minHeight: 260 }} />}>
              <MetricChart points={today} view="dia" height={260} />
            </Suspense>
          ) : (
            <div className="sv-empty" style={{ minHeight: 260 }}>
              {error ? null : <div className="spinner-border text-primary" role="status" />}
            </div>
          )}
        </section>

        <section className="card">
          <div className="sv-card-head">
            <div>
              <h2>Limpezas recentes</h2>
              <p>{cleanings.length} no total</p>
            </div>
            <Link to="/app/limpeza" className="sv-link-arrow">
              Registrar <i className="bi bi-arrow-right" />
            </Link>
          </div>
          <ul className="sv-list">
            {cleanings.slice(0, 5).map((cleaning) => (
              <li key={cleaning.id}>
                <span className="sv-list-icon"><i className="bi bi-droplet" /></span>
                <div className="min-w-0">
                  <strong>{cleaning.placaModelo}</strong>
                  <span>{cleaning.observacao || "Sem observação"}</span>
                </div>
                <time>{new Date(cleaning.dataLimpeza).toLocaleDateString("pt-BR")}</time>
              </li>
            ))}
          </ul>
          {data && cleanings.length === 0 ? (
            <div className="sv-empty sv-empty-sm">
              <i className="bi bi-droplet-half" />
              <p>Nenhuma limpeza registrada.</p>
            </div>
          ) : null}
        </section>
      </div>

      <RecomendacoesLimpeza panels={panels} />

      <PrevisaoSemana />

      <section>
        <div className="sv-section-head">
          <h2>Grupos solares</h2>
          <Link to="/app/cadastro" className="sv-link-arrow">
            Gerenciar <i className="bi bi-arrow-right" />
          </Link>
        </div>
        <div className="sv-group-grid">
          {groups.map((group) => {
            const doGrupo = panels.filter((panel) => panel.grupoId === group.id);
            return (
              <Link key={group.id} to={`/app/monitoramento?grupo=${group.id}`} className="card sv-group-card">
                <div className="sv-group-card-head">
                  <span className="sv-stat-icon sv-tone-primary"><i className="bi bi-collection" /></span>
                  <StatusBadge status={group.status} />
                </div>
                <h3>{group.nome}</h3>
                <p>
                  {group.totalPlacas} {group.totalPlacas === 1 ? "placa" : "placas"} · {formatPower(potenciaInstalada(doGrupo))}p
                </p>
                <span className="sv-group-card-foot">
                  <i className="bi bi-geo-alt" />
                  {group.latitude != null ? `${group.latitude.toFixed(3)}, ${group.longitude.toFixed(3)}` : "Sem local"}
                </span>
              </Link>
            );
          })}
          {data && groups.length === 0 ? (
            <div className="card sv-empty sv-empty-sm">
              <i className="bi bi-collection" />
              <p>Nenhum grupo cadastrado.</p>
              <Link to="/app/cadastro">Cadastrar o primeiro</Link>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
