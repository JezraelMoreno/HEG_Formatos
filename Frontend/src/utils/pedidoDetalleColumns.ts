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

// Aluminio: ml/kg/m2/importe se auto-calculan cuando el pedido tiene precio_aluminio_kg
// configurado (ver ContextoAluminio/calcularCamposAluminio abajo). Si el pedido NO tiene
// precio configurado (pedidos históricos, modo manual heredado), se usa la variante sin
// `auto` para que esas celdas sigan siendo editables a mano — columnasPorTipo() elige entre
// las dos según el contexto de aluminio recibido.
const COLUMNAS_ALUMINIO_BASE: Omit<ColumnaDetalle, "auto">[] = [
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

const CAMPOS_AUTO_ALUMINIO = new Set(["ml", "kg", "m2", "importe"]);

export const COLUMNAS_ALUMINIO_MANUAL: ColumnaDetalle[] = COLUMNAS_ALUMINIO_BASE.map((c) => ({ ...c }));

export const COLUMNAS_ALUMINIO: ColumnaDetalle[] = COLUMNAS_ALUMINIO_BASE.map((c) => ({
  ...c,
  auto: CAMPOS_AUTO_ALUMINIO.has(c.key) || undefined,
}));

// Misceláneos: importe = cantidad * precio_unitario (confirmado con datos de ejemplo del mockup).
export const COLUMNAS_MISCELANEOS: ColumnaDetalle[] = [
  { key: "unidad", label: "Unidad", align: "left", tipo: "text" },
  { key: "medida", label: "Medida", align: "left", tipo: "text" },
  { key: "concepto_detalle", label: "Concepto", align: "left", tipo: "text" },
  { key: "cantidad", label: "Cantidad", align: "right", tipo: "number" },
  { key: "precio_unitario", label: "P. unitario", align: "right", tipo: "number" },
  { key: "importe", label: "Importe", align: "right", tipo: "number", auto: true },
  { key: "clave", label: "Clave", align: "left", tipo: "text" },
  { key: "ml", label: "M.L.", align: "right", tipo: "number" },
  { key: "acabado", label: "Acabado", align: "left", tipo: "text" },
  { key: "kg", label: "Kg", align: "right", tipo: "number" },
  { key: "precio_x_kg", label: "Precio × Kg", align: "right", tipo: "number" },
];

export type ContextoAluminio = {
  monedaAluminio: "USD" | "MXN";
  tipoCambio: number;
  precioAluminioKg: number | null;
  precioPinturaM2: number | null;
};

function tienePrecioConfigurado(contexto?: ContextoAluminio): boolean {
  return contexto?.precioAluminioKg !== null && contexto?.precioAluminioKg !== undefined;
}

export function columnasPorTipo(tipo: TipoDetalle, contextoAluminio?: ContextoAluminio): ColumnaDetalle[] {
  if (tipo === "cristal") return COLUMNAS_CRISTAL;
  if (tipo === "aluminio") {
    return tienePrecioConfigurado(contextoAluminio) ? COLUMNAS_ALUMINIO : COLUMNAS_ALUMINIO_MANUAL;
  }
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
    concepto_detalle: "",
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

function redondear(value: number, decimales: number): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimales;
  return Math.round(value * factor) / factor;
}

// Misma fórmula que Backend/helpers/utils.js calcularCamposAluminio — mantener ambas en
// sincronía. Si el pedido no tiene precio_aluminio_kg configurado (modo manual heredado), no
// se toca nada y se respetan los valores que el usuario haya escrito a mano.
export function calcularCamposAluminio(
  fila: PedidoDetalleAluminioItem,
  contexto?: ContextoAluminio
): Partial<PedidoDetalleAluminioItem> {
  if (!tienePrecioConfigurado(contexto)) return {};
  const precioAluminioKg = Number(contexto!.precioAluminioKg);

  const medidaTramo = Number(fila.medida_tramo || 0);
  const totalTramos = Math.max(0, Math.round(Number(fila.total_tramos || 0)));
  const pesoKgMl = Number(fila.peso_kg_ml || 0);
  const perimetroM2Ml = Number(fila.perimetro_m2_ml || 0);

  const ml = redondear(medidaTramo * totalTramos, 3);
  const kg = redondear(ml * pesoKgMl, 3);
  const m2 = redondear(ml * perimetroM2Ml, 3);

  const precioPinturaM2 = Number(contexto!.precioPinturaM2 || 0);
  const tipoCambio = contexto!.monedaAluminio === "USD" && contexto!.tipoCambio > 0 ? contexto!.tipoCambio : 1;
  const importe = redondear((kg * precioAluminioKg + m2 * precioPinturaM2) * tipoCambio, 2);

  return { ml, kg, m2, importe };
}

/** Recalcula los campos auto-calculados de una fila según el tipo de detalle. */
export function recalcularCamposAuto(
  tipo: TipoDetalle,
  fila: DetalleUnion,
  contextoAluminio?: ContextoAluminio
): Partial<DetalleUnion> {
  if (tipo === "cristal") return { importe: calcularImporteCristal(fila as PedidoDetalleCristalItem) };
  if (tipo === "miscelaneos") return { importe: calcularImporteMisc(fila as PedidoDetalleItem) };
  return calcularCamposAluminio(fila as PedidoDetalleAluminioItem, contextoAluminio);
}
