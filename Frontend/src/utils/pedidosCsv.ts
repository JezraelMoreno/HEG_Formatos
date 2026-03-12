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
  clave_modelo?: string;
  ancho?: number;
  largo?: number;
  m2_corte?: number;
  piezas?: number;
  m2_pedido?: number;
  numero_perfil?: string;
  medida_tramo?: number;
  peso_kg_ml?: number;
  perimetro_m2_ml?: number;
  total_tramos?: number;
  m2?: number;
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
  porcentaje_descuento?: number;
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

const normalizeKey = (value: string) =>
  stripBom(value)
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
  const trimmed = stripBom(value)
    .replace(/\s+/g, "")
    .replace(/\u00a0/g, "")
    .replace(/\$/g, "");
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

  //  PRIMER FILTRO: si contiene tokens que son claramente de resumen, descartar
  const summaryBlacklist = [
    "IMPORTE ALUMINIO",
    "AMORTIZACION",
    "SUMA",
    "TOTAL",
    "IVA",
    "APROBADO",
    "ANTICIPO",
    "TOTAL A PAGAR",
  ];

  if (summaryBlacklist.some((token) => normalized.includes(token))) {
    const hasDescripcionCol = normalized.includes("DESCRIPCION") || normalized.includes("N° PERFIL");
    const hasImporteCol = normalized.includes("IMPORTE");
    const hasQtyCol =
      normalized.includes("CANTIDAD") ||
      normalized.includes("PIEZAS") ||
      normalized.includes("PZ") ||
      normalized.includes("PZAS") ||
      normalized.includes("TOTAL TRAMOS");
    if (!(hasDescripcionCol && hasImporteCol && hasQtyCol)) {
      return false;
    }
  }

  // SEGUNDO FILTRO:
  // si la fila tiene IMPORTE pero no tiene DESCRIPCION NI N° PERFIL,
  // entonces NO es un encabezado válido de detalles.
  if (
    normalized.includes("IMPORTE") &&
    !normalized.includes("DESCRIPCION") &&
    !normalized.includes("N° PERFIL")
  ) {
    return false;
  }

  //  Reglas originales
  const hasCantidad =
    normalized.includes("CANTIDAD") ||
    normalized.includes("PIEZAS") ||
    normalized.includes("PZ") ||
    normalized.includes("PZAS") ||
    normalized.includes("PIEZA") ||
    normalized.includes("PIEZ") ||
    normalized.includes("TOTAL TRAMOS");

  const hasUnitPrice =
    normalized.includes("P UNITARIO") ||
    normalized.includes("P UNIT") ||
    normalized.includes("PRECIO UNITARIO") ||
    normalized.includes("PUNITARIO") ||
    normalized.includes("PU") ||
    normalized.includes("P U");

  const hasNumero =
    normalized.includes("NO") ||
    normalized.includes("NO.") ||
    normalized.includes("#") ||
    normalized.includes("NUMERO");

  const hasAlColumns =
    normalized.includes("PARTIDA") &&
    normalized.includes("N° PERFIL") &&
    normalized.includes("TOTAL TRAMOS") &&
    normalized.includes("IMPORTE");

  return (
    (hasNumero &&
      normalized.includes("DESCRIPCION") &&
      hasCantidad &&
      normalized.includes("IMPORTE") &&
      (hasUnitPrice || hasAlColumns)) ||
    hasAlColumns
  );
};


const parseDetailBlock = (rows: string[][], headerIndex: number) => {
  const headerRow = rows[headerIndex] || [];
  const headerKeys = headerRow.map(normalizeKey);
  const idx = (aliases: string[]) =>
    headerKeys.findIndex((key) => aliases.includes(key));

  const idxDescripcion = idx(["DESCRIPCION"]);
  const idxUnidad = idx(["UNIDAD"]);
  const idxMedida = idx(["MEDIDA"]);
  const idxCantidad = idx(["CANTIDAD"]);
  const idxPiezas = idx([
    "PIEZAS",
    "PIEZA",
    "PZ",
    "PIEZ",
    "PIEZS",
    "PZAS", // soportar PZAS
  ]);
  const idxPrecioUnitario = idx([
    "P UNITARIO",
    "P UNIT",
    "PRECIO UNITARIO",
    "PUNITARIO",
    "PU",  // soportar P.U. → PU
    "P U", // por si viene con espacio
  ]);
  const idxImporte = idx(["IMPORTE"]);
  const idxClave = idx(["CLAVE"]);
  const idxML = idx(["ML", "M L"]);
  const idxAcabado = idx(["ACABADO"]);
  const idxKg = idx(["KG"]);
  const idxPrecioKg = idx([
    "PRECIOXKG",
    "PRECIO X KG",
    "PRECIOXK G",
    "PRECIO POR KG",
    "PRECIOKG",
  ]);

  const idxClaveModelo = idx([
    "MODELO",
    "CLAVE MODELO",
    "CLAVE/MODELO",
    "MODELO/CLAVE",
  ]);
  const idxAncho = idx(["ANCHO"]);
  const idxLargo = idx(["LARGO", "ALTO"]);

  //  M2 CORTE / M2 PEDIDO:
  // primero intentamos con alias; si no, usamos las dos columnas "M2" tal como vienen
  let idxM2Corte = idx([
    "M2 CORTE",
    "M2CORTE",
    "M2 X CORTE",
    "M2 POR CORTE",
  ]);
  let idxM2Pedido = idx([
    "M2 PEDIDO",
    "M2PEDIDO",
    "M2 X PEDIDO",
    "M2 POR PEDIDO",
  ]);

  if (idxM2Corte < 0) {
    idxM2Corte = headerKeys.indexOf("M2");
  }
  if (idxM2Pedido < 0 && idxM2Corte >= 0) {
    idxM2Pedido = headerKeys.indexOf("M2", idxM2Corte + 1);
  }

  const idxNumeroPerfil = idx([
    "N° PERFIL",
    "NO PERFIL",
    "NUMERO PERFIL",
    "N PERFIL",
    "NUMERO DE PERFIL",
  ]);
  const idxMedidaTramo = idx([
    "MEDIDA (TRAMO)",
    "MEDIDA TRAMO",
    "MEDIDATRAMO",
  ]);
  const idxPesoKgMl = idx([
    "PESO (KG/ML)",
    "PESO KG/ML",
    "PESO KG ML",
    "PESO KG",
    "PESO",
  ]);
  const idxPerimetro = idx([
    "PERIM (M2/ML)",
    "PERÍM (M2/ML)",
    "PERIMETRO",
    "PERIM",
  ]);
  const idxTotalTramos = idx([
    "TOTAL TRAMOS",
    "TOTAL TRAMO",
    "TOT TRAMOS",
    "TOTALTRAMOS",
  ]);
  const idxM2 = idx(["M2", "M 2", "M.2.", "METROS CUADRADOS"]);

  const cantidadCol =
    idxCantidad >= 0
      ? idxCantidad
      : idxPiezas >= 0
        ? idxPiezas
        : idxTotalTramos;
  const isAlHeader = idxNumeroPerfil >= 0 && idxTotalTramos >= 0;

  if (
    idxDescripcion < 0 ||
    cantidadCol < 0 ||
    idxImporte < 0 ||
    (!isAlHeader && idxPrecioUnitario < 0)
  ) {
    return { detalles: [] as PedidoDetalleCsv[], nextIndex: headerIndex + 1 };
  }

  const detalles: PedidoDetalleCsv[] = [];
  let i = headerIndex + 1;
  let blankRows = 0;

  while (i < rows.length) {
    const row = rows[i] || [];
    const normalizedRow = row.map((cell) => (cell || "").trim());
    const keyRow = row.map(normalizeKey);

    const isSummaryRow = keyRow.some((token) =>
      DETAIL_SUMMARY_TOKENS.has(token),
    );
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
    const cantidad =
      cantidadCol >= 0
        ? toNumberValue(row[cantidadCol], { integer: true })
        : null;
    const piezasValue =
      idxPiezas >= 0
        ? toNumberValue(row[idxPiezas], { integer: true })
        : null;
    const precioUnitario =
      idxPrecioUnitario >= 0 ? toNumberValue(row[idxPrecioUnitario]) : null;
    const importe = toNumberValue(row[idxImporte]);
    const clave = cleanText(row[idxClave]);
    const unidad = cleanText(row[idxUnidad]);
    const medida = cleanText(row[idxMedida]);
    const ml = toNumberValue(row[idxML]);
    const acabado = cleanText(row[idxAcabado]);
    const kg = toNumberValue(row[idxKg]);
    const precioKg = toNumberValue(row[idxPrecioKg]);
    const claveModelo = cleanText(row[idxClaveModelo]);
    const ancho = toNumberValue(row[idxAncho]);
    const largo = toNumberValue(row[idxLargo]);
    const m2Corte = toNumberValue(row[idxM2Corte]);
    const m2Pedido = toNumberValue(row[idxM2Pedido]);
    const numeroPerfil = cleanText(row[idxNumeroPerfil]);
    const medidaTramo = toNumberValue(row[idxMedidaTramo]);
    const pesoKgMl = toNumberValue(row[idxPesoKgMl]);
    const perimetroM2Ml = toNumberValue(row[idxPerimetro]);
    const totalTramosVal =
      idxTotalTramos >= 0
        ? toNumberValue(row[idxTotalTramos], { integer: true })
        : null;
    const m2Valor = toNumberValue(row[idxM2]);

    if (!descripcion && importe === null && cantidad === null) {
      i += 1;
      continue;
    }

    const detalle: PedidoDetalleCsv = {
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
    };

    if (
      detalle.precio_unitario === undefined &&
      importe !== null &&
      cantidad !== null &&
      cantidad !== 0
    ) {
      detalle.precio_unitario = Number((importe / cantidad).toFixed(2));
    }
    if (piezasValue !== null) detalle.piezas = piezasValue;
    if (claveModelo) detalle.clave_modelo = claveModelo;
    if (ancho !== null) detalle.ancho = ancho;
    if (largo !== null) detalle.largo = largo;
    if (m2Corte !== null) detalle.m2_corte = m2Corte;
    if (m2Pedido !== null) detalle.m2_pedido = m2Pedido;
    if (numeroPerfil) detalle.numero_perfil = numeroPerfil;
    if (medidaTramo !== null) detalle.medida_tramo = medidaTramo;
    if (pesoKgMl !== null) detalle.peso_kg_ml = pesoKgMl;
    if (perimetroM2Ml !== null) detalle.perimetro_m2_ml = perimetroM2Ml;
    if (totalTramosVal !== null) detalle.total_tramos = totalTramosVal;
    if (m2Valor !== null) detalle.m2 = m2Valor;

    detalles.push(detalle);
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

export function parsePedidosCsv(
  text: string,
  defaultProjectName = "",
): PedidoCsv[] {
  const rows = parseCsvGrid(text).filter((r) => r && r.length);
  if (!rows.length) return [];

  const headerIndex = rows.findIndex((row) =>
    row.some((cell) => normalizeKey(cell) === "PROYECTO"),
  );
  if (headerIndex === -1) return [];

  const headers = rows[headerIndex].map(normalizeKey);
  const idx = (aliases: string[]) =>
    headers.findIndex((key) => aliases.includes(key));

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
  const iPctDesc = idx(["% SITUACION ESPECIAL"]);

  if (
    [
      iProyecto,
      iPedido,
      iClan,
      iFamilia,
      iProveedor,
      iFecha,
      iConcepto,
      iImporte,
    ].some((v) => v < 0)
  ) {
    return [];
  }

  const detailSections = extractDetailSections(rows);
  const stopIndex = rows.findIndex(
    (row, idx2) => idx2 > headerIndex && isDetailHeader(row),
  );
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
    const situaciones_especiales =
      iSitEsp >= 0 ? cleanText(cols[iSitEsp]) : "";
    const importeNum = cleanNumber(cols[iImporte]);
    const pctDesc = iPctDesc >= 0 ? cleanNumber(cols[iPctDesc]) : null;

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
      porcentaje_descuento: pctDesc ?? undefined,
      detalles: [],
    });
  }

  const normalizePedidoValue = (value: string | undefined | null) =>
    (value ?? "").trim().toUpperCase();

  detailSections.forEach((section) => {
    if (!section.detalles.length) return;
    let target: PedidoCsv | undefined;
    if (section.pedidoRef) {
      const ref = normalizePedidoValue(section.pedidoRef);
      target = pedidos.find(
        (p) => normalizePedidoValue(p.pedido) === ref,
      );
    }
    if (!target) {
      target = pedidos.find((p) => p.detalles.length === 0);
    }
    if (target) {
      target.detalles = section.detalles;
      if (
        !target.importe &&
        section.detalles.some((d) => typeof d.importe === "number")
      ) {
        const total = section.detalles.reduce(
          (sum, det) => sum + (det.importe || 0),
          0,
        );
        if (total) target.importe = total;
      }
    }
  });

  return pedidos;
}
