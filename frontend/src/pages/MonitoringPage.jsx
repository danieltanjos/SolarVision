import MetricChart from "../components/MetricChart";

export default function MonitoringPage() {
  return (
    <div className="sv-page-stack">
      <div>
        <h1 className="mb-2">Monitoramento</h1>
        <p className="text-muted mb-0">
          Gráfico principal de geração com filtros reativos por granularidade.
        </p>
      </div>
      <MetricChart />
    </div>
  );
}
