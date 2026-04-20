import { queryAsync } from "../config/db.js";
import {
  normalizeTextValue,
  normalizePct,
  isSalidaTlatilco,
  toFiniteNumber,
  decimalOrNull,
  parseDateToISO,
  pad2,
  prepareDetalleForInsert,
  prepareCristalDetalleForInsert,
  prepareAluminioDetalleForInsert,
} from "../helpers/utils.js";

export async function findByProyecto(id, filters = {}) {
  let sql =
    "SELECT id, id_proyecto, nombre_proyecto, pedido, clan, familia, proveedor, nombre_usuario, DATE_FORMAT(fecha_aprobacion, '%Y-%m-%d') AS fecha_aprobacion, concepto, situaciones_especiales, porcentaje_descuento, importe_total AS importe FROM pedidos WHERE id_proyecto = ?";
  const params = [id];
  const toList = (v) => Array.isArray(v) ? v : (typeof v === 'string' ? v.split('||').map(s => s.trim()).filter(Boolean) : []);
  const addMulti = (field, values) => {
    const list = toList(values);
    if (list.length === 1) { sql += ` AND ${field} = ?`; params.push(list[0]); }
    else if (list.length > 1) { sql += ` AND ${field} IN (${list.map(_ => '?').join(',')})`; params.push(...list); }
  };
  addMulti('familia', filters.familia);
  addMulti('clan', filters.clan);
  addMulti('proveedor', filters.proveedor);
  if (filters.concepto && String(filters.concepto).trim() !== "") {
    sql += " AND concepto = ?";
    params.push(String(filters.concepto));
  }
  if (filters.fecha && String(filters.fecha).trim() !== "") {
    sql += " AND DATE(fecha_aprobacion) = ?";
    params.push(String(filters.fecha));
  }
  sql += " ORDER BY clan ASC, familia ASC, CAST(pedido AS UNSIGNED) ASC";
  return queryAsync(sql, params);
}

export async function getResumen(fechaFiltro, rawUsuario) {
  let sql = `
    SELECT
      p.id,
      p.nombre_proyecto,
      p.pedido,
      p.nombre_usuario,
      DATE_FORMAT(COALESCE(pd.fecha_subida, p.fecha_aprobacion), '%Y-%m-%d') AS fecha_subida
    FROM pedidos p
    LEFT JOIN (
      SELECT id_pedido, MIN(fecha_registro) AS fecha_subida
      FROM (
        SELECT id_pedido, fecha_registro FROM pedidos_detalles_miscelaneos
        UNION ALL
        SELECT id_pedido, fecha_registro FROM pedidos_detalles_cristal
        UNION ALL
        SELECT id_pedido, fecha_registro FROM pedidos_detalles_aluminio
      ) detalles
      GROUP BY id_pedido
    ) pd ON pd.id_pedido = p.id
    WHERE 1 = 1
  `;
  const params = [];
  if (fechaFiltro) {
    sql += " AND DATE(COALESCE(pd.fecha_subida, p.fecha_aprobacion)) = ?";
    params.push(fechaFiltro);
  }
  if (rawUsuario) {
    sql += " AND p.nombre_usuario = ?";
    params.push(rawUsuario);
  }
  sql += " ORDER BY p.id DESC";
  const rows = await queryAsync(sql, params);
  const usuariosRows = await queryAsync("SELECT DISTINCT nombre_usuario FROM pedidos ORDER BY nombre_usuario ASC");
  return {
    rows: rows || [],
    usuarios: (usuariosRows || []).map((row) => row.nombre_usuario).filter(Boolean),
  };
}

export async function getDetallesMiscelaneos(pedidoId) {
  const sql = `SELECT id_detalle, id_pedido, descripcion, unidad, medida, cantidad, precio_unitario, importe, clave, ml, acabado, kg, precio_x_kg
               FROM pedidos_detalles_miscelaneos
               WHERE id_pedido = ?
               ORDER BY id_detalle ASC`;
  const rows = await queryAsync(sql, [pedidoId]);
  return (rows || []).map((r) => ({
    id_detalle: r.id_detalle,
    id_pedido: r.id_pedido,
    descripcion: r.descripcion,
    unidad: r.unidad,
    medida: r.medida,
    cantidad: Number(r.cantidad || 0),
    precio_unitario: Number(r.precio_unitario || 0),
    importe: Number(r.importe || 0),
    clave: r.clave,
    ml: decimalOrNull(r.ml),
    acabado: r.acabado,
    kg: decimalOrNull(r.kg),
    precio_x_kg: decimalOrNull(r.precio_x_kg),
  }));
}

export async function getDetallesCristal(pedidoId) {
  const sql = `SELECT id_detalle, id_pedido, descripcion, clave_modelo, ancho, largo, m2_corte, piezas, m2_pedido, precio_unitario, importe
               FROM pedidos_detalles_cristal
               WHERE id_pedido = ?
               ORDER BY id_detalle ASC`;
  const rows = await queryAsync(sql, [pedidoId]);
  return (rows || []).map((r) => ({
    id_detalle: r.id_detalle,
    id_pedido: r.id_pedido,
    descripcion: r.descripcion,
    clave_modelo: r.clave_modelo,
    ancho: decimalOrNull(r.ancho),
    largo: decimalOrNull(r.largo),
    m2_corte: decimalOrNull(r.m2_corte),
    piezas: Number(r.piezas || 0),
    m2_pedido: decimalOrNull(r.m2_pedido),
    precio_unitario: Number(r.precio_unitario || 0),
    importe: Number(r.importe || 0),
  }));
}

export async function getDetallesAluminio(pedidoId) {
  const sql = `SELECT id_detalle, id_pedido, numero_perfil, descripcion, medida_tramo, unidad, peso_kg_ml, perimetro_m2_ml, acabado, total_tramos, ml, kg, m2, importe
               FROM pedidos_detalles_aluminio
               WHERE id_pedido = ?
               ORDER BY id_detalle ASC`;
  const rows = await queryAsync(sql, [pedidoId]);
  return (rows || []).map((r) => ({
    id_detalle: r.id_detalle,
    id_pedido: r.id_pedido,
    numero_perfil: r.numero_perfil,
    descripcion: r.descripcion,
    medida_tramo: decimalOrNull(r.medida_tramo),
    unidad: r.unidad,
    peso_kg_ml: decimalOrNull(r.peso_kg_ml),
    perimetro_m2_ml: decimalOrNull(r.perimetro_m2_ml),
    acabado: r.acabado,
    total_tramos: r.total_tramos !== null && r.total_tramos !== undefined ? Number(r.total_tramos) : null,
    ml: decimalOrNull(r.ml),
    kg: decimalOrNull(r.kg),
    m2: decimalOrNull(r.m2),
    importe: Number(r.importe || 0),
  }));
}

export async function pedidoExists(pedidoId) {
  const rows = await queryAsync("SELECT id FROM pedidos WHERE id = ? LIMIT 1", [pedidoId]);
  return Array.isArray(rows) && rows.length > 0;
}

export async function deleteDetallesCristal(pedidoId) {
  return queryAsync("DELETE FROM pedidos_detalles_cristal WHERE id_pedido = ?", [pedidoId]);
}

export async function deleteDetallesAluminio(pedidoId) {
  return queryAsync("DELETE FROM pedidos_detalles_aluminio WHERE id_pedido = ?", [pedidoId]);
}

export async function insertCristalDetallesRows(pedidoId, detallesRaw) {
  if (!Array.isArray(detallesRaw) || detallesRaw.length === 0) return 0;
  const sqlDetalle = "INSERT INTO pedidos_detalles_cristal (id_pedido, descripcion, clave_modelo, ancho, largo, m2_corte, piezas, m2_pedido, precio_unitario, importe) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
  let inserted = 0;
  for (const detalleRaw of detallesRaw) {
    const detalle = prepareCristalDetalleForInsert(detalleRaw || {});
    const values = [
      pedidoId,
      detalle.descripcion,
      detalle.clave_modelo,
      detalle.ancho,
      detalle.largo,
      detalle.m2_corte,
      detalle.piezas,
      detalle.m2_pedido,
      detalle.precio_unitario,
      detalle.importe,
    ];
    await queryAsync(sqlDetalle, values);
    inserted += 1;
  }
  return inserted;
}

export async function insertAluminioDetallesRows(pedidoId, detallesRaw) {
  if (!Array.isArray(detallesRaw) || detallesRaw.length === 0) return 0;
  const sqlDetalle = `INSERT INTO pedidos_detalles_aluminio
    (id_pedido, numero_perfil, descripcion, medida_tramo, unidad, peso_kg_ml, perimetro_m2_ml, acabado, total_tramos, ml, kg, m2, importe)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  let inserted = 0;
  for (const detalleRaw of detallesRaw) {
    const detalle = prepareAluminioDetalleForInsert(detalleRaw || {});
    const values = [
      pedidoId,
      detalle.numero_perfil,
      detalle.descripcion,
      detalle.medida_tramo,
      detalle.unidad,
      detalle.peso_kg_ml,
      detalle.perimetro_m2_ml,
      detalle.acabado,
      detalle.total_tramos,
      detalle.ml,
      detalle.kg,
      detalle.m2,
      detalle.importe,
    ];
    await queryAsync(sqlDetalle, values);
    inserted += 1;
  }
  return inserted;
}

export async function insertPedidoDetallesRows(pedidoId, detallesRaw) {
  if (!Array.isArray(detallesRaw) || detallesRaw.length === 0) return;
  const sqlDetalle = "INSERT INTO pedidos_detalles_miscelaneos (id_pedido, descripcion, unidad, medida, cantidad, precio_unitario, importe, clave, ml, acabado, kg, precio_x_kg) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
  for (const detalleRaw of detallesRaw) {
    const detalle = prepareDetalleForInsert(detalleRaw || {});
    const values = [
      pedidoId,
      detalle.descripcion,
      detalle.unidad,
      detalle.medida,
      detalle.cantidad,
      detalle.precio_unitario,
      detalle.importe,
      detalle.clave,
      detalle.ml,
      detalle.acabado,
      detalle.kg,
      detalle.precio_x_kg,
    ];
    await queryAsync(sqlDetalle, values);
  }
}

export async function insertDetallesSegunFamilia(pedidoId, familia, detallesRaw) {
  if (!Array.isArray(detallesRaw) || detallesRaw.length === 0) return;
  const familiaVal = normalizeTextValue(familia).toUpperCase();
  if (familiaVal === "CR") {
    await insertCristalDetallesRows(pedidoId, detallesRaw);
    return;
  }
  if (familiaVal === "AL" || familiaVal === "MQAL") {
    await insertAluminioDetallesRows(pedidoId, detallesRaw);
    return;
  }
  await insertPedidoDetallesRows(pedidoId, detallesRaw);
}

export async function calcularImporteDesdeDetalles(row, { includeSubtotal = false } = {}) {
  const pedidoId = Number(row?.id);
  if (!Number.isFinite(pedidoId) || pedidoId <= 0) return includeSubtotal ? { subtotal: 0, total: 0 } : 0;
  const familia = normalizeTextValue(row?.familia).toUpperCase();
  let table = "pedidos_detalles_miscelaneos";
  if (familia === "CR") table = "pedidos_detalles_cristal";
  if (familia === "AL" || familia === "MQAL") table = "pedidos_detalles_aluminio";
  const sumRows = await queryAsync(`SELECT SUM(importe) AS subtotal FROM ${table} WHERE id_pedido = ?`, [pedidoId]);
  const subtotal = Number(sumRows?.[0]?.subtotal || 0);
  const subtotalBase = Number(subtotal.toFixed(2));
  const salidaTlatilco = isSalidaTlatilco(row?.situaciones_especiales);
  const { mathPct } = normalizePct(row?.porcentaje_descuento);
  const descuentoMonto = subtotalBase * (mathPct / 100);
  const subtotalConDesc = subtotalBase - descuentoMonto;
  const ivaMonto = subtotalConDesc * 0.16;
  const total = salidaTlatilco ? 0 : Number(Math.max(0, subtotalConDesc + ivaMonto).toFixed(2));
  if (includeSubtotal) return { subtotal: subtotalBase, total };
  return total;
}

export async function getPedidosForRecalc(proyectoId) {
  return queryAsync(
    "SELECT id, familia, situaciones_especiales, porcentaje_descuento FROM pedidos WHERE id_proyecto = ?",
    [proyectoId]
  );
}

export async function findExistingPedido(proyectoId, pedidoNombre) {
  const rows = await queryAsync(
    "SELECT id, familia, situaciones_especiales, porcentaje_descuento, importe_total FROM pedidos WHERE id_proyecto = ? AND pedido = ? LIMIT 1",
    [proyectoId, pedidoNombre]
  );
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

export async function deletePedidoById(pedidoId, proyectoId) {
  return queryAsync("DELETE FROM pedidos WHERE id = ? AND id_proyecto = ?", [pedidoId, proyectoId]);
}

export async function insertPedido(values) {
  const sql =
    "INSERT INTO pedidos (id_proyecto, nombre_proyecto, pedido, clan, familia, proveedor, fecha_aprobacion, concepto, situaciones_especiales, porcentaje_descuento, importe_total, nombre_usuario) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
  return queryAsync(sql, values);
}

export async function updateImporteTotal(pedidoId, importe) {
  return queryAsync("UPDATE pedidos SET importe_total = ? WHERE id = ?", [importe, pedidoId]);
}

export async function getProyectoNombre(id) {
  const rows = await queryAsync("SELECT nombre FROM proyectos WHERE id_proyecto = ?", [id]);
  return rows && rows[0] ? rows[0].nombre : `Proyecto ${id}`;
}

export async function getPedidosForExport(id, filters = {}) {
  let sql =
    "SELECT id, nombre_proyecto, pedido, clan, familia, proveedor, DATE_FORMAT(fecha_aprobacion, '%Y-%m-%d') AS fecha_aprobacion, concepto, situaciones_especiales, importe_total AS importe FROM pedidos WHERE id_proyecto = ?";
  const params = [id];
  const toList = (v) => Array.isArray(v) ? v : (typeof v === 'string' ? v.split('||').map(s => s.trim()).filter(Boolean) : []);
  const addMulti = (field, values) => {
    const list = toList(values);
    if (list.length === 1) { sql += ` AND ${field} = ?`; params.push(list[0]); }
    else if (list.length > 1) { sql += ` AND ${field} IN (${list.map(_ => '?').join(',')})`; params.push(...list); }
  };
  addMulti('familia', filters.familia);
  addMulti('clan', filters.clan);
  addMulti('proveedor', filters.proveedor);
  if (filters.concepto && String(filters.concepto).trim() !== "") {
    sql += " AND concepto = ?";
    params.push(String(filters.concepto));
  }
  if (filters.fecha && String(filters.fecha).trim() !== "") {
    sql += " AND DATE(fecha_aprobacion) = ?";
    params.push(String(filters.fecha));
  }
  sql += " ORDER BY clan ASC, familia ASC, CAST(pedido AS UNSIGNED) ASC";
  return queryAsync(sql, params);
}
