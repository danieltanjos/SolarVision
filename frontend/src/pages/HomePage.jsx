import { useEffect, useState } from "react";
import api, { extractErrorMessage } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import StatCard from "../components/StatCard";

export default function HomePage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [groups, setGroups] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const [summaryResponse, groupsResponse] = await Promise.all([
          api.get("/api/dashboard/summary"),
          api.get("/api/groups")
        ]);
        setSummary(summaryResponse.data);
        setGroups(groupsResponse.data);
      } catch (err) {
        setError(extractErrorMessage(err));
      }
    }

    loadData();
  }, []);

  return (
    <div className="sv-page-stack">
      <div>
        <h1 className="mb-2">Olá, {user?.nome || "Usuário"}!</h1>
        <p className="text-muted mb-0">
          Visão resumida da operação solar com a mesma linguagem do painel anterior.
        </p>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}

      <div className="row g-4">
        <div className="col-lg-4 col-md-6">
          <StatCard
            title="Total Gerado Hoje"
            value={`${Number(summary?.totalGeradoHoje || 0).toFixed(0)} W`}
            subtitle="Somatório desde o início do dia operacional"
            icon="bi-sun-fill"
          />
        </div>
        <div className="col-lg-4 col-md-6">
          <StatCard
            title="Placas Ativas"
            value={summary?.placasAtivas ?? "--"}
            subtitle="Equipamentos em operação"
            icon="bi-lightning-charge-fill"
          />
        </div>
        <div className="col-lg-4 col-md-12">
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
        </div>
      </div>

      <div className="card">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h2 className="h5 mb-1">Grupos solares</h2>
            <p className="text-muted mb-0">Resumo rápido dos grupos cadastrados.</p>
          </div>
          <span className="badge text-bg-light">{groups.length} grupos</span>
        </div>

        <div className="row g-3">
          {groups.map((group) => (
            <div key={group.id} className="col-md-6 col-xl-4">
              <div className="sv-summary-tile">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <h3>{group.nome}</h3>
                    <p>{group.status}</p>
                  </div>
                  <span className="badge rounded-pill text-bg-primary">{group.totalPlacas} placas</span>
                </div>
              </div>
            </div>
          ))}
          {groups.length === 0 ? <div className="text-muted">Nenhum grupo cadastrado.</div> : null}
        </div>
      </div>
    </div>
  );
}
