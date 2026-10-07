import Chart from "react-apexcharts";
import ptBr from "apexcharts/dist/locales/pt-br.json";
import { toSaoPaulo } from "../lib/periodo";
import { formatPower, powerUnit } from "../lib/power";

// medida = real (simulado, até a última hora completa); estimada = pelo clima, com a previsão do tempo.
const SERIES = [
  { key: "medida", name: "Real", color: "#3b7197", dash: 0 },
  { key: "estimada", name: "Estimada (previsão do tempo)", color: "#e8a317", dash: 5 }
];

const TOOLTIP_FORMAT = { dia: "dd/MM HH:mm", ano: "MMMM 'de' yyyy" };

// Só desenha: quem usa busca os pontos (dashboard_metricas) e decide a janela (view).
export default function MetricChart({ points, view = "dia", height = 320 }) {
  // Só as séries com dados. Eixo no relógio de SP: os pontos vão "como UTC" e o ApexCharts formata em UTC.
  const series = SERIES.map(({ key, ...serie }) => ({
    ...serie,
    data: points.filter((point) => point[key] != null).map((point) => [toSaoPaulo(point.x).getTime(), Number(point[key])])
  })).filter((serie) => serie.data.length > 0);

  if (series.length === 0) {
    return (
      <div className="sv-empty" style={{ minHeight: height }}>
        <i className="bi bi-cloud-sun" />
        <p>Sem dados neste período.</p>
        <span>Placas com local, potência e inclinação ganham a geração estimada pelo clima em ~1 min.</span>
      </div>
    );
  }

  const unit = powerUnit(Math.max(0, ...series.flatMap((serie) => serie.data.map(([, y]) => y))));
  const xs = series.flatMap((serie) => serie.data.map(([x]) => x));
  const agora = toSaoPaulo(new Date()).getTime();
  const mostraAgora = agora >= Math.min(...xs) && agora <= Math.max(...xs);

  const options = {
    chart: {
      type: "area",
      toolbar: { show: false },
      zoom: { enabled: false },
      fontFamily: "inherit",
      background: "transparent",
      locales: [ptBr],
      defaultLocale: "pt-br",
      animations: { speed: 350 }
    },
    colors: series.map((serie) => serie.color),
    stroke: { curve: "smooth", width: 2.5, dashArray: series.map((serie) => serie.dash) },
    fill: {
      type: "gradient",
      gradient: { shadeIntensity: 1, opacityFrom: 0.32, opacityTo: 0.02, stops: [0, 90, 100] }
    },
    dataLabels: { enabled: false },
    legend: { show: true, showForSingleSeries: true, position: "top", horizontalAlign: "right", markers: { size: 5 } },
    xaxis: {
      type: "datetime",
      labels: { datetimeUTC: true },
      axisBorder: { show: false },
      axisTicks: { show: false },
      tooltip: { enabled: false }
    },
    yaxis: {
      min: 0,
      forceNiceScale: true,
      labels: { formatter: (value) => formatPower(value, unit) }
    },
    grid: { borderColor: "rgba(127, 145, 163, 0.18)", strokeDashArray: 4 },
    annotations: mostraAgora
      ? { xaxis: [{ x: agora, borderColor: "#7f91a3", strokeDashArray: 3, label: { text: "Agora", borderWidth: 0, style: { background: "transparent", color: "#7f91a3" } } }] }
      : {},
    tooltip: {
      x: { format: TOOLTIP_FORMAT[view] ?? "dd/MM/yyyy" },
      y: { formatter: (value) => formatPower(value, unit) }
    }
  };

  return <Chart options={options} series={series} type="area" height={height} />;
}
