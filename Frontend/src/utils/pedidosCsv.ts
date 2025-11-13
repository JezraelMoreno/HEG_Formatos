export type PedidoDetalleCsv = {
  descripcion: string;
  unidad?: string;
  medida?: string;
  cantidad?: number;
  precio_unitario?: number;
  importe?: number;
  clave?: string;
  ml?: number | null;
  acabado?: string;
  kg?: number | null;
  precio_x_kg?: number | null;
};

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
  detalles: PedidoDetalleCsv[];
};

const normalizeDate = (valor: string) => {
  const v = String(valor || "").trim();
  if (!v) return v;
  const m = v.match(/^([0-9]{1,2})[\/\-]([0-9]{1,2})[\/\-]([0-9]{4})$/);
  if (m) {
    const dd = m[1].padStart(2, "0");
    const mm = m[2].padStart(2, "0");
    const yyyy = m[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  return v;
};

const stripBom = (value: string) => value.replace(/\ufeff/g, "");

const normalizeKey = (value: string) => stripBom(value)
  .replace(/[:]/g, "")
  .replace(/\s+/g, " ")
  .replace(/[.]/g, "")
  .trim()
  .toUpperCase();

const cleanText = (value: string | undefined | null) => {
  const v = (value ?? "").replace(/\s+/g, " ").trim();
  return v;
};

const cleanNumber = (value: string | undefined | null): number | null => {
  if (value === undefined || value === null) return null;
  const trimmed = stripBom(value).replace(/\s+/g, "").replace(/\u00a0/g, "").replace(/\$/g, "");
  if (!trimmed) return null;
  const sanitized = trimmed.replace(/[^0-9,.\-]/g, "");
  if (!sanitized || sanitized === "-" || sanitized === "--") return null;
  const hasComma = sanitized.includes(",");
  const hasDot = sanitized.includes(".");
  let prepared = sanitized;
  if (hasComma && hasDot) {
    prepared = prepared.replace(/,/g, "");
  } else if (hasComma && !hasDot) {
    const lastComma = prepared.lastIndexOf(",");
    prepared = prepared
      .split("")
      .map((ch, idx) => (ch === "," ? (idx === lastComma ? "." : "") : ch))
      .join("");
  }
  const num = Number(prepared);
  return Number.isNaN(num) ? null : num;
};

const toNumberValue = (
  value: string | undefined | null,
  { integer = false }: { integer?: boolean } = {},
): number | null => {
  const num = cleanNumber(value);
  if (num === null) return null;
  if (!Number.isFinite(num)) return null;
  return integer ? Math.round(num) : num;
};

const parseCsvGrid = (text: string): string[][] => {
  const rows: string[][] = [];
  let currentField = "";
  let inQuotes = false;
  let row: string[] = [];
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === "\"") {
      if (inQuotes && text[i + 1] === "\"") {
        currentField += "\"";
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(currentField);
      currentField = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && text[i + 1] === "\n") {
        i++;
      }
      row.push(currentField);
      rows.push(row);
      row = [];
      currentField = "";
    } else {
      currentField += char;
    }
  }
  row.push(currentField);
  rows.push(row);
  return rows.map((r) => r.map(stripBom));
};

const DETAIL_SUMMARY_TOKENS = new Set([
  "IMPORTE",
  "DESCUENTO",
  "SUBTOTAL",
  "IVA",
  "TOTAL",
  "PAGOS INMEDIATOS",
  "APROBADO",
  "FECHA DE APROBACION",
]);

const isDetailHeader = (row: string[]) => {
  if (!row.length) return false;
  const normalized = row.map(normalizeKey);
  return (
    normalized.includes("NO")
    && normalized.includes("DESCRIPCION")
    && normalized.includes("CANTIDAD")
    && normalized.includes("IMPORTE")
  );
};

const parseDetailBlock = (rows: string[][], headerIndex: number) => {
  const headerRow = rows[headerIndex] || [];
  const headerKeys = headerRow.map(normalizeKey);
  const idx = (aliases: string[]) => headerKeys.findIndex((key) => aliases.includes(key));
  const idxDescripcion = idx(["DESCRIPCION"]);
  const idxUnidad = idx(["UNIDAD"]);
  const idxMedida = idx(["MEDIDA"]);
  const idxCantidad = idx(["CANTIDAD"]);
  const idxPrecioUnitario = idx(["P UNITARIO", "PUN", "PRECIO UNITARIO", "PUNITARIO"]);
  const idxImporte = idx(["IMPORTE"]);
  const idxClave = idx(["CLAVE"]);
  const idxML = idx(["ML", "M L"]);
  const idxAcabado = idx(["ACABADO"]);
  const idxKg = idx(["KG"]);
  const idxPrecioKg = idx(["PRECIOXKG", "PRECIO X KG", "PRECIOXK G", "PRECIO POR KG", "PRECIOKG"]);

  if (idxDescripcion < 0 || idxCantidad < 0 || idxPrecioUnitario < 0 || idxImporte < 0) {
    return { detalles: [] as PedidoDetalleCsv[], nextIndex: headerIndex + 1 };
  }

  const detalles: PedidoDetalleCsv[] = [];
  let i = headerIndex + 1;
  let blankRows = 0;
  while (i < rows.length) {
    const row = rows[i] || [];
    const normalizedRow = row.map((cell) => (cell || "").trim());
    const keyRow = row.map(normalizeKey);
    const isSummaryRow = keyRow.some((token) => DETAIL_SUMMARY_TOKENS.has(token));
    if (isSummaryRow) break;
    const emptyRow = normalizedRow.every((cell) => cell === "");
    if (emptyRow) {
      blankRows += 1;
      if (detalles.length && blankRows >= 1) break;
      i += 1;
      continue;
    }
    blankRows = 0;

    const descripcion = cleanText(row[idxDescripcion]);
    const cantidad = toNumberValue(row[idxCantidad], { integer: true });
    const precioUnitario = toNumberValue(row[idxPrecioUnitario]);
    const importe = toNumberValue(row[idxImporte]);
    const clave = cleanText(row[idxClave]);
    const unidad = cleanText(row[idxUnidad]);
    const medida = cleanText(row[idxMedida]);
    const ml = toNumberValue(row[idxML]);
    const acabado = cleanText(row[idxAcabado]);
    const kg = toNumberValue(row[idxKg]);
    const precioKg = toNumberValue(row[idxPrecioKg]);

    if (!descripcion && importe === null && cantidad === null) {
      i += 1;
      continue;
    }

    detalles.push({
      descripcion: descripcion || `Detalle ${detalles.length + 1}`,
      unidad: unidad || undefined,
      medida: medida || undefined,
      cantidad: cantidad !== null ? cantidad : undefined,
      precio_unitario: precioUnitario ?? undefined,
      importe: importe ?? undefined,
      clave: clave || undefined,
      ml: ml ?? null,
      acabado: acabado || undefined,
      kg: kg ?? null,
      precio_x_kg: precioKg ?? null,
    });
    i += 1;
  }
  return { detalles, nextIndex: i };
};

type DetailSection = {
  pedidoRef?: string;
  detalles: PedidoDetalleCsv[];
};

const extractDetailSections = (rows: string[][]): DetailSection[] => {
  const sections: DetailSection[] = [];
  let lastPedidoLabel: string | undefined;
  let i = 0;
  while (i < rows.length) {
    const row = rows[i] || [];
    const normalized = row.map(normalizeKey);
    const pedidoIdx = normalized.findIndex((value) => value === "PEDIDO");
    if (pedidoIdx !== -1) {
      const value = cleanText(row[pedidoIdx + 1]);
      if (value) lastPedidoLabel = value;
    }
    if (isDetailHeader(row)) {
      const { detalles, nextIndex } = parseDetailBlock(rows, i);
      if (detalles.length) {
        sections.push({ pedidoRef: lastPedidoLabel, detalles });
      }
      i = nextIndex;
      continue;
    }
    i += 1;
  }
  return sections;
};

export function parsePedidosCsv(text: string, defaultProjectName = ""): PedidoCsv[] {
  const rows = parseCsvGrid(text).filter((r) => r && r.length);
  if (!rows.length) return [];

  const headerIndex = rows.findIndex((row) =>
    row.some((cell) => normalizeKey(cell) === "PROYECTO"));
  if (headerIndex === -1) return [];

  const headers = rows[headerIndex].map(normalizeKey);
  const idx = (aliases: string[]) => headers.findIndex((key) => aliases.includes(key));
  const iProyecto = idx(["PROYECTO"]);
  const iPedido = idx(["PEDIDO"]);
  const iClan = idx(["CLAN"]);
  const iFamilia = idx(["FAMILIA"]);
  const iProveedor = idx(["PROVEEDOR"]);
  const iFecha = idx(["FECHA DE APROBACION", "FECHA APROBACION"]);
  const iConcepto = idx(["CONCEPTO"]);
  const iSitEsp = (() => {
    const idx1 = headers.findIndex((key) => key.startsWith("SITUACIONES"));
    return idx1;
  })();
  const iImporte = idx(["IMPORTE"]);

  if ([iProyecto, iPedido, iClan, iFamilia, iProveedor, iFecha, iConcepto, iImporte].some((v) => v < 0)) {
    return [];
  }

  const detailSections = extractDetailSections(rows);
  const stopIndex = rows.findIndex((row, idx) => idx > headerIndex && isDetailHeader(row));
  const dataEnd = stopIndex === -1 ? rows.length : stopIndex;

  const pedidos: PedidoCsv[] = [];
  for (let r = headerIndex + 1; r < dataEnd; r += 1) {
    const cols = rows[r] || [];
    const nombreProyectoRaw = cleanText(cols[iProyecto]);
    const pedidoRaw = cleanText(cols[iPedido]);
    if (!pedidoRaw || pedidoRaw.endsWith(":")) continue;
    const nombreProyecto = nombreProyectoRaw || defaultProjectName || "";
    const pedido = pedidoRaw;
    const clan = cleanText(cols[iClan]);
    const familia = cleanText(cols[iFamilia]);
    const proveedor = cleanText(cols[iProveedor]);
    const fecha_aprobacion = normalizeDate(cols[iFecha] || "");
    const concepto = cleanText(cols[iConcepto]);
    const situaciones_especiales = iSitEsp >= 0 ? cleanText(cols[iSitEsp]) : "";
    const importeNum = cleanNumber(cols[iImporte]);

    pedidos.push({
      nombre_proyecto: nombreProyecto,
      pedido,
      clan,
      familia,
      proveedor,
      fecha_aprobacion,
      concepto,
      situaciones_especiales: situaciones_especiales || undefined,
      importe: importeNum ?? 0,
      detalles: [],
    });
  }

  const normalizePedidoValue = (value: string | undefined | null) => (value ?? "").trim().toUpperCase();
  detailSections.forEach((section) => {
    if (!section.detalles.length) return;
    let target: PedidoCsv | undefined;
    if (section.pedidoRef) {
      const ref = normalizePedidoValue(section.pedidoRef);
      target = pedidos.find((p) => normalizePedidoValue(p.pedido) === ref);
    }
    if (!target) {
      target = pedidos.find((p) => p.detalles.length === 0);
    }
    if (target) {
      target.detalles = section.detalles;
      if (!target.importe && section.detalles.some((d) => typeof d.importe === "number")) {
        const total = section.detalles.reduce((sum, det) => sum + (det.importe || 0), 0);
        if (total) target.importe = total;
      }
    }
  });

  return pedidos;
}
