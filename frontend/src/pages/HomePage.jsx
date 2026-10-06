import { useEffect, useState } from "react";
import { extractErrorMessage, getDashboardSummary, listGroups } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import StatCard from "../components/StatCard";
import { formatEnergy } from "../lib/power";
import { titleCase } from "../lib/text";

export default function HomePage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [groups, setGroups] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const [summaryData, groupsData] = await Promise.all([getDashboardSummary(), listGroups()]);
        setSummary(summaryData);
        setGroups(groupsData);
      } catch (err) {
        setError(extractErrorMessage(err));
      }
    }

    loadData();
  }, []);

  return (
    <div className="sv-home">
      <div className="sv-home-intro">
        <h1>Olá, {user?.nome ? titleCase(user.nome) : "Usuário"}!</h1>
        <p className="text-muted mb-0">
          Visão resumida da operação solar com a linguagem visual original do painel.
        </p>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}

      <section className="sv-home-stats">
        <StatCard
          title="Total Gerado Hoje"
          value={formatEnergy(summary?.totalGeradoHoje)}
          subtitle="Energia gerada desde o início do dia"
          icon="bi-sun-fill"
        />
        <StatCard
          title="Placas Ativas"
          value={summary?.placasAtivas ?? "--"}
          subtitle="Equipamentos em operação"
          icon="bi-lightning-charge-fill"
        />
        <StatCard
          title="Última Limpeza"
          value={summary?.ultimaLimpeza?.placaModelo || "Sem registro"}
          subtitle={
            summary?.ultimaLimpeza?.dataLimpeza
              ? new Date(summary.ultimaLimpeza.dataLimpeza).toLocaleString("pt-BR")
              : "Nenhuma limpeza cadastrada"
          }
          icon="bi-droplet-half"
        />
      </section>

      <section className="card sv-home-panel">
        <div className="sv-panel-head">
          <div>
            <h2>Grupos solares</h2>
            <p className="text-muted mb-0">Resumo rápido dos grupos cadastrados.</p>
          </div>
          <span className="badge text-bg-light">{groups.length} grupos</span>
        </div>

        <div className="sv-group-grid">
          {groups.map((group) => (
            <article key={group.id} className="sv-summary-tile sv-group-card">
              <div className="sv-group-card-head">
                <div>
                  <h3>{group.nome}</h3>
                  <p>{group.status}</p>
                </div>
                <span className="badge rounded-pill text-bg-primary">{group.totalPlacas} placas</span>
              </div>
            </article>
          ))}
          {groups.length === 0 ? <p className="sv-empty-state">Nenhum grupo cadastrado.</p> : null}
        </div>
      </section>
    </div>
  );
}
