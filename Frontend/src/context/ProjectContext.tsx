import { useCallback, useState } from "react";
import type { ReactNode } from "react";
import { recordRecentProject } from "../utils/recentProjects";
import { ProjectContext } from "./ProjectContextTypes";
import type { Proyecto } from "./ProjectContextTypes";

const STORAGE_KEY = "heg.proyectoActivo";

function readStoredProject(): Proyecto | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && typeof parsed.id_proyecto === "number") {
      return parsed as Proyecto;
    }
    return null;
  } catch {
    return null;
  }
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [proyectoActivo, setProyectoActivoState] = useState<Proyecto | null>(() => readStoredProject());

  const setProyectoActivo = useCallback((p: Proyecto) => {
    setProyectoActivoState(p);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    } catch {
      // almacenamiento no disponible — el proyecto sigue activo en memoria para esta sesión
    }
    recordRecentProject({ id_proyecto: p.id_proyecto, nombre: p.nombre });
  }, []);

  const limpiarProyecto = useCallback(() => {
    setProyectoActivoState(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignorar
    }
  }, []);

  return (
    <ProjectContext.Provider value={{ proyectoActivo, setProyectoActivo, limpiarProyecto }}>
      {children}
    </ProjectContext.Provider>
  );
}
