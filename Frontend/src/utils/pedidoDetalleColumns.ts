import type {
  DetalleUnion,
  PedidoDetalleAluminioItem,
  PedidoDetalleCristalItem,
  PedidoDetalleItem,
  TipoDetalle,
} from "../types/pedidos";

export type ColumnaDetalle = {
  key: string;
  label: string;
  align: "left" | "right";
  tipo: "text" | "number";
  /** Columna de importe calculada automáticamente: fondo gris, no editable. */
  auto?: boolean;
};

// Cristal: importe = m2_pedido * precio_unitario (confirmado con datos de ejemplo del mockup).
export const COLUMNAS_CRISTAL: ColumnaDetalle[] = [
  { key: "clave_modelo", label: "Clave / Modelo", align: "left", tipo: "text" },
  { key: "ancho", label: "Ancho", align: "right", tipo: "number" },
  { key: "largo", label: "Largo", align: "right", tipo: "number" },
  { key: "m2_corte", label: "M² corte", align: "right", tipo: "number" },
  { key: "piezas", label: "Piezas", align: "right", tipo: "number" },
  { key: "m2_pedido", label: "M² pedido", align: "right", tipo: "number" },
  { key: "precio_unitario", label: "P. unitario", align: "right", tipo: "number" },
  { key: "importe", label: "Importe", align: "right", tipo: "number", auto: true },
];

// Aluminio: el detalle no incluye ningún campo de precio unitario (ni en el mockup ni en la
// tabla `pedidos_detalles_aluminio`), así que no hay fórmula derivable — el importe se captura
// manualmente, igual que en la era CSV. No se marca `auto`.
export const COLUMNAS_ALUMINIO: ColumnaDetalle[] = [
  { key: "numero_perfil", label: "N° perfil", align: "left", tipo: "text" },
  { key: "medida_tramo", label: "Medida", align: "right", tipo: "number" },
  { key: "unidad", label: "Unidad", align: "left", tipo: "text" },
  { key: "peso_kg_ml", label: "Peso kg/ml", align: "right", tipo: "number" },
  { key: "perimetro_m2_ml", label: "Perím m²/ml", align: "right", tipo: "number" },
  { key: "acabado", label: "Acabado", align: "left", tipo: "text" },
  { key: "total_tramos", label: "Tramos", align: "right", tipo: "number" },
  { key: "ml", label: "M.L.", align: "right", tipo: "number" },
  { key: "kg", label: "Kg", align: "right", tipo: "number" },
  { key: "m2", label: "M²", align: "right", tipo: "number" },
  { key: "importe", label: "Importe", align: "right", tipo: "number" },
];

// Misceláneos: importe = cantidad * precio_unitario (confirmado con datos de ejemplo del mockup).
export const COLUMNAS_MISCELANEOS: ColumnaDetalle[] = [
  { key: "unidad", label: "Unidad", align: "left", tipo: "text" },
  { key: "medida", label: "Medida", align: "left", tipo: "text" },
  { key: "cantidad", label: "Cantidad", align: "right", tipo: "number" },
  { key: "precio_unitario", label: "P. unitario", align: "right", tipo: "number" },
  { key: "importe", label: "Importe", align: "right", tipo: "number", auto: true },
  { key: "clave", label: "Clave", align: "left", tipo: "text" },
  { key: "ml", label: "M.L.", align: "right", tipo: "number" },
  { key: "acabado", label: "Acabado", align: "left", tipo: "text" },
  { key: "kg", label: "Kg", align: "right", tipo: "number" },
  { key: "precio_x_kg", label: "Precio × Kg", align: "right", tipo: "number" },
];

export function columnasPorTipo(tipo: TipoDetalle): ColumnaDetalle[] {
  if (tipo === "cristal") return COLUMNAS_CRISTAL;
  if (tipo === "aluminio") return COLUMNAS_ALUMINIO;
  return COLUMNAS_MISCELANEOS;
}

export function filaVaciaCristal(idTemp: number): PedidoDetalleCristalItem {
  return {
    id_detalle: idTemp,
    descripcion: "",
    clave_modelo: "",
    ancho: null,
    largo: null,
    m2_corte: null,
    piezas: 0,
    m2_pedido: null,
    precio_unitario: 0,
    importe: 0,
  };
}

export function filaVaciaAluminio(idTemp: number): PedidoDetalleAluminioItem {
  return {
    id_detalle: idTemp,
    descripcion: "",
    numero_perfil: "",
    medida_tramo: null,
    unidad: "",
    peso_kg_ml: null,
    perimetro_m2_ml: null,
    acabado: "",
    total_tramos: null,
    ml: null,
    kg: null,
    m2: null,
    importe: 0,
  };
}

export function filaVaciaMiscelaneos(idTemp: number): PedidoDetalleItem {
  return {
    id_detalle: idTemp,
    descripcion: "",
    unidad: "",
    medida: "",
    cantidad: 0,
    precio_unitario: 0,
    importe: 0,
    clave: "",
    ml: null,
    acabado: "",
    kg: null,
    precio_x_kg: null,
  };
}

export function filaVaciaPorTipo(tipo: TipoDetalle, idTemp: number): DetalleUnion {
  if (tipo === "cristal") return filaVaciaCristal(idTemp);
  if (tipo === "aluminio") return filaVaciaAluminio(idTemp);
  return filaVaciaMiscelaneos(idTemp);
}

export function calcularImporteCristal(fila: PedidoDetalleCristalItem): number {
  const m2 = Number(fila.m2_pedido || 0);
  const precio = Number(fila.precio_unitario || 0);
  return Number((m2 * precio).toFixed(2));
}

export function calcularImporteMisc(fila: PedidoDetalleItem): number {
  const cantidad = Number(fila.cantidad || 0);
  const precio = Number(fila.precio_unitario || 0);
  return Number((cantidad * precio).toFixed(2));
}

/** Recalcula el importe auto-calculado de una fila según el tipo de detalle (aluminio no aplica). */
export function recalcularImporte(tipo: TipoDetalle, fila: DetalleUnion): number {
  if (tipo === "cristal") return calcularImporteCristal(fila as PedidoDetalleCristalItem);
  if (tipo === "miscelaneos") return calcularImporteMisc(fila as PedidoDetalleItem);
  return Number((fila as PedidoDetalleAluminioItem).importe || 0);
}
