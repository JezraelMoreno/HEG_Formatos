import type { ReactNode } from "react";
import "./Topbar.css";

interface TopbarProps {
  title: string;
  onBack?: () => void;
  children?: ReactNode;
}

export function Topbar({ title, onBack, children }: TopbarProps) {
  return (
    <div className="topbar">
      {onBack && (
        <button type="button" className="topbar-back" onClick={onBack} aria-label="Regresar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
      )}
      <h1 className="topbar-title">{title}</h1>
      <div className="topbar-actions">{children}</div>
    </div>
  );
}
