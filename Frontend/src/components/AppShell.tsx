import type { ReactNode } from "react";
import "./AppShell.css";
import { Sidebar } from "./Sidebar";
import type { ActiveProjectInfo, SidebarItem } from "./Sidebar";

interface AppShellProps {
  items: SidebarItem[];
  children: ReactNode;
  activeProject?: ActiveProjectInfo | null;
  onChangeProject?: () => void;
}

export function AppShell({ items, children, activeProject, onChangeProject }: AppShellProps) {
  return (
    <div className="app-shell">
      <Sidebar items={items} activeProject={activeProject} onChangeProject={onChangeProject} />
      <div className="app-shell-main">{children}</div>
    </div>
  );
}
