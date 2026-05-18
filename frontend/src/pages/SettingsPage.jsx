import { useAuth } from "../context/AuthContext";

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="sv-page-stack">
      <div>
        <h1 className="mb-2">Configurações</h1>
        <p className="text-muted mb-0">Perfil do usuário e preferências do sistema.</p>
      </div>

      <div className="row g-4">
        <div className="col-lg-6">
          <div className="card">
            <h2 className="h5 mb-3">Meu Perfil</h2>
            <div className="sv-profile-grid">
              <div>
                <span className="text-muted small d-block">Nome</span>
                <strong>{user?.nome || "--"}</strong>
              </div>
              <div>
                <span className="text-muted small d-block">E-mail</span>
                <strong>{user?.email || "--"}</strong>
              </div>
              <div>
                <span className="text-muted small d-block">Perfil</span>
                <strong>{user?.role || "--"}</strong>
              </div>
              <div>
                <span className="text-muted small d-block">Criado em</span>
                <strong>
                  {user?.criadoEm ? new Date(user.criadoEm).toLocaleString("pt-BR") : "--"}
                </strong>
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="card">
            <h2 className="h5 mb-3">Sistema</h2>
            <ul className="list-group list-group-flush">
              <li className="list-group-item bg-transparent px-0">
                Endpoint da API: <code>/api</code>
              </li>
              <li className="list-group-item bg-transparent px-0">
                Autenticação: <code>JWT Bearer</code>
              </li>
              <li className="list-group-item bg-transparent px-0">
                Frontend: <code>React + Vite + ApexCharts</code>
              </li>
              <li className="list-group-item bg-transparent px-0">
                Navegação protegida por rota privada.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
