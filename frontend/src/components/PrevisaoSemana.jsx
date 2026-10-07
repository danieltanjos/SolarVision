import { useEffect, useState } from "react";
import { getDashboardMetrics } from "../lib/api";
import { TIME_ZONE, rangeFor, shiftDate, toSaoPaulo } from "../lib/periodo";
import { formatEnergy } from "../lib/power";

const ROTULO = ["Hoje", "Amanhã"];

// Energia estimada por dia, de hoje até a última hora da previsão do tempo (7 dias).
export default function PrevisaoSemana({ grupoId = null, placaId = null }) {
  const [dias, setDias] = useState(null);

  useEffect(() => {
    let ativo = true;
    const hoje = toSaoPaulo(new Date());
    getDashboardMetrics({
      granularidade: "dia",
      dataInicio: rangeFor("dia", hoje).dataInicio,
      dataFim: rangeFor("dia", shiftDate(hoje, "dia", 6)).dataFim,
      grupoId,
      placaId
    }).then(
      (data) => ativo && setDias(data.filter((dia) => Number(dia.estimadaWh) > 0)),
      () => ativo && setDias([])
    );
    return () => {
      ativo = false;
    };
  }, [grupoId, placaId]);

  const maior = Math.max(1, ...(dias ?? []).map((dia) => Number(dia.estimadaWh)));

  return (
    <section className="card">
      <div className="sv-card-head">
        <div>
          <h2>Previsão de geração</h2>
          <p>Energia estimada por dia, pela previsão do tempo.</p>
        </div>
      </div>

      {dias === null ? (
        <div className="sv-empty sv-empty-sm">
          <div className="spinner-border text-primary" role="status" />
        </div>
      ) : dias.length === 0 ? (
        <div className="sv-empty sv-empty-sm">
          <i className="bi bi-cloud-sun" />
          <p>Sem previsão para esta seleção.</p>
        </div>
      ) : (
        <div className="sv-forecast">
          {dias.map((dia, i) => {
            const data = new Date(dia.x);
            const semana = data.toLocaleDateString("pt-BR", { timeZone: TIME_ZONE, weekday: "short" }).replace(".", "");
            return (
              <div key={dia.x} className={`sv-forecast-day ${i === 0 ? "is-today" : ""}`}>
                <span className="sv-forecast-label">{ROTULO[i] ?? semana}</span>
                <div className="sv-forecast-bar" aria-hidden="true">
                  <div style={{ height: `${(Number(dia.estimadaWh) / maior) * 100}%` }} />
                </div>
                <strong>{formatEnergy(dia.estimadaWh)}</strong>
                <small>{data.toLocaleDateString("pt-BR", { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit" })}</small>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
