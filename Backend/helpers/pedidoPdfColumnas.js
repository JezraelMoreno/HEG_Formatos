// Espejo de Frontend/src/utils/pedidoDetalleColumns.ts (COLUMNAS_CRISTAL/ALUMINIO/MISCELANEOS).
// pdfkit corre en el backend y no puede importar ese archivo TS del frontend, así que las
// columnas por familia se replican aquí — mismos keys/labels/orden.

export const COLUMNAS_CRISTAL = [
  { key: "clave_modelo", label: "Clave/Modelo", align: "left" },
  { key: "ancho", label: "Ancho", align: "right" },
  { key: "largo", label: "Largo", align: "right" },
  { key: "m2_corte", label: "M² corte", align: "right" },
  { key: "piezas", label: "Piezas", align: "right" },
  { key: "m2_pedido", label: "M² pedido", align: "right" },
  { key: "precio_unitario", label: "P. unitario", align: "right", money: true },
  { key: "importe", label: "Importe", align: "right", money: true },
];

export const COLUMNAS_ALUMINIO = [
  { key: "numero_perfil", label: "N° perfil", align: "left" },
  { key: "medida_tramo", label: "Medida", align: "right" },
  { key: "unidad", label: "Unidad", align: "left" },
  { key: "peso_kg_ml", label: "Peso kg/ml", align: "right" },
  { key: "perimetro_m2_ml", label: "Perím m²/ml", align: "right" },
  { key: "acabado", label: "Acabado", align: "left" },
  { key: "total_tramos", label: "Tramos", align: "right" },
  { key: "ml", label: "M.L.", align: "right" },
  { key: "kg", label: "Kg", align: "right" },
  { key: "m2", label: "M²", align: "right" },
  { key: "importe", label: "Importe", align: "right", money: true },
];

export const COLUMNAS_MISCELANEOS = [
  { key: "unidad", label: "Unidad", align: "left" },
  { key: "medida", label: "Medida", align: "left" },
  { key: "cantidad", label: "Cantidad", align: "right" },
  { key: "precio_unitario", label: "P. unitario", align: "right", money: true },
  { key: "importe", label: "Importe", align: "right", money: true },
  { key: "clave", label: "Clave", align: "left" },
  { key: "ml", label: "M.L.", align: "right" },
  { key: "acabado", label: "Acabado", align: "left" },
  { key: "kg", label: "Kg", align: "right" },
  { key: "precio_x_kg", label: "Precio × Kg", align: "right", money: true },
];

export function columnasPdfPorFamilia(familia) {
  const f = String(familia || "").trim().toUpperCase();
  if (f === "CR") return COLUMNAS_CRISTAL;
  if (f === "AL" || f === "MQAL") return COLUMNAS_ALUMINIO;
  return COLUMNAS_MISCELANEOS;
}
