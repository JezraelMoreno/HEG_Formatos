const STORAGE_KEY = "heg.proyectosRecientes";
const MAX_ENTRIES = 5;

export type RecentProjectEntry = {
  id_proyecto: number;
  nombre: string;
  ts: number;
};

export function getRecentProjects(): RecentProjectEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (e): e is RecentProjectEntry =>
          e && typeof e.id_proyecto === "number" && typeof e.nombre === "string" && typeof e.ts === "number"
      )
      .sort((a, b) => b.ts - a.ts);
  } catch {
    return [];
  }
}

export function recordRecentProject(p: { id_proyecto: number; nombre: string }): void {
  try {
    const existing = getRecentProjects().filter((e) => e.id_proyecto !== p.id_proyecto);
    const next = [{ id_proyecto: p.id_proyecto, nombre: p.nombre, ts: Date.now() }, ...existing].slice(0, MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage no disponible (modo privado, etc.) — no es crítico, se ignora
  }
}
