import { NavLink } from "react-router-dom";
import { NAV_ITEMS } from "./Sidebar";

export default function MobileNav() {
  return (
    <nav className="sv-bottom-nav d-lg-none" aria-label="Menu principal">
      {NAV_ITEMS.map((item) => (
        <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? "active" : "")}>
          <i className={`bi ${item.icon}`} />
          <span>{item.short}</span>
        </NavLink>
      ))}
    </nav>
  );
}
