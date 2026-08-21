import { useMemo } from "react";
import type { DetalleUnion } from "../types/pedidos";

export type PedidoTotales = {
  subtotalBase: number;
  descuentoMonto: number;
  subtotalConDescuento: number;
  ivaMonto: number;
  totalFinal: number;
  porcentajeDescuento: number;
};

export function usePedidoTotales(
  detalles: DetalleUnion[],
  porcentajeDescuentoRaw: number | null | undefined
): PedidoTotales {
  const porcentajeDescuento = useMemo(() => {
    let pct = Number(porcentajeDescuentoRaw ?? 0);
    if (!Number.isFinite(pct) || pct <= 0) return 0;
    if (pct > 0 && pct <= 1) pct = pct * 100;
    return pct;
  }, [porcentajeDescuentoRaw]);

  const subtotalBase = useMemo(
    () => detalles.reduce((sum, det) => sum + Number((det as { importe?: number }).importe || 0), 0),
    [detalles]
  );
  const descuentoMonto = useMemo(
    () => subtotalBase * (porcentajeDescuento / 100),
    [subtotalBase, porcentajeDescuento]
  );
  const subtotalConDescuento = useMemo(
    () => subtotalBase - descuentoMonto,
    [subtotalBase, descuentoMonto]
  );
  const ivaMonto = useMemo(() => subtotalConDescuento * 0.16, [subtotalConDescuento]);
  const totalFinal = useMemo(() => subtotalConDescuento + ivaMonto, [subtotalConDescuento, ivaMonto]);

  return { subtotalBase, descuentoMonto, subtotalConDescuento, ivaMonto, totalFinal, porcentajeDescuento };
}
