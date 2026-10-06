import { startTransition, useEffect, useMemo, useState } from "react";
import Chart from "react-apexcharts";
import { extractErrorMessage, getDashboardMetrics, getLastReadingDate } from "../lib/api";
import { formatRangeLabel, rangeFor, shiftDate, toSaoPaulo } from "../lib/periodo";
import { formatPower, powerUnit } from "../lib/power";

// Cada "view" e' a janela mostrada; o "bucket" (date_trunc no Supabase) e' escolhido
// automaticamente para dar uma quantidade de pontos adequada e alinhada ao calendario.
const VIEWS = [
  { value: "dia", label: "Dia", bucket: "hora" },
  { value: "semana", label: "Semana", bucket: "dia" },
  { value: "mes", label: "Mês", bucket: "dia" },
  { value: "ano", label: "Ano", bucket: "mes" }
];

function viewConfig(view) {
  return VIEWS.find((item) => item.value === view) ?? VIEWS[0];
}

export default function MetricChart() {
  const [granularity, setGranularity] = useState("dia");
  const [referenceDate, setReferenceDate] = useState(null);
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Ancora o grafico na ULTIMA leitura disponivel (com o shift do seeder, ~hoje),
  // dando a sensacao de monitoramento em tempo real.
  useEffect(() => {
    async function fetchRange() {
      try {
        const ultimaLeitura = await getLastReadingDate();
        setReferenceDate(toSaoPaulo(ultimaLeitura ?? new Date()));
      } catch {
        setReferenceDate(toSaoPaulo(new Date()));
      }
    }

    fetchRange();
  }, []);

  useEffect(() => {
    if (!referenceDate) return;

    async function fetchMetrics() {
      setLoading(true);
      setError("");
      try {
        const data = await getDashboardMetrics({
          granularidade: viewConfig(granularity).bucket,
          ...rangeFor(granularity, referenceDate)
        });
        setPoints(data);
      } catch (err) {
        setError(extractErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }

    fetchMetrics();
  }, [granularity, referenceDate]);

  const seriesData = useMemo(
    // Eixo no relógio de SP: os pontos vão "como UTC" e o ApexCharts formata em UTC.
    () => points.map((point) => [toSaoPaulo(point.x).getTime(), Number(point.y)]),
    [points]
  );

  const unit = useMemo(() => {
    const max = seriesData.reduce((acc, [, y]) => (y > acc ? y : acc), 0);
    return powerUnit(max);
  }, [seriesData]);

  const series = [{ name: "Potência média", data: seriesData }];

  const tooltipFormat =
    granularity === "dia" ? "HH:mm" : granularity === "ano" ? "MMM/yyyy" : "dd/MM/yyyy";

  const options = {
    chart: {
      type: "area",
      toolbar: { show: false },
      zoom: { enabled: false }
    },
    colors: ["#3b7197"],
    stroke: { curve: "smooth", width: 3 },
    fill: {
      type: "gradient",
      gradient: { shadeIntensity: 1, opacityFrom: 0.38, opacityTo: 0.04, stops: [0, 90, 100] }
    },
    dataLabels: { enabled: false },
    legend: { show: true, position: "top", horizontalAlign: "left" },
    xaxis: {
      type: "datetime",
      labels: { datetimeUTC: true }
    },
    yaxis: {
      labels: { formatter: (value) => formatPower(value, unit) }
    },
    grid: { borderColor: "rgba(59, 113, 151, 0.12)" },
    tooltip: {
      x: { format: tooltipFormat },
      y: { formatter: (value) => formatPower(value, unit) }
    }
  };

  return (
    <div className="card">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <h2 className="h4 text-secondary mb-1">Geração de Energia</h2>
          <p className="text-muted mb-0">Potência média gerada, agregada por período.</p>
        </div>

        <div className="chart-controls d-flex flex-column flex-md-row align-items-stretch gap-2">
          <div className="btn-group">
            <button
              className="btn btn-outline-secondary"
              onClick={() => setReferenceDate((current) => (current ? shiftDate(current, granularity, -1) : current))}
            >
              <i className="bi bi-chevron-left" />
            </button>
            <button className="btn btn-outline-secondary disabled sv-range-label">
              {referenceDate ? formatRangeLabel(granularity, referenceDate) : "-"}
            </button>
            <button
              className="btn btn-outline-secondary"
              onClick={() => setReferenceDate((current) => (current ? shiftDate(current, granularity, 1) : current))}
            >
              <i className="bi bi-chevron-right" />
            </button>
          </div>

          <div className="btn-group">
            {VIEWS.map((item) => (
              <button
                key={item.value}
                className={`btn btn-outline-secondary ${granularity === item.value ? "active" : ""}`}
                onClick={() => startTransition(() => setGranularity(item.value))}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="sv-state-block">
          <div className="spinner-border text-primary" role="status" />
        </div>
      ) : error ? (
        <div className="alert alert-danger mb-0">{error}</div>
      ) : points.length === 0 ? (
        <div className="sv-state-block text-muted">Sem leituras neste período.</div>
      ) : (
        <Chart options={options} series={series} type="area" height={320} />
      )}
    </div>
  );
}
