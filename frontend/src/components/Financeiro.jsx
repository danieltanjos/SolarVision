import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import StatCard from "./StatCard";
import { getFinanceiro } from "../lib/api";
import { formatReais } from "../lib/financeiro";
import { formatEnergy } from "../lib/power";

const cadastro = <Link to="/app/cadastro">informe no cadastro</Link>;

// Economia e perda por sujeira da seleção no mesmo período do gráfico.
export default function Financeiro({ dataInicio, dataFim, grupoId = null, placaId = null, totalPlacas }) {
  const [valores, setValores] = useState(null);

  useEffect(() => {
    let ativo = true;
    setValores(null);
    getFinanceiro({ dataInicio, dataFim, grupoId, placaId }).then(
      (data) => ativo && setValores(data),
      () => ativo && setValores({})
    );
    return () => {
      ativo = false;
    };
  }, [dataInicio, dataFim, grupoId, placaId]);

  const semTarifa = valores?.placasSemTarifa ?? 0;
  const nenhumaTarifa = semTarifa > 0 && semTarifa >= totalPlacas;
  const valor = (texto) => (valores ? texto : "…");

  return (
    <section className="card">
      <div className="sv-card-head">
        <div>
          <h2>Valores do período</h2>
          <p>Energia real valorada pela tarifa de cada grupo.</p>
        </div>
      </div>
      <div className="sv-stats sv-stats-compact">
        <StatCard
          title="Economia"
          value={valor(nenhumaTarifa ? "—" : formatReais(valores?.economia))}
          subtitle={
            nenhumaTarifa ? <>Sem tarifa: {cadastro}</>
              : semTarifa ? <>{semTarifa} {semTarifa === 1 ? "placa" : "placas"} sem tarifa: {cadastro}</>
                : `${formatEnergy(valores?.realWh)} × tarifa`
          }
          icon="bi-cash-coin"
          tone="success"
        />
        <StatCard
          title="Perdido com sujeira"
          value={valor(formatEnergy(valores?.perdaSujeiraWh))}
          subtitle={nenhumaTarifa ? "Estimado − real" : `${formatReais(valores?.perdaSujeira)} deixados de economizar`}
          icon="bi-droplet-half"
          tone="accent"
        />
      </div>
    </section>
  );
}
