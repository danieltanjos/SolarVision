import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { applyTheme, getInitialTheme } from "../lib/theme";
import MobileNav from "./MobileNav";
import Sidebar from "./Sidebar";
import logo from "../../img/logo.png";

export default function AppShell() {
  const { logout, user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isDark, setIsDark] = useState(getInitialTheme);

  useEffect(() => {
    applyTheme(isDark);
  }, [isDark]);

  useEffect(() => {
    if (!user?.criadoEm) {
      refreshUser().catch(() => {});
    }
  }, [refreshUser, user]);

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  const pageTitle = {
    "/app/home": "Home",
    "/app/limpeza": "Limpeza",
    "/app/monitoramento": "Monitoramento",
    "/app/cadastro": "Cadastro",
    "/app/configuracoes": "Configurações"
  }[location.pathname] || "SolarVision";

  return (
    <div className="sv-shell">
      <Sidebar />

      <div className="sv-main">
        <nav className="navbar navbar-expand-lg navbar-light bg-white shadow-sm sv-topbar">
          <div className="container-fluid px-3 px-lg-4">
            <div className="d-flex align-items-center gap-3">
              <Link className="navbar-brand d-flex align-items-center mb-0" to="/app/home">
                <img src={logo} alt="Logo" className="navbar-logo me-2" />
                SolarVision
              </Link>
              <span className="sv-page-tag d-none d-md-inline">{pageTitle}</span>
            </div>

            <div className="d-flex align-items-center gap-3">
              <div className="form-check form-switch mb-0 d-flex align-items-center gap-2">
                <input
                  id="modoEscuro"
                  className="form-check-input mt-0"
                  type="checkbox"
                  checked={isDark}
                  onChange={(event) => setIsDark(event.target.checked)}
                />
                <label className="form-check-label text-muted small" htmlFor="modoEscuro">
                  Tema escuro
                </label>
              </div>

              <div className="dropdown">
                <button
                  className="btn btn-link nav-link dropdown-toggle text-decoration-none p-0"
                  data-bs-toggle="dropdown"
                  type="button"
                >
                  <i className="bi bi-person-circle me-2" />
                  <span>{user?.nome || "Usuário"}</span>
                </button>
                <ul className="dropdown-menu dropdown-menu-end">
                  <li>
                    <button className="dropdown-item" onClick={() => navigate("/app/configuracoes")}>
                      Meu Perfil
                    </button>
                  </li>
                  <li>
                    <button className="dropdown-item" onClick={() => navigate("/app/configuracoes")}>
                      Configurações
                    </button>
                  </li>
                  <li><hr className="dropdown-divider" /></li>
                  <li>
                    <button className="dropdown-item text-danger" onClick={handleLogout}>
                      Sair
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </nav>

        <main className="container-fluid page-content px-3 px-lg-4">
          <Outlet />
        </main>

        <footer className="footer">© 2026 SolarVision — Todos os direitos reservados.</footer>
        <MobileNav />
      </div>
    </div>
  );
}
