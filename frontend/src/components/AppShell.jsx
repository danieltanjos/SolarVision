import { Link, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { applyTheme, getInitialTheme } from "../lib/theme";
import { titleCase } from "../lib/text";
import Alertas from "./Alertas";
import MobileNav from "./MobileNav";
import Sidebar from "./Sidebar";
import logo from "../../img/logo.png";

export default function AppShell() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  // O tema vive aqui: o botão do cabeçalho e a tela de Configurações (via contexto do Outlet) mexem no mesmo estado.
  const [isDark, setIsDark] = useState(getInitialTheme);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    () => window.localStorage.getItem("sv-sidebar-collapsed") === "true"
  );

  useEffect(() => {
    applyTheme(isDark);
  }, [isDark]);

  useEffect(() => {
    window.localStorage.setItem("sv-sidebar-collapsed", String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  const nome = user?.nome ? titleCase(user.nome) : "Usuário";
  const iniciais = nome.split(" ").map((parte) => parte[0]).slice(0, 2).join("");

  return (
    <div className={`sv-shell ${isSidebarCollapsed ? "is-collapsed" : ""}`}>
      <Sidebar
        logo={logo}
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed((current) => !current)}
      />

      <div className="sv-main">
        <header className="sv-header">
          <Link className="sv-header-brand d-lg-none" to="/app/home">
            <img src={logo} alt="" />
            SolarVision
          </Link>

          <div className="sv-header-actions">
            <Alertas />

            <button
              type="button"
              className="sv-icon-btn"
              onClick={() => setIsDark((current) => !current)}
              aria-label={isDark ? "Usar tema claro" : "Usar tema escuro"}
              title={isDark ? "Tema claro" : "Tema escuro"}
            >
              <i className={`bi ${isDark ? "bi-sun" : "bi-moon-stars"}`} />
            </button>

            <div className="dropdown">
              <button
                className="sv-user-button"
                data-bs-toggle="dropdown"
                type="button"
                aria-label="Menu do usuário"
              >
                <span className="sv-avatar">{iniciais}</span>
                <span className="d-none d-sm-inline">{nome}</span>
                <i className="bi bi-chevron-down small" />
              </button>
              <ul className="dropdown-menu dropdown-menu-end">
                <li className="dropdown-header">{user?.email}</li>
                <li>
                  <button className="dropdown-item" onClick={() => navigate("/app/configuracoes#perfil")}>
                    <i className="bi bi-person me-2" />
                    Meu perfil
                  </button>
                </li>
                <li><hr className="dropdown-divider" /></li>
                <li>
                  <button className="dropdown-item text-danger" onClick={handleLogout}>
                    <i className="bi bi-box-arrow-right me-2" />
                    Sair
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </header>

        <main className="sv-content">
          <Outlet context={{ isDark, setIsDark }} />
        </main>

        <footer className="sv-footer">
          © 2026 SolarVision · Dados meteorológicos:{" "}
          <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo.com</a> (CC BY 4.0)
        </footer>
      </div>

      <MobileNav />
    </div>
  );
}
