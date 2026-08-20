import "./Sidebar.css";
import API_URL from "../config";
import { useAuth } from "../hooks/useAuth";

export type SidebarItem = {
  key: string;
  label: string;
  active: boolean;
  onClick: () => void;
};

interface SidebarProps {
  items: SidebarItem[];
}

export function Sidebar({ items }: SidebarProps) {
  const { username, role } = useAuth();
  const inicial = (username || "?").trim().charAt(0).toUpperCase();
  const rolLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : "";

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-logo">
          <img src={`${API_URL}/assets/heg_logo.jpg`} alt="HEG" />
        </span>
        <span className="sidebar-brand-name">HEG Formatos</span>
      </div>

      <nav className="sidebar-nav">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`sidebar-nav-item${item.active ? " active" : ""}`}
            onClick={item.onClick}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="sidebar-user">
        <span className="sidebar-user-avatar">{inicial}</span>
        <div className="sidebar-user-info">
          <span className="sidebar-user-name">{username || "Usuario"}</span>
          <span className="sidebar-user-role">{rolLabel}</span>
        </div>
      </div>
    </aside>
  );
}
