import { NavLink } from "react-router-dom";

const items = [
  { to: "/app/home", label: "Home", icon: "bi-house-fill" },
  { to: "/app/limpeza", label: "Limpeza", icon: "bi-droplet-fill" },
  { to: "/app/monitoramento", label: "Monitoramento", icon: "bi-lightning-charge-fill" },
  { to: "/app/cadastro", label: "Cadastro", icon: "bi-grid-fill" },
  { to: "/app/configuracoes", label: "Configurações", icon: "bi-gear-fill" }
];

export default function Sidebar({ isCollapsed, onToggle }) {
  return (
    <aside className={`sv-sidebar d-none d-lg-flex ${isCollapsed ? "is-collapsed" : ""}`}>
      <div className="sv-sidebar-frame">
        <button
          type="button"
          className="sv-sidebar-handle"
          onClick={onToggle}
          aria-label={isCollapsed ? "Abrir menu lateral" : "Fechar menu lateral"}
          aria-expanded={!isCollapsed}
        >
          <i className="bi bi-list" />
        </button>

        <nav className="sv-sidebar-nav" aria-label="Menu principal">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              title={isCollapsed ? item.label : undefined}
              className={({ isActive }) => `sv-nav-item ${isActive ? "active" : ""}`}
            >
              <span className="sv-nav-icon">
                <i className={`bi ${item.icon}`} />
              </span>
              <span className="sv-nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </aside>
  );
}
