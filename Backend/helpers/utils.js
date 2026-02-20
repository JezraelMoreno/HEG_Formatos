export function parseDateToISO(value) {
  if (!value) return null;
  const s = String(value).trim();
  let m = s.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
  if (m) {
    const yyyy = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    const dd = parseInt(m[3], 10);
    if (isValidYMD(yyyy, mm, dd)) return `${yyyy}-${pad2(mm)}-${pad2(dd)}`;
    return null;
  }
  m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (m) {
    const dd = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    const yyyy = parseInt(m[3], 10);
    if (isValidYMD(yyyy, mm, dd)) return `${yyyy}-${pad2(mm)}-${pad2(dd)}`;
    return null;
  }
  return null;
}

export function pad2(n) {
  return String(n).padStart(2, "0");
}

export function isValidYMD(y, m, d) {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function normalizeTextValue(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

export function parseSituacionEspecialInfo(texto) {
  const val = normalizeTextValue(texto).toUpperCase();
  if (!val) return { tipo: null, porcentaje: 0 };
  const esAmort = val.includes("AMORT");
  const esTrasp = val.includes("TRASP");
  if (!esAmort && !esTrasp) return { tipo: null, porcentaje: 0 };
  const m = val.match(/(-?\d+(?:[.,]\d+)?)\s*%/);
  const pct = m ? Number(String(m[1]).replace(",", ".")) : 0;
  const pctSeguro = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;
  return { tipo: esAmort ? "amortizacion" : "traspaso", porcentaje: pctSeguro };
}

export function normalizePct(raw) {
  if (raw === null || raw === undefined) return { mathPct: 0, dbPct: null };
  let pct = Number(raw);
  if (!Number.isFinite(pct) || pct <= 0) return { mathPct: 0, dbPct: null };
  if (pct > 0 && pct <= 1) pct = pct * 100;
  const mathPct = Math.min(Math.max(pct, 0), 100);
  const dbPct = Number(Math.min(mathPct, 100).toFixed(2));
  return { mathPct, dbPct };
}

export function isSalidaTlatilco(texto) {
  const val = normalizeTextValue(texto).toUpperCase();
  return val.includes("SALIDA TLATILCO");
}

export function calcularSubtotalDetalles(detalles = []) {
  if (!Array.isArray(detalles) || !detalles.length) return 0;
  return detalles.reduce((sum, det) => {
    const importe = toFiniteNumber(det?.importe);
    return sum + (Number.isFinite(importe) ? importe : 0);
  }, 0);
}

export function toFiniteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function decimalOrNull(value) {
  return value === null || value === undefined ? null : Number(value);
}

export const PRESUPUESTO_FAMILIA_COL = {
  cristal: "presupuesto_cristal",
  aluminio: "presupuesto_aluminio",
  miscelaneos: "presupuesto_miscelaneos",
};

export function parseBudgetValue(raw, { allowNull = true } = {}) {
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return allowNull ? null : 0;
  }
  const num = Number(raw);
  if (!Number.isFinite(num)) return null;
  return Number(num.toFixed(2));
}

export function normalizarFamiliaPresupuesto(familia) {
  const fam = normalizeTextValue(familia).toUpperCase();
  if (fam.startsWith("CR")) return "cristal";
  if (fam === "MQAL" || fam.startsWith("AL") || fam.includes("ALUM")) return "aluminio";
  return "miscelaneos";
}

export function redondearMoneda(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return 0;
  return Number(num.toFixed(2));
}

export function claveExplosion(clan, familia) {
  const familiaVal = normalizeTextValue(familia).toUpperCase();
  if (familiaVal) return familiaVal;
  const clanVal = normalizeTextValue(clan).toUpperCase();
  return clanVal || "";
}

export function acumularGastoPorFamilia(rows = []) {
  const gastoPorClave = new Map();
  let gastoMiscelaneos = 0;
  for (const row of rows) {
    const importe = redondearMoneda(row?.importe_total);
    const key = claveExplosion(row?.clan, row?.familia);
    gastoPorClave.set(key, (gastoPorClave.get(key) || 0) + importe);
    if (normalizarFamiliaPresupuesto(row?.familia) === "miscelaneos") {
      gastoMiscelaneos += importe;
    }
  }
  return { gastoPorClave, gastoMiscelaneos: redondearMoneda(gastoMiscelaneos) };
}

export function prepareDetalleForInsert(detalle) {
  const descripcion = normalizeTextValue(detalle?.descripcion) || "Detalle";
  const unidad = normalizeTextValue(detalle?.unidad) || null;
  const medida = normalizeTextValue(detalle?.medida) || null;
  const clave = normalizeTextValue(detalle?.clave) || null;
  const acabado = normalizeTextValue(detalle?.acabado) || null;
  const cantidadBase = toFiniteNumber(detalle?.cantidad);
  const cantidad = cantidadBase !== null ? Math.round(cantidadBase) : 0;
  let precioUnitario = toFiniteNumber(detalle?.precio_unitario);
  const importeDato = toFiniteNumber(detalle?.importe);
  if ((precioUnitario === null || precioUnitario === 0) && importeDato !== null && cantidad) {
    precioUnitario = Number((importeDato / cantidad).toFixed(2));
  }
  const importe = importeDato !== null ? importeDato : Number((cantidad * (precioUnitario || 0)).toFixed(2));
  const ml = toFiniteNumber(detalle?.ml);
  const kg = toFiniteNumber(detalle?.kg);
  const precioKg = toFiniteNumber(detalle?.precio_x_kg);
  return {
    descripcion,
    unidad,
    medida,
    cantidad,
    precio_unitario: precioUnitario !== null ? precioUnitario : 0,
    importe,
    clave,
    ml,
    acabado,
    kg,
    precio_x_kg: precioKg,
  };
}

export function prepareCristalDetalleForInsert(detalle) {
  const descripcion = normalizeTextValue(detalle?.descripcion) || "Detalle cristal";
  const claveModelo = normalizeTextValue(detalle?.clave_modelo ?? detalle?.clave) || null;
  const ancho = toFiniteNumber(detalle?.ancho);
  const largo = toFiniteNumber(detalle?.largo);
  const m2Corte = toFiniteNumber(detalle?.m2_corte);
  const piezasBase = toFiniteNumber(detalle?.piezas ?? detalle?.cantidad);
  const piezas = piezasBase !== null ? Math.max(0, Math.round(piezasBase)) : 0;
  let m2Pedido = toFiniteNumber(detalle?.m2_pedido);
  if (m2Pedido === null && piezas > 0) {
    m2Pedido = piezas;
  }
  if (m2Pedido === null && m2Corte !== null && m2Corte > 0) {
    m2Pedido = m2Corte;
  }
  let precioUnitario = toFiniteNumber(detalle?.precio_unitario);
  let importe = toFiniteNumber(detalle?.importe);
  if ((importe === null || importe === 0) && piezas && precioUnitario !== null) {
    importe = Number((piezas * precioUnitario).toFixed(2));
  }
  if ((precioUnitario === null || precioUnitario === 0) && importe !== null && piezas) {
    precioUnitario = Number((importe / piezas).toFixed(2));
  }
  if (importe === null) {
    importe = Number(((precioUnitario || 0) * piezas).toFixed(2));
  }
  return {
    descripcion,
    clave_modelo: claveModelo,
    ancho,
    largo,
    m2_corte: m2Corte,
    piezas,
    m2_pedido: m2Pedido,
    precio_unitario: precioUnitario !== null ? precioUnitario : 0,
    importe: importe !== null ? importe : 0,
  };
}

export function prepareAluminioDetalleForInsert(detalle) {
  const descripcion = normalizeTextValue(detalle?.descripcion) || "Detalle aluminio";
  const numeroPerfil = normalizeTextValue(detalle?.numero_perfil) || null;
  const medidaTramo = toFiniteNumber(detalle?.medida_tramo);
  const unidad = normalizeTextValue(detalle?.unidad) || null;
  const pesoKgMl = toFiniteNumber(detalle?.peso_kg_ml);
  const perimetroM2Ml = toFiniteNumber(detalle?.perimetro_m2_ml);
  const acabado = normalizeTextValue(detalle?.acabado) || null;
  const totalTramosBase = toFiniteNumber(detalle?.total_tramos);
  const totalTramos = totalTramosBase !== null ? Math.max(0, Math.round(totalTramosBase)) : null;
  const ml = toFiniteNumber(detalle?.ml);
  const kg = toFiniteNumber(detalle?.kg);
  const m2 = toFiniteNumber(detalle?.m2);
  const importe = toFiniteNumber(detalle?.importe) || 0;
  return {
    numero_perfil: numeroPerfil,
    descripcion,
    medida_tramo: medidaTramo,
    unidad,
    peso_kg_ml: pesoKgMl,
    perimetro_m2_ml: perimetroM2Ml,
    acabado,
    total_tramos: totalTramos,
    ml,
    kg,
    m2,
    importe,
  };
}
