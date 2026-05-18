import { NavLink } from "react-router-dom";

const items = [
  { to: "/app/home", label: "Home", icon: "bi-house-fill" },
  { to: "/app/limpeza", label: "Limpeza", icon: "bi-droplet-fill" },
  { to: "/app/monitoramento", label: "Monitoramento", icon: "bi-lightning-charge-fill" },
  { to: "/app/cadastro", label: "Cadastro", icon: "bi-grid-fill" },
  { to: "/app/configuracoes", label: "Config", icon: "bi-gear-fill" }
];

export default function Sidebar() {
  return (
    <aside className="sv-sidebar d-none d-lg-flex">
      <div className="sv-sidebar-inner">
        <div className="sv-sidebar-header">
          <span className="sv-sidebar-eyebrow">Microsserviços + React</span>
          <h1>SolarVision</h1>
          <p>Painel operacional para grupos, placas, limpezas e geração.</p>
        </div>

        <nav className="sv-sidebar-nav">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `sv-nav-item ${isActive ? "active" : ""}`}
            >
              <i className={`bi ${item.icon}`} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </aside>
  );
}
