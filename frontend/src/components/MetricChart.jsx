import { startTransition, useEffect, useMemo, useState } from "react";
import Chart from "react-apexcharts";
import { extractErrorMessage, getDashboardMetrics, getLastReadingDate } from "../lib/api";
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

// Move a data de referencia em uma unidade da view (dia/semana/mes/ano).
function shiftDate(date, view, direction) {
  const next = new Date(date);
  if (view === "dia") next.setDate(next.getDate() + direction);
  else if (view === "semana") next.setDate(next.getDate() + direction * 7);
  else if (view === "mes") next.setMonth(next.getMonth() + direction);
  else if (view === "ano") next.setFullYear(next.getFullYear() + direction);
  return next;
}

// Janela alinhada ao calendario a partir da data de referencia.
function rangeFor(view, referenceDate) {
  const start = new Date(referenceDate);
  let end;

  if (view === "dia") {
    start.setHours(0, 0, 0, 0);
    end = new Date(start);
    end.setHours(23, 59, 59, 999);
  } else if (view === "semana") {
    start.setDate(start.getDate() - start.getDay()); // domingo
    start.setHours(0, 0, 0, 0);
    end = new Date(start);
    end.setDate(start.getDate() + 6); // sabado
    end.setHours(23, 59, 59, 999);
  } else if (view === "mes") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
  } else {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
    end = new Date(start.getFullYear(), 11, 31, 23, 59, 59, 999);
  }

  return { dataInicio: start.toISOString(), dataFim: end.toISOString() };
}

function formatRangeLabel(view, referenceDate) {
  const { dataInicio, dataFim } = rangeFor(view, referenceDate);
  const start = new Date(dataInicio);
  const end = new Date(dataFim);

  if (view === "dia") {
    return start.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  }
  if (view === "semana") {
    const s = start.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    const e = end.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
    return `${s} - ${e}`;
  }
  if (view === "mes") {
    const label = start.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }
  return String(start.getFullYear());
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
        setReferenceDate(ultimaLeitura ? new Date(ultimaLeitura) : new Date());
      } catch {
        setReferenceDate(new Date());
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
    () => points.map((point) => [new Date(point.x).getTime(), Number(point.y)]),
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
      labels: { datetimeUTC: false }
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
