import { createContext } from "react";

export type Proyecto = {
  id_proyecto: number;
  nombre: string;
  fecha_proyecto: string;
  estado: "en_progreso" | "completado";
  presupuesto_cristal: number;
  presupuesto_aluminio: number;
  presupuesto_miscelaneos: number;
  presupuesto_total: number;
  presupuesto: number;
  total_pedidos: number;
  presupuesto_disponible: number;
};

export type ProjectContextValue = {
  proyectoActivo: Proyecto | null;
  setProyectoActivo: (p: Proyecto) => void;
  limpiarProyecto: () => void;
};

export const ProjectContext = createContext<ProjectContextValue | null>(null);
