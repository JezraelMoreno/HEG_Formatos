import type { Proyecto } from "../context/ProjectContextTypes";

export type EstadoDerivado = "en_progreso" | "por_iniciar" | "sobregirado" | "cerrado";

export const ESTADO_LABELS: Record<EstadoDerivado, string> = {
  en_progreso: "En progreso",
  por_iniciar: "Por iniciar",
  sobregirado: "Sobregirado",
  cerrado: "Cerrado",
};

// El mockup pide 4 variantes de badge (En progreso/Por iniciar/Sobregirado/Cerrado) con colores
// propios (p.ej. #fef3c7), pero esos tonos no existen como variable en global.css. Se reutilizan
// los tokens más cercanos ya definidos para no inventar paleta nueva.
export const ESTADO_BADGE_VARS: Record<EstadoDerivado, { bg: string; text: string }> = {
  en_progreso: { bg: "var(--color-info-bg)", text: "var(--color-info-text)" },
  por_iniciar: { bg: "var(--color-warning-bg)", text: "var(--color-warning)" },
  sobregirado: { bg: "var(--color-danger-bg)", text: "var(--color-danger)" },
  cerrado: { bg: "var(--color-border-light)", text: "var(--color-text-muted)" },
};

// El backend devuelve las columnas numéricas (DECIMAL/SUM) como string en JSON — se coerciona
// explícitamente porque comparar strings con `>` hace comparación lexicográfica, no numérica
// ("32928.00" > "1000000.00" sería `true`).
function toFiniteNumber(value: unknown): number {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

export function deriveEstado(p: Pick<Proyecto, "estado" | "total_pedidos" | "presupuesto_total">): EstadoDerivado {
  if (p.estado === "completado") return "cerrado";
  const asignado = toFiniteNumber(p.presupuesto_total);
  const gastado = toFiniteNumber(p.total_pedidos);
  if (asignado > 0 && gastado > asignado) return "sobregirado";
  if (gastado === 0) return "por_iniciar";
  return "en_progreso";
}

export function deriveIniciales(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return "--";
  if (palabras.length === 1) return palabras[0].slice(0, 2).toUpperCase();
  return (palabras[0][0] + palabras[1][0]).toUpperCase();
}

export function calcularPresupuesto(p: Pick<Proyecto, "presupuesto_total" | "total_pedidos">) {
  const asignado = toFiniteNumber(p.presupuesto_total);
  const gastado = toFiniteNumber(p.total_pedidos);
  const disponible = asignado - gastado;
  const pctEjercido = asignado > 0 ? Math.round((gastado / asignado) * 100) : 0;
  return { asignado, gastado, disponible, pctEjercido, sobregirado: asignado > 0 && gastado > asignado };
}

export function formatearFecha(fecha: string): string {
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return fecha;
  return d.toLocaleDateString("es-MX", { year: "numeric", month: "short", day: "numeric" });
}

export function formatCurrency(value: number | null | undefined): string {
  const num = Number(value ?? 0);
  const safe = Number.isFinite(num) ? num : 0;
  return `$${safe.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Ciclo determinístico de colores para el tile de iniciales — el mockup les da color por
// tarjeta sin que dependa de ningún dato real, así que se deriva del id en vez de inventar
// un campo o dejarlo siempre igual.
const TILE_PALETTE = [
  { tint: "var(--color-primary-light)", accent: "var(--color-primary)" },
  { tint: "var(--color-accent-light)", accent: "var(--color-accent)" },
  { tint: "var(--color-warning-bg)", accent: "var(--color-warning)" },
  { tint: "var(--color-success-bg)", accent: "var(--color-success)" },
];

export function tileColorsFor(id: number): { tint: string; accent: string } {
  return TILE_PALETTE[Math.abs(id) % TILE_PALETTE.length];
}
