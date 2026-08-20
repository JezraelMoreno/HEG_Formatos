import type { ReactNode } from "react";
import "./AppShell.css";
import { Sidebar } from "./Sidebar";
import type { SidebarItem } from "./Sidebar";

interface AppShellProps {
  items: SidebarItem[];
  children: ReactNode;
}

export function AppShell({ items, children }: AppShellProps) {
  return (
    <div className="app-shell">
      <Sidebar items={items} />
      <div className="app-shell-main">{children}</div>
    </div>
  );
}
