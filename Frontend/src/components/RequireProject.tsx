import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useActiveProject } from "../context/useActiveProject";

export function RequireProject({ children }: { children: ReactNode }) {
  const { proyectoActivo } = useActiveProject();
  if (!proyectoActivo) return <Navigate to="/proyectos" replace />;
  return <>{children}</>;
}
