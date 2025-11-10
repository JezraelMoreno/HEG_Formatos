export type PedidoCsv = {
  nombre_proyecto: string;
  pedido: string;
  clan: string;
  familia: string;
  proveedor: string;
  fecha_aprobacion: string;
  concepto: string;
  situaciones_especiales?: string;
  importe: number;
};

const normalizeDate = (valor: string) => {
  const v = String(valor || "").trim();
  const m = v.match(/^([0-9]{1,2})[\/\-]([0-9]{1,2})[\/\-]([0-9]{4})$/);
  if (m) {
    const dd = m[1].padStart(2, "0");
    const mm = m[2].padStart(2, "0");
    const yyyy = m[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  return v;
};

export function parsePedidosCsv(text: string, defaultProjectName = ""): PedidoCsv[] {
  const rows = text
    .split(/\r?\n/)
    .map((r) => r.trim())
    .filter((r) => r.length > 0);
  if (rows.length < 2) return [];
  const headers = rows[0].split(",").map((h) => h.trim().toUpperCase());
  const idx = (n: string) => headers.indexOf(n);
  const iProyecto = idx("PROYECTO");
  const iPedido = idx("PEDIDO");
  const iClan = idx("CLAN");
  const iFamilia = idx("FAMILIA");
  const iProveedor = idx("PROVEEDOR");
  const iFecha = idx("FECHA DE APROBACION");
  const iConcepto = idx("CONCEPTO");
  const iSitEsp = (() => {
    const i1 = headers.indexOf("SITUACIONES ESPECIALES");
    return i1 >= 0 ? i1 : headers.indexOf("SITUACIONES ESPECIALES ");
  })();
  const iImporte = idx("IMPORTE");
  const out: PedidoCsv[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r].split(",");
    if (cols.length < 5) continue;
    out.push({
      nombre_proyecto: (cols[iProyecto] || defaultProjectName || "").trim(),
      pedido: (cols[iPedido] || "").trim(),
      clan: (cols[iClan] || "").trim(),
      familia: (cols[iFamilia] || "").trim(),
      proveedor: (cols[iProveedor] || "").trim(),
      fecha_aprobacion: normalizeDate(cols[iFecha] || ""),
      concepto: (cols[iConcepto] || "").trim(),
      situaciones_especiales: (cols[iSitEsp] || "").trim(),
      importe: Number((cols[iImporte] || "0").toString().replace(/\s/g, "")),
    });
  }
  return out;
}
