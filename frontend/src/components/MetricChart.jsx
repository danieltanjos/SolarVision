import { startTransition, useEffect, useState } from "react";
import Chart from "react-apexcharts";
import api, { extractErrorMessage } from "../lib/api";

const GRANULARIDADES = [
  { value: "hora", label: "Hora" },
  { value: "dia", label: "Dia" },
  { value: "semana", label: "Semana" },
  { value: "mes", label: "Mês" }
];

function shiftDate(date, granularity, direction) {
  const next = new Date(date);
  if (granularity === "hora") next.setDate(next.getDate() + direction);
  if (granularity === "dia") next.setDate(next.getDate() + direction * 7);
  if (granularity === "semana") next.setDate(next.getDate() + direction * 28);
  if (granularity === "mes") next.setMonth(next.getMonth() + direction);
  return next;
}

function rangeFor(granularity, referenceDate) {
  // A janela começa na data de referência e avança no tempo,
  // de modo que o gráfico inicia no primeiro dia com dados.
  const start = new Date(referenceDate);
  const end = new Date(referenceDate);

  if (granularity === "hora") {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (granularity === "dia") {
    end.setDate(end.getDate() + 7);
  } else if (granularity === "semana") {
    end.setDate(end.getDate() + 28);
  } else {
    end.setMonth(end.getMonth() + 6);
  }

  return {
    dataInicio: start.toISOString(),
    dataFim: end.toISOString()
  };
}

function formatRangeLabel(granularity, referenceDate) {
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
  const { dataInicio, dataFim } = rangeFor(granularity, referenceDate);
  const start = formatter.format(new Date(dataInicio));
  const end = formatter.format(new Date(dataFim));
  return granularity === "hora" ? end : `${start} - ${end}`;
}

export default function MetricChart() {
  const [granularity, setGranularity] = useState("dia");
  const [referenceDate, setReferenceDate] = useState(null);
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Ancora o gráfico no primeiro dia com dados na base (carga do CSV).
  useEffect(() => {
    async function fetchRange() {
      try {
        const { data } = await api.get("/api/dashboard/range");
        setReferenceDate(data?.primeiraLeitura ? new Date(data.primeiraLeitura) : new Date());
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
        const params = {
          granularidade: granularity,
          ...rangeFor(granularity, referenceDate)
        };
        const { data } = await api.get("/api/dashboard/metrics", { params });
        setPoints(data);
      } catch (err) {
        setError(extractErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }

    fetchMetrics();
  }, [granularity, referenceDate]);

  const series = [
    {
      name: "Watts gerados",
      data: points.map((point) => [new Date(point.x).getTime(), Number(point.y)])
    }
  ];

  const options = {
    chart: {
      type: "area",
      toolbar: { show: false },
      zoom: { enabled: false }
    },
    colors: ["#3b7197"],
    stroke: {
      curve: "smooth",
      width: 3
    },
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.38,
        opacityTo: 0.04,
        stops: [0, 90, 100]
      }
    },
    dataLabels: { enabled: false },
    xaxis: { type: "datetime" },
    yaxis: {
      labels: {
        formatter: (value) => `${Math.round(value)} W`
      }
    },
    grid: {
      borderColor: "rgba(59, 113, 151, 0.12)"
    },
    tooltip: {
      x: { format: "dd/MM/yyyy HH:mm" }
    }
  };

  return (
    <div className="card">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <h2 className="h4 text-secondary mb-1">Geração de Energia</h2>
          <p className="text-muted mb-0">Leitura agregada em gráfico de área suavizada.</p>
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
            {GRANULARIDADES.map((item) => (
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
        <div className="sv-state-block text-muted">Sem dados para o período selecionado.</div>
      ) : (
        <Chart options={options} series={series} type="area" height={380} />
      )}
    </div>
  );
}
