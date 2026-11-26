import { useEffect, useState } from "react";
import { getAcertoPrevisao, getDashboardMetrics, getPrevisaoMl } from "../lib/api";
import { erroPrevisao } from "../lib/historico";
import { TIME_ZONE, rangeFor, shiftDate, toSaoPaulo } from "../lib/periodo";
import { formatPerda } from "../lib/placas";
import { formatEnergy } from "../lib/power";
import { comModelo, diaDe, somarPorDia } from "../lib/previsaoMl";

const ROTULO = ["Hoje", "Amanhã"];

// "Previsão de ontem: 9,6 kWh · aconteceu 8,1 kWh (erro 18%) · erro médio em 7 dias: 12%".
function textoAcerto(acerto) {
  const ultimo = acerto.at(-1);
  if (!ultimo) return "Acerto da previsão: acumulando dados.";
  const ontem = shiftDate(toSaoPaulo(new Date()), "dia", -1).toISOString().slice(0, 10);
  const dia = ultimo.dia === ontem ? "ontem" : ultimo.dia.split("-").reverse().slice(0, 2).join("/");
  const media = acerto.length > 1 ? ` · erro médio em ${acerto.length} dias: ${formatPerda(erroPrevisao(acerto))}` : "";
  return `Previsão de ${dia}: ${formatEnergy(ultimo.previstoWh)} · aconteceu ${formatEnergy(ultimo.ocorridoWh)} (erro ${formatPerda(erroPrevisao([ultimo]))})${media}`;
}

// Energia por dia, de hoje até a última hora da previsão do tempo (7 dias): a estimativa física e, quando o
// datalake já publicou, a previsão do modelo (a física corrigida pelo histórico real de geração) com a faixa.
export default function PrevisaoSemana({ grupoId = null, placaId = null }) {
  const [dias, setDias] = useState(null);
  const [acerto, setAcerto] = useState(null);

  useEffect(() => {
    let ativo = true;
    // a previsão de cada dia é guardada às 21:00 da véspera; a tabela começa vazia
    getAcertoPrevisao({ grupoId, placaId }).then((data) => ativo && setAcerto(data), () => ativo && setAcerto(null));
    const hoje = toSaoPaulo(new Date());
    const dataInicio = rangeFor("dia", hoje).dataInicio;
    const dataFim = rangeFor("dia", shiftDate(hoje, "dia", 6)).dataFim;
    Promise.all([
      getDashboardMetrics({ granularidade: "dia", dataInicio, dataFim, grupoId, placaId }),
      getPrevisaoMl({ dataInicio: diaDe(dataInicio, TIME_ZONE), dataFim: diaDe(dataFim, TIME_ZONE), grupoId, placaId })
        .catch(() => [])
    ]).then(
      ([data, ml]) => ativo && setDias(comModelo(data.filter((dia) => Number(dia.estimadaWh) > 0), somarPorDia(ml), TIME_ZONE)),
      () => ativo && setDias([])
    );
    return () => {
      ativo = false;
    };
  }, [grupoId, placaId]);

  const temModelo = (dias ?? []).some((dia) => dia.modelo);
  const valor = (dia) => Number(dia.modelo?.previstaWh ?? dia.estimadaWh);
  const maior = Math.max(1, ...(dias ?? []).map((dia) => Math.max(valor(dia), Number(dia.modelo?.p90Wh ?? 0))));

  return (
    <section className="card">
      <div className="sv-card-head">
        <div>
          <h2>Previsão de geração</h2>
          <p>
            {temModelo
              ? "Energia prevista por dia: a previsão do tempo, ajustada pelo modelo do datalake com o histórico de geração."
              : "Energia estimada por dia, pela previsão do tempo."}
          </p>
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
                  {dia.modelo ? (
                    <span className="sv-forecast-faixa"
                      style={{ bottom: `${(dia.modelo.p10Wh / maior) * 100}%`,
                        height: `${((dia.modelo.p90Wh - dia.modelo.p10Wh) / maior) * 100}%` }} />
                  ) : null}
                  <div style={{ height: `${(valor(dia) / maior) * 100}%` }} />
                </div>
                <strong>{formatEnergy(valor(dia))}</strong>
                {dia.modelo ? (
                  <small title={`Faixa provável: ${formatEnergy(dia.modelo.p10Wh)} a ${formatEnergy(dia.modelo.p90Wh)}`}>
                    física {formatEnergy(dia.estimadaWh)}
                  </small>
                ) : null}
                <small>{data.toLocaleDateString("pt-BR", { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit" })}</small>
              </div>
            );
          })}
        </div>
      )}

      {acerto ? <p className="sv-muted small mt-3 mb-0">{textoAcerto(acerto)}</p> : null}
    </section>
  );
}
