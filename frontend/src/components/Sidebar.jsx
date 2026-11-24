import { Link, NavLink } from "react-router-dom";

export const NAV_ITEMS = [
  { to: "/app/home", label: "Início", short: "Início", icon: "bi-house" },
  { to: "/app/monitoramento", label: "Monitoramento", short: "Monitor", icon: "bi-graph-up" },
  { to: "/app/relatorio", label: "Relatório", short: "Relatório", icon: "bi-file-earmark-text" },
  { to: "/app/limpeza", label: "Limpeza", short: "Limpeza", icon: "bi-droplet" },
  { to: "/app/cadastro", label: "Cadastro", short: "Cadastro", icon: "bi-grid-3x2" },
  { to: "/app/configuracoes", label: "Configurações", short: "Config", icon: "bi-gear" }
];

// Só para ADMIN: o BI do datalake de uso. Não é rastreado (o painel do ADMIN não é uso do produto).
export const NAV_ADMIN = { to: "/app/uso", label: "Uso da plataforma", short: "Uso", icon: "bi-bar-chart-line", admin: true };

// link_id do clique num item do menu (o element_id vem do data-heat); o item do ADMIN não é rastreado.
export function linkDoMenu(item) {
  return item.admin ? undefined : `nav_${item.to.split("/").pop()}`;
}

export default function Sidebar({ logo, isCollapsed, onToggle, isAdmin = false }) {
  return (
    <aside className="sv-sidebar d-none d-lg-flex">
      <Link to="/app/home" className="sv-brand">
        <img src={logo} alt="" />
        <span className="sv-nav-label">SolarVision</span>
      </Link>

      <nav className="sv-sidebar-nav" aria-label="Menu principal">
        {(isAdmin ? [...NAV_ITEMS, NAV_ADMIN] : NAV_ITEMS).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            data-link-id={linkDoMenu(item)}
            data-heat={item.admin ? undefined : `nav-${item.to.split("/").pop()}`}
            title={isCollapsed ? item.label : undefined}
            className={({ isActive }) => `sv-nav-item ${isActive ? "active" : ""}`}
          >
            <i className={`bi ${item.icon}`} />
            <span className="sv-nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <button
        type="button"
        className="sv-nav-item sv-sidebar-toggle"
        onClick={onToggle}
        aria-label={isCollapsed ? "Abrir menu lateral" : "Fechar menu lateral"}
        aria-expanded={!isCollapsed}
      >
        <i className={`bi ${isCollapsed ? "bi-chevron-double-right" : "bi-chevron-double-left"}`} />
        <span className="sv-nav-label">Recolher</span>
      </button>
    </aside>
  );
}
