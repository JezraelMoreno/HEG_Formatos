import { useContext } from "react";
import { ProjectContext } from "./ProjectContextTypes";
import type { ProjectContextValue } from "./ProjectContextTypes";

export function useActiveProject(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useActiveProject debe usarse dentro de <ProjectProvider>");
  return ctx;
}
