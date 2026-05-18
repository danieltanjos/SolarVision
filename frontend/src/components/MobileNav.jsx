import { NavLink } from "react-router-dom";

const items = [
  { to: "/app/home", label: "Home", icon: "bi-house-fill" },
  { to: "/app/limpeza", label: "Limpeza", icon: "bi-droplet-fill" },
  { to: "/app/monitoramento", label: "Monitor", icon: "bi-lightning-charge-fill" },
  { to: "/app/cadastro", label: "Cadastro", icon: "bi-grid-fill" },
  { to: "/app/configuracoes", label: "Config", icon: "bi-gear-fill" }
];

export default function MobileNav() {
  return (
    <div className="bottom-nav d-lg-none">
      <div className="navigation">
        <ul>
          {items.map((item) => (
            <li key={item.to} className="list">
              <NavLink to={item.to} className={({ isActive }) => (isActive ? "active" : "")}>
                <span className="icon"><i className={`bi ${item.icon}`} /></span>
                <span className="text">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
