import { apiFetch } from "../api/client";
import type { Proyecto } from "../context/ProjectContextTypes";

export function listarProyectos(): Promise<Proyecto[]> {
  return apiFetch<Proyecto[]>("/proyectos");
}
