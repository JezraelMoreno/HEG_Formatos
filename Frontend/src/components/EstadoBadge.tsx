import type { EstadoPedido } from "../types/pedidos";
import "./EstadoBadge.css";

const LABELS: Record<EstadoPedido, string> = {
  levantado: "Levantado",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
};

export function EstadoBadge({ estado }: { estado: EstadoPedido }) {
  return (
    <span className={`hf-estado-badge hf-estado-${estado}`}>
      <span className="hf-estado-dot" />
      {LABELS[estado] || estado}
    </span>
  );
}
