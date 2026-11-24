import { NavLink } from "react-router-dom";
import { NAV_ADMIN, NAV_ITEMS, linkDoMenu } from "./Sidebar";

export default function MobileNav({ isAdmin = false }) {
  return (
    <nav className="sv-bottom-nav d-lg-none" aria-label="Menu principal">
      {(isAdmin ? [...NAV_ITEMS, NAV_ADMIN] : NAV_ITEMS).map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          data-link-id={linkDoMenu(item)}
          data-heat={item.admin ? undefined : `nav-${item.to.split("/").pop()}`}
          className={({ isActive }) => (isActive ? "active" : "")}
        >
          <i className={`bi ${item.icon}`} />
          <span>{item.short}</span>
        </NavLink>
      ))}
    </nav>
  );
}
