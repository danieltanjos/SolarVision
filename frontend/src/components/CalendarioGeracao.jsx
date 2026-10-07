import { useEffect, useState } from "react";
import Chart from "react-apexcharts";
import { getDashboardMetrics } from "../lib/api";
import { calendarioAno } from "../lib/historico";
import { rangeFor, toSaoPaulo } from "../lib/periodo";
import { formatEnergy } from "../lib/power";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const DIAS = Array.from({ length: 31 }, (_, i) => String(i + 1));
// Âmbar do sol (--sv-accent) em 5 intensidades, translúcido para valer no tema claro e no escuro.
const ALFAS = [0.18, 0.36, 0.56, 0.78, 1];
const SEM_DADO = "rgba(127, 145, 163, 0.12)";

// Heatmap da energia estimada por dia de um ano (linhas = meses, colunas = dias) da seleção atual.
export default function CalendarioGeracao({ grupoId = null, placaId = null }) {
  const [ano, setAno] = useState(() => toSaoPaulo(new Date()).getUTCFullYear());
  const [grade, setGrade] = useState(null);

  useEffect(() => {
    let ativo = true;
    setGrade(null);
    getDashboardMetrics({ granularidade: "dia", ...rangeFor("ano", new Date(Date.UTC(ano, 0, 1))), grupoId, placaId }).then(
      (data) => ativo && setGrade(calendarioAno(data)),
      () => ativo && setGrade(calendarioAno([]))
    );
    return () => {
      ativo = false;
    };
  }, [ano, grupoId, placaId]);

  const maior = Math.max(0, ...(grade ?? []).flat());
  // Faixas a partir de > 0: dia sem dado (null) não cai em nenhuma e fica com a cor SEM_DADO.
  const ranges = ALFAS.map((alfa, i) => ({
    from: i === 0 ? 0.01 : (maior * i) / ALFAS.length,
    to: (maior * (i + 1)) / ALFAS.length,
    color: `rgba(232, 163, 23, ${alfa})`,
    name: `até ${formatEnergy((maior * (i + 1)) / ALFAS.length)}`
  }));
  // O heatmap empilha as séries de baixo para cima: invertido, janeiro fica no topo.
  const series = MESES.map((mes, m) => ({ name: mes, data: DIAS.map((dia, d) => ({ x: dia, y: grade?.[m][d] ?? null })) })).reverse();

  const options = {
    chart: { type: "heatmap", toolbar: { show: false }, fontFamily: "inherit", background: "transparent", animations: { enabled: false } },
    plotOptions: { heatmap: { radius: 3, enableShades: false, colorScale: { ranges } } },
    colors: [SEM_DADO],
    dataLabels: { enabled: false },
    stroke: { width: 2 },
    legend: { position: "bottom", horizontalAlign: "center", markers: { size: 5, strokeWidth: 0 } },
    xaxis: {
      labels: { rotate: 0, hideOverlappingLabels: true },
      axisBorder: { show: false },
      axisTicks: { show: false },
      tooltip: { enabled: false }
    },
    tooltip: {
      x: { show: false },
      y: {
        title: { formatter: (mes, { dataPointIndex }) => `${dataPointIndex + 1} ${mes}:` },
        formatter: (valor) => (valor == null ? "sem dados" : formatEnergy(valor))
      }
    }
  };

  return (
    <section className="card">
      <div className="sv-card-head">
        <div>
          <h2>Calendário de geração</h2>
          <p>Energia estimada por dia, pelo clima de cada dia.</p>
        </div>
        <div className="sv-period">
          <button type="button" aria-label="Ano anterior" onClick={() => setAno((a) => a - 1)}>
            <i className="bi bi-chevron-left" />
          </button>
          <span>{ano}</span>
          <button type="button" aria-label="Próximo ano" onClick={() => setAno((a) => a + 1)}>
            <i className="bi bi-chevron-right" />
          </button>
        </div>
      </div>

      {grade === null ? (
        <div className="sv-empty" style={{ minHeight: 320 }}>
          <div className="spinner-border text-primary" role="status" />
        </div>
      ) : maior === 0 ? (
        <div className="sv-empty" style={{ minHeight: 320 }}>
          <i className="bi bi-calendar3" />
          <p>Sem estimativa em {ano}.</p>
        </div>
      ) : (
        <div className="sv-calendario">
          <Chart options={options} series={series} type="heatmap" height={320} />
        </div>
      )}
    </section>
  );
}
