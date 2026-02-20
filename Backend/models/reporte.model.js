import { queryAsync } from "../config/db.js";

// ─── helpers reutilizados dentro del modelo ───────────────────────────
const toList = (v) =>
  Array.isArray(v)
    ? v
    : typeof v === "string"
      ? v.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

function addMulti(field, values, query, params) {
  const list = toList(values);
  if (list.length === 1) {
    query += ` AND ${field} = ?`;
    params.push(list[0]);
  } else if (list.length > 1) {
    query += ` AND ${field} IN (${list.map(() => "?").join(",")})`;
    params.push(...list);
  }
  return query;
}

// ─── Filtros disponibles para Cristal ─────────────────────────────────
export async function getFiltrosCristal(proyectoId) {
  return queryAsync(
    `SELECT DISTINCT p.proveedor, p.clan, p.concepto, p.pedido
     FROM pedidos p
     INNER JOIN pedidos_detalles_cristal dc ON dc.id_pedido = p.id
     WHERE p.id_proyecto = ?`,
    [proyectoId]
  );
}

// ─── Datos del reporte Cristal (con filtros dinámicos) ────────────────
export async function getReporteCristal(proyectoId, filters = {}) {
  let query = `
    SELECT dc.id_detalle, p.id AS id_pedido, p.pedido, p.proveedor, p.clan, p.concepto,
           DATE_FORMAT(p.fecha_aprobacion, '%Y-%m-%d') AS fecha_aprobacion,
           dc.descripcion, dc.clave_modelo, dc.ancho, dc.largo, dc.m2_corte,
           dc.piezas, dc.m2_pedido, dc.precio_unitario, dc.importe
    FROM pedidos p
    INNER JOIN pedidos_detalles_cristal dc ON dc.id_pedido = p.id
    WHERE p.id_proyecto = ?
  `;
  const params = [proyectoId];

  const { proveedor, clan, concepto, pedido, fecha_desde, fecha_hasta, clave_modelo } = filters;
  query = addMulti("p.proveedor", proveedor, query, params);
  query = addMulti("p.clan", clan, query, params);
  query = addMulti("p.pedido", pedido, query, params);
  if (concepto && String(concepto).trim()) {
    query += " AND p.concepto = ?";
    params.push(String(concepto));
  }
  if (fecha_desde && String(fecha_desde).trim()) {
    query += " AND p.fecha_aprobacion >= ?";
    params.push(String(fecha_desde));
  }
  if (fecha_hasta && String(fecha_hasta).trim()) {
    query += " AND p.fecha_aprobacion <= ?";
    params.push(String(fecha_hasta));
  }
  if (clave_modelo && String(clave_modelo).trim()) {
    query += " AND dc.clave_modelo LIKE ?";
    params.push(`%${String(clave_modelo).trim()}%`);
  }

  query += " ORDER BY CAST(p.pedido AS UNSIGNED) ASC, dc.id_detalle ASC";

  return queryAsync(query, params);
}

// ─── Filtros disponibles para Aluminio ────────────────────────────────
export async function getFiltrosAluminio(proyectoId) {
  return queryAsync(
    `SELECT DISTINCT p.proveedor, p.clan, p.concepto, p.pedido, da.acabado
     FROM pedidos p
     INNER JOIN pedidos_detalles_aluminio da ON da.id_pedido = p.id
     WHERE p.id_proyecto = ?`,
    [proyectoId]
  );
}

// ─── Datos del reporte Aluminio (con filtros dinámicos) ───────────────
export async function getReporteAluminio(proyectoId, filters = {}) {
  let query = `
    SELECT da.id_detalle, p.id AS id_pedido, p.pedido, p.proveedor, p.clan, p.concepto,
           DATE_FORMAT(p.fecha_aprobacion, '%Y-%m-%d') AS fecha_aprobacion,
           da.descripcion, da.numero_perfil, da.medida_tramo, da.unidad,
           da.peso_kg_ml, da.perimetro_m2_ml, da.acabado, da.total_tramos,
           da.ml, da.kg, da.m2, da.importe
    FROM pedidos p
    INNER JOIN pedidos_detalles_aluminio da ON da.id_pedido = p.id
    WHERE p.id_proyecto = ?
  `;
  const params = [proyectoId];

  const { proveedor, clan, concepto, pedido, fecha_desde, fecha_hasta, acabado } = filters;
  query = addMulti("p.proveedor", proveedor, query, params);
  query = addMulti("p.clan", clan, query, params);
  query = addMulti("p.pedido", pedido, query, params);
  query = addMulti("da.acabado", acabado, query, params);
  if (concepto && String(concepto).trim()) {
    query += " AND p.concepto = ?";
    params.push(String(concepto));
  }
  if (fecha_desde && String(fecha_desde).trim()) {
    query += " AND p.fecha_aprobacion >= ?";
    params.push(String(fecha_desde));
  }
  if (fecha_hasta && String(fecha_hasta).trim()) {
    query += " AND p.fecha_aprobacion <= ?";
    params.push(String(fecha_hasta));
  }

  query += " ORDER BY CAST(p.pedido AS UNSIGNED) ASC, da.id_detalle ASC";

  return queryAsync(query, params);
}

// ─── Nombre de proyecto (reutilizado por ambos exports) ───────────────
export async function getNombreProyecto(proyectoId) {
  const rows = await queryAsync(
    "SELECT nombre FROM proyectos WHERE id_proyecto = ?",
    [proyectoId]
  );
  return (rows && rows[0] && rows[0].nombre) || `Proyecto ${proyectoId}`;
}

// ─── Datos para exportar Cristal a Excel ──────────────────────────────
export async function getExportCristal(proyectoId, filters = {}) {
  let query = `
    SELECT dc.id_detalle, p.pedido, p.proveedor, p.clan, p.concepto,
           DATE_FORMAT(p.fecha_aprobacion, '%Y-%m-%d') AS fecha_aprobacion,
           dc.descripcion, dc.clave_modelo, dc.ancho, dc.largo, dc.m2_corte,
           dc.piezas, dc.m2_pedido, dc.precio_unitario, dc.importe
    FROM pedidos p
    INNER JOIN pedidos_detalles_cristal dc ON dc.id_pedido = p.id
    WHERE p.id_proyecto = ?
  `;
  const params = [proyectoId];

  const { proveedor, clan, concepto, pedido, fecha_desde, fecha_hasta, clave_modelo } = filters;
  query = addMulti("p.proveedor", proveedor, query, params);
  query = addMulti("p.clan", clan, query, params);
  query = addMulti("p.pedido", pedido, query, params);
  if (concepto && String(concepto).trim()) {
    query += " AND p.concepto = ?";
    params.push(String(concepto));
  }
  if (fecha_desde && String(fecha_desde).trim()) {
    query += " AND p.fecha_aprobacion >= ?";
    params.push(String(fecha_desde));
  }
  if (fecha_hasta && String(fecha_hasta).trim()) {
    query += " AND p.fecha_aprobacion <= ?";
    params.push(String(fecha_hasta));
  }
  if (clave_modelo && String(clave_modelo).trim()) {
    query += " AND dc.clave_modelo LIKE ?";
    params.push(`%${String(clave_modelo).trim()}%`);
  }

  query += " ORDER BY CAST(p.pedido AS UNSIGNED) ASC, dc.id_detalle ASC";

  return queryAsync(query, params);
}

// ─── Datos para exportar Aluminio a Excel ─────────────────────────────
export async function getExportAluminio(proyectoId, filters = {}) {
  let query = `
    SELECT da.id_detalle, p.pedido, p.proveedor, p.clan, p.concepto,
           DATE_FORMAT(p.fecha_aprobacion, '%Y-%m-%d') AS fecha_aprobacion,
           da.descripcion, da.numero_perfil, da.medida_tramo, da.unidad,
           da.peso_kg_ml, da.perimetro_m2_ml, da.acabado, da.total_tramos,
           da.ml, da.kg, da.m2, da.importe
    FROM pedidos p
    INNER JOIN pedidos_detalles_aluminio da ON da.id_pedido = p.id
    WHERE p.id_proyecto = ?
  `;
  const params = [proyectoId];

  const { proveedor, clan, concepto, pedido, fecha_desde, fecha_hasta, acabado } = filters;
  query = addMulti("p.proveedor", proveedor, query, params);
  query = addMulti("p.clan", clan, query, params);
  query = addMulti("p.pedido", pedido, query, params);
  query = addMulti("da.acabado", acabado, query, params);
  if (concepto && String(concepto).trim()) {
    query += " AND p.concepto = ?";
    params.push(String(concepto));
  }
  if (fecha_desde && String(fecha_desde).trim()) {
    query += " AND p.fecha_aprobacion >= ?";
    params.push(String(fecha_desde));
  }
  if (fecha_hasta && String(fecha_hasta).trim()) {
    query += " AND p.fecha_aprobacion <= ?";
    params.push(String(fecha_hasta));
  }

  query += " ORDER BY CAST(p.pedido AS UNSIGNED) ASC, da.id_detalle ASC";

  return queryAsync(query, params);
}
