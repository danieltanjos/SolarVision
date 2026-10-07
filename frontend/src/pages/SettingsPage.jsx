import { useAuth } from "../context/AuthContext";
import { titleCase } from "../lib/text";

const SISTEMA = [
  ["bi-database", "Backend", "Supabase (PostgREST + RPC)"],
  ["bi-shield-lock", "Autenticação", "Supabase Auth (JWT)"],
  ["bi-window", "Frontend", "React + Vite + ApexCharts"],
  ["bi-cloud-sun", "Clima", "Open-Meteo (histórico + previsão)"]
];

export default function SettingsPage() {
  const { user } = useAuth();
  const nome = user?.nome ? titleCase(user.nome) : "—";
  const iniciais = nome.split(" ").map((parte) => parte[0]).slice(0, 2).join("");

  return (
    <div className="sv-page">
      <header className="sv-page-head">
        <div>
          <h1>Configurações</h1>
          <p>Seu perfil e informações do sistema.</p>
        </div>
      </header>

      <div className="sv-split sv-split-even">
        <section className="card">
          <div className="sv-profile">
            <span className="sv-avatar sv-avatar-lg">{iniciais}</span>
            <div className="min-w-0">
              <h2 className="mb-1">{nome}</h2>
              <p className="sv-muted mb-0 text-truncate">{user?.email || "—"}</p>
            </div>
          </div>
          <dl className="sv-details">
            <div><dt>Perfil</dt><dd>{user?.role || "—"}</dd></div>
            <div><dt>Criado em</dt><dd>{user?.criadoEm ? new Date(user.criadoEm).toLocaleDateString("pt-BR") : "—"}</dd></div>
          </dl>
        </section>

        <section className="card">
          <div className="sv-card-head">
            <h2>Sistema</h2>
          </div>
          <ul className="sv-list">
            {SISTEMA.map(([icon, titulo, valor]) => (
              <li key={titulo}>
                <span className="sv-list-icon"><i className={`bi ${icon}`} /></span>
                <div className="min-w-0">
                  <strong>{titulo}</strong>
                  <span>{valor}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
