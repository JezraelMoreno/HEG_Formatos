import "./Sidebar.css";
import API_URL from "../config";
import { useAuth } from "../hooks/useAuth";

export type SidebarItem = {
  key: string;
  label: string;
  active: boolean;
  onClick: () => void;
};

export type ActiveProjectInfo = {
  nombre: string;
  iniciales: string;
};

interface SidebarProps {
  items: SidebarItem[];
  activeProject?: ActiveProjectInfo | null;
  onChangeProject?: () => void;
}

export function Sidebar({ items, activeProject, onChangeProject }: SidebarProps) {
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

      {activeProject && (
        <button type="button" className="sidebar-active-project" onClick={onChangeProject}>
          <span className="sidebar-active-project-label">Proyecto activo</span>
          <div className="sidebar-active-project-row">
            <span className="sidebar-active-project-ini">{activeProject.iniciales}</span>
            <span className="sidebar-active-project-name">{activeProject.nombre}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
          <span className="sidebar-active-project-change">Cambiar de proyecto</span>
        </button>
      )}

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
