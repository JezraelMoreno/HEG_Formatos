import { queryAsync, withTransaction } from "../config/db.js";
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
  prepareAnticipoDetalleForInsert,
} from "../helpers/utils.js";

export async function findByProyecto(id, filters = {}) {
  let sql =
    "SELECT id, id_proyecto, nombre_proyecto, pedido, clan, familia, es_anticipo, proveedor, nombre_usuario, DATE_FORMAT(fecha_aprobacion, '%Y-%m-%d') AS fecha_aprobacion, concepto, situaciones_especiales, descripcion_general, porcentaje_descuento, moneda_aluminio, tipo_cambio, precio_aluminio_kg, precio_pintura_m2, importe_total AS importe, monto_cubierto_anticipo, estado, id_aprobador, DATE_FORMAT(fecha_levantado, '%Y-%m-%d %H:%i:%s') AS fecha_levantado, DATE_FORMAT(fecha_resolucion, '%Y-%m-%d %H:%i:%s') AS fecha_resolucion FROM pedidos WHERE id_proyecto = ?";
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
  const sql = `SELECT id_detalle, id_pedido, descripcion, concepto_detalle, unidad, medida, cantidad, precio_unitario, importe, clave, ml, acabado, kg, precio_x_kg
               FROM pedidos_detalles_miscelaneos
               WHERE id_pedido = ?
               ORDER BY id_detalle ASC`;
  const rows = await queryAsync(sql, [pedidoId]);
  return (rows || []).map((r) => ({
    id_detalle: r.id_detalle,
    id_pedido: r.id_pedido,
    descripcion: r.descripcion,
    concepto_detalle: r.concepto_detalle,
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

export async function getDetallesAnticipo(pedidoId) {
  const sql = `SELECT id_detalle, id_pedido, concepto, unidad, cantidad, precio_unitario, importe
               FROM pedidos_detalles_anticipo
               WHERE id_pedido = ?
               ORDER BY id_detalle ASC`;
  const rows = await queryAsync(sql, [pedidoId]);
  return (rows || []).map((r) => ({
    id_detalle: r.id_detalle,
    id_pedido: r.id_pedido,
    concepto: r.concepto,
    unidad: r.unidad,
    cantidad: Number(r.cantidad || 0),
    precio_unitario: Number(r.precio_unitario || 0),
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

export async function deleteDetallesAnticipo(pedidoId) {
  return queryAsync("DELETE FROM pedidos_detalles_anticipo WHERE id_pedido = ?", [pedidoId]);
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

export async function insertAluminioDetallesRows(pedidoId, detallesRaw, pedidoContext = {}) {
  if (!Array.isArray(detallesRaw) || detallesRaw.length === 0) return 0;
  const sqlDetalle = `INSERT INTO pedidos_detalles_aluminio
    (id_pedido, numero_perfil, descripcion, medida_tramo, unidad, peso_kg_ml, perimetro_m2_ml, acabado, total_tramos, ml, kg, m2, importe)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  let inserted = 0;
  for (const detalleRaw of detallesRaw) {
    const detalle = prepareAluminioDetalleForInsert(detalleRaw || {}, pedidoContext);
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

export async function insertAnticipoDetallesRows(pedidoId, detallesRaw) {
  if (!Array.isArray(detallesRaw) || detallesRaw.length === 0) return 0;
  const sqlDetalle = "INSERT INTO pedidos_detalles_anticipo (id_pedido, concepto, unidad, cantidad, precio_unitario, importe) VALUES (?, ?, ?, ?, ?, ?)";
  let inserted = 0;
  for (const detalleRaw of detallesRaw) {
    const detalle = prepareAnticipoDetalleForInsert(detalleRaw || {});
    const values = [pedidoId, detalle.concepto, detalle.unidad, detalle.cantidad, detalle.precio_unitario, detalle.importe];
    await queryAsync(sqlDetalle, values);
    inserted += 1;
  }
  return inserted;
}

export async function insertPedidoDetallesRows(pedidoId, detallesRaw) {
  if (!Array.isArray(detallesRaw) || detallesRaw.length === 0) return;
  const sqlDetalle = "INSERT INTO pedidos_detalles_miscelaneos (id_pedido, descripcion, concepto_detalle, unidad, medida, cantidad, precio_unitario, importe, clave, ml, acabado, kg, precio_x_kg) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
  for (const detalleRaw of detallesRaw) {
    const detalle = prepareDetalleForInsert(detalleRaw || {});
    const values = [
      pedidoId,
      detalle.descripcion,
      detalle.concepto_detalle,
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

export async function insertDetallesSegunFamilia(pedidoId, familia, detallesRaw, pedidoContext = {}, esAnticipo = false) {
  if (!Array.isArray(detallesRaw) || detallesRaw.length === 0) return;
  if (esAnticipo) {
    await insertAnticipoDetallesRows(pedidoId, detallesRaw);
    return;
  }
  const familiaVal = normalizeTextValue(familia).toUpperCase();
  if (familiaVal === "CR") {
    await insertCristalDetallesRows(pedidoId, detallesRaw);
    return;
  }
  if (familiaVal === "AL" || familiaVal === "MQAL") {
    await insertAluminioDetallesRows(pedidoId, detallesRaw, pedidoContext);
    return;
  }
  await insertPedidoDetallesRows(pedidoId, detallesRaw);
}

export async function calcularImporteDesdeDetalles(row, { includeSubtotal = false } = {}) {
  const pedidoId = Number(row?.id);
  if (!Number.isFinite(pedidoId) || pedidoId <= 0) return includeSubtotal ? { subtotal: 0, total: 0 } : 0;
  let table = "pedidos_detalles_miscelaneos";
  if (row?.es_anticipo) {
    table = "pedidos_detalles_anticipo";
  } else {
    const familia = normalizeTextValue(row?.familia).toUpperCase();
    if (familia === "CR") table = "pedidos_detalles_cristal";
    if (familia === "AL" || familia === "MQAL") table = "pedidos_detalles_aluminio";
  }
  const sumRows = await queryAsync(`SELECT SUM(importe) AS subtotal FROM ${table} WHERE id_pedido = ?`, [pedidoId]);
  const subtotal = Number(sumRows?.[0]?.subtotal || 0);
  const subtotalBase = Number(subtotal.toFixed(2));
  const salidaTlatilco = isSalidaTlatilco(row?.situaciones_especiales);
  const { mathPct } = normalizePct(row?.porcentaje_descuento);
  const descuentoMonto = subtotalBase * (mathPct / 100);
  const subtotalConDesc = subtotalBase - descuentoMonto;
  const ivaMonto = subtotalConDesc * 0.16;
  const totalMaterial = Number(Math.max(0, subtotalConDesc + ivaMonto).toFixed(2));
  const cubierto = Number(row?.monto_cubierto_anticipo || 0);
  const total = salidaTlatilco ? 0 : Number(Math.max(0, totalMaterial - cubierto).toFixed(2));
  if (includeSubtotal) return { subtotal: subtotalBase, total, totalMaterial };
  return total;
}

export async function getPedidosForRecalc(proyectoId) {
  return queryAsync(
    "SELECT id, familia, es_anticipo, situaciones_especiales, porcentaje_descuento, monto_cubierto_anticipo FROM pedidos WHERE id_proyecto = ?",
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

export async function proyectoExists(id) {
  const rows = await queryAsync("SELECT id_proyecto FROM proyectos WHERE id_proyecto = ? LIMIT 1", [id]);
  return Array.isArray(rows) && rows.length > 0;
}

export async function insertPedidoDirecto(values) {
  const sql = `INSERT INTO pedidos
    (id_proyecto, nombre_proyecto, pedido, clan, familia, es_anticipo, proveedor, fecha_aprobacion, concepto, situaciones_especiales, descripcion_general, porcentaje_descuento, moneda_aluminio, tipo_cambio, precio_aluminio_kg, precio_pintura_m2, importe_total, nombre_usuario, estado, fecha_levantado)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'levantado', NOW())`;
  return queryAsync(sql, values);
}

export async function getPedidoById(pedidoId) {
  const sql = `SELECT id, id_proyecto, nombre_proyecto, pedido, clan, familia, es_anticipo, proveedor,
      DATE_FORMAT(fecha_aprobacion, '%Y-%m-%d') AS fecha_aprobacion, concepto, situaciones_especiales,
      descripcion_general, porcentaje_descuento, moneda_aluminio, tipo_cambio, precio_aluminio_kg, precio_pintura_m2,
      importe_total AS importe, monto_cubierto_anticipo, nombre_usuario, estado, id_aprobador,
      DATE_FORMAT(fecha_levantado, '%Y-%m-%d %H:%i:%s') AS fecha_levantado,
      DATE_FORMAT(fecha_resolucion, '%Y-%m-%d %H:%i:%s') AS fecha_resolucion
    FROM pedidos WHERE id = ? LIMIT 1`;
  const rows = await queryAsync(sql, [pedidoId]);
  return rows && rows.length > 0 ? rows[0] : null;
}

export async function getDetallesSegunFamilia(pedidoId, familia, esAnticipo = false) {
  if (esAnticipo) return getDetallesAnticipo(pedidoId);
  const familiaVal = normalizeTextValue(familia).toUpperCase();
  if (familiaVal === "CR") return getDetallesCristal(pedidoId);
  if (familiaVal === "AL" || familiaVal === "MQAL") return getDetallesAluminio(pedidoId);
  return getDetallesMiscelaneos(pedidoId);
}

export async function deleteDetallesMiscelaneos(pedidoId) {
  return queryAsync("DELETE FROM pedidos_detalles_miscelaneos WHERE id_pedido = ?", [pedidoId]);
}

export async function deleteDetallesSegunFamilia(pedidoId, familia, esAnticipo = false) {
  if (esAnticipo) return deleteDetallesAnticipo(pedidoId);
  const familiaVal = normalizeTextValue(familia).toUpperCase();
  if (familiaVal === "CR") return deleteDetallesCristal(pedidoId);
  if (familiaVal === "AL" || familiaVal === "MQAL") return deleteDetallesAluminio(pedidoId);
  return deleteDetallesMiscelaneos(pedidoId);
}

export async function updatePedidoMetadata(pedidoId, fields) {
  const sql = `UPDATE pedidos SET pedido = ?, clan = ?, familia = ?, proveedor = ?, fecha_aprobacion = ?,
    concepto = ?, situaciones_especiales = ?, descripcion_general = ?, porcentaje_descuento = ?,
    moneda_aluminio = ?, tipo_cambio = ?, precio_aluminio_kg = ?, precio_pintura_m2 = ? WHERE id = ?`;
  const values = [
    fields.pedido,
    fields.clan,
    fields.familia,
    fields.proveedor,
    fields.fecha_aprobacion,
    fields.concepto,
    fields.situaciones_especiales,
    fields.descripcion_general,
    fields.porcentaje_descuento,
    fields.moneda_aluminio,
    fields.tipo_cambio,
    fields.precio_aluminio_kg,
    fields.precio_pintura_m2,
    pedidoId,
  ];
  return queryAsync(sql, values);
}

export async function updateEstado(pedidoId, estadoNuevo, idUsuario) {
  return queryAsync(
    "UPDATE pedidos SET estado = ?, id_aprobador = ?, fecha_resolucion = NOW() WHERE id = ?",
    [estadoNuevo, idUsuario, pedidoId]
  );
}

export async function insertHistorialEstado(pedidoId, estadoAnterior, estadoNuevo, idUsuario, comentario) {
  return queryAsync(
    "INSERT INTO pedidos_historial_estados (id_pedido, estado_anterior, estado_nuevo, id_usuario, comentario) VALUES (?, ?, ?, ?, ?)",
    [pedidoId, estadoAnterior || null, estadoNuevo, idUsuario, comentario || null]
  );
}

export async function getHistorialByPedido(pedidoId) {
  const sql = `SELECT h.id, h.id_pedido, h.estado_anterior, h.estado_nuevo, h.comentario,
      DATE_FORMAT(h.fecha_registro, '%Y-%m-%d %H:%i:%s') AS fecha_registro,
      u.nombre_usuario
    FROM pedidos_historial_estados h
    JOIN usuarios u ON u.id_usuario = h.id_usuario
    WHERE h.id_pedido = ?
    ORDER BY h.fecha_registro ASC, h.id ASC`;
  return queryAsync(sql, [pedidoId]);
}

export async function getSaldoAnticipo(pedidoAnticipoId) {
  const rows = await queryAsync(
    `SELECT p.importe_total AS monto_total, COALESCE(SUM(a.monto_aplicado), 0) AS monto_aplicado
     FROM pedidos p
     LEFT JOIN pedidos_anticipo_aplicaciones a ON a.id_pedido_anticipo = p.id
     WHERE p.id = ? AND p.es_anticipo = 1
     GROUP BY p.id, p.importe_total`,
    [pedidoAnticipoId]
  );
  const row = rows?.[0];
  if (!row) return null;
  const montoTotal = Number(row.monto_total || 0);
  const montoAplicado = Number(row.monto_aplicado || 0);
  return {
    monto_total: montoTotal,
    monto_aplicado: montoAplicado,
    saldo_disponible: Number(Math.max(0, montoTotal - montoAplicado).toFixed(2)),
  };
}

export async function listAnticiposDisponibles(idProyecto, familia) {
  const familiaVal = normalizeTextValue(familia).toUpperCase();
  const rows = await queryAsync(
    `SELECT p.id, p.pedido, p.proveedor, p.importe_total AS monto_total,
        COALESCE(SUM(a.monto_aplicado), 0) AS monto_aplicado
     FROM pedidos p
     LEFT JOIN pedidos_anticipo_aplicaciones a ON a.id_pedido_anticipo = p.id
     WHERE p.id_proyecto = ? AND p.es_anticipo = 1 AND p.estado = 'aprobado' AND UPPER(p.familia) = ?
     GROUP BY p.id, p.pedido, p.proveedor, p.importe_total
     HAVING (p.importe_total - COALESCE(SUM(a.monto_aplicado), 0)) > 0.001
     ORDER BY p.fecha_aprobacion ASC`,
    [idProyecto, familiaVal]
  );
  return (rows || []).map((r) => {
    const montoTotal = Number(r.monto_total || 0);
    const montoAplicado = Number(r.monto_aplicado || 0);
    return {
      id: r.id,
      pedido: r.pedido,
      proveedor: r.proveedor,
      monto_total: montoTotal,
      monto_aplicado: montoAplicado,
      saldo_disponible: Number(Math.max(0, montoTotal - montoAplicado).toFixed(2)),
    };
  });
}

export async function getAplicacionesByAnticipo(pedidoAnticipoId) {
  const sql = `SELECT a.id, a.id_pedido_destino, p.pedido AS pedido_destino, p.concepto AS concepto_destino,
      a.monto_aplicado, DATE_FORMAT(a.fecha_registro, '%Y-%m-%d %H:%i:%s') AS fecha_registro, u.nombre_usuario
    FROM pedidos_anticipo_aplicaciones a
    JOIN pedidos p ON p.id = a.id_pedido_destino
    JOIN usuarios u ON u.id_usuario = a.id_usuario
    WHERE a.id_pedido_anticipo = ?
    ORDER BY a.fecha_registro ASC`;
  return queryAsync(sql, [pedidoAnticipoId]);
}

export async function getAplicacionByDestino(pedidoDestinoId) {
  const sql = `SELECT a.id, a.id_pedido_anticipo, p.pedido AS pedido_anticipo, a.monto_aplicado,
      DATE_FORMAT(a.fecha_registro, '%Y-%m-%d %H:%i:%s') AS fecha_registro
    FROM pedidos_anticipo_aplicaciones a
    JOIN pedidos p ON p.id = a.id_pedido_anticipo
    WHERE a.id_pedido_destino = ?
    LIMIT 1`;
  const rows = await queryAsync(sql, [pedidoDestinoId]);
  return rows && rows.length > 0 ? rows[0] : null;
}

// Transacción atómica: valida saldo disponible del anticipo (con lock FOR UPDATE sobre ambos
// pedidos para evitar doble-gasto por dos requests concurrentes), registra/actualiza la
// aplicación (una sola fila mutable por pedido destino, ver UNIQUE(id_pedido_destino)) y
// recalcula importe_total/monto_cubierto_anticipo del pedido destino en la misma transacción.
export async function registrarAplicacionAnticipo({ idPedidoAnticipo, idPedidoDestino, montoAplicado, idUsuario }) {
  const monto = Number(montoAplicado);
  if (!Number.isFinite(monto) || monto <= 0) {
    throw Object.assign(new Error("El monto a aplicar debe ser mayor a 0"), { status: 400 });
  }
  return withTransaction(async (query) => {
    const anticipoRows = await query(
      "SELECT id, id_proyecto, familia, estado, importe_total FROM pedidos WHERE id = ? AND es_anticipo = 1 FOR UPDATE",
      [idPedidoAnticipo]
    );
    const anticipo = anticipoRows?.[0];
    if (!anticipo) throw Object.assign(new Error("Anticipo no encontrado"), { status: 404 });
    if (anticipo.estado !== "aprobado") {
      throw Object.assign(new Error("Solo se puede aplicar el saldo de un anticipo aprobado"), { status: 400 });
    }

    const destinoRows = await query(
      "SELECT id, id_proyecto, familia, es_anticipo, situaciones_especiales, porcentaje_descuento FROM pedidos WHERE id = ? FOR UPDATE",
      [idPedidoDestino]
    );
    const destino = destinoRows?.[0];
    if (!destino) throw Object.assign(new Error("Pedido no encontrado"), { status: 404 });
    if (destino.es_anticipo) {
      throw Object.assign(new Error("Un anticipo no puede aplicar el saldo de otro anticipo"), { status: 400 });
    }
    if (Number(destino.id_proyecto) !== Number(anticipo.id_proyecto)) {
      throw Object.assign(new Error("El anticipo pertenece a otro proyecto"), { status: 400 });
    }
    if (normalizeTextValue(destino.familia).toUpperCase() !== normalizeTextValue(anticipo.familia).toUpperCase()) {
      throw Object.assign(new Error("El anticipo es de otra familia de material"), { status: 400 });
    }

    const existenteRows = await query(
      "SELECT id, id_pedido_anticipo FROM pedidos_anticipo_aplicaciones WHERE id_pedido_destino = ? FOR UPDATE",
      [idPedidoDestino]
    );
    const existente = existenteRows?.[0];
    if (existente && Number(existente.id_pedido_anticipo) !== Number(idPedidoAnticipo)) {
      throw Object.assign(new Error("Este pedido ya tiene aplicado el saldo de otro anticipo"), { status: 409 });
    }

    const aplicadoAOtrosRows = await query(
      "SELECT COALESCE(SUM(monto_aplicado),0) AS total FROM pedidos_anticipo_aplicaciones WHERE id_pedido_anticipo = ? AND id_pedido_destino != ?",
      [idPedidoAnticipo, idPedidoDestino]
    );
    const aplicadoAOtros = Number(aplicadoAOtrosRows?.[0]?.total || 0);
    const saldoDisponible = Number((Number(anticipo.importe_total) - aplicadoAOtros).toFixed(2));
    if (monto > saldoDisponible + 0.005) {
      throw Object.assign(new Error(`El anticipo solo tiene ${saldoDisponible.toFixed(2)} disponibles`), { status: 400 });
    }

    const calcSinCubrir = await calcularImporteDesdeDetalles({ ...destino, monto_cubierto_anticipo: 0 }, { includeSubtotal: true });
    if (monto > calcSinCubrir.totalMaterial + 0.005) {
      throw Object.assign(new Error("El monto a aplicar no puede superar el valor del pedido"), { status: 400 });
    }

    if (existente) {
      await query("UPDATE pedidos_anticipo_aplicaciones SET monto_aplicado = ?, id_usuario = ? WHERE id = ?", [monto, idUsuario, existente.id]);
    } else {
      await query(
        "INSERT INTO pedidos_anticipo_aplicaciones (id_pedido_anticipo, id_pedido_destino, monto_aplicado, id_usuario) VALUES (?, ?, ?, ?)",
        [idPedidoAnticipo, idPedidoDestino, monto, idUsuario]
      );
    }

    const calcFinal = await calcularImporteDesdeDetalles({ ...destino, monto_cubierto_anticipo: monto }, { includeSubtotal: false });
    await query("UPDATE pedidos SET importe_total = ?, monto_cubierto_anticipo = ? WHERE id = ?", [calcFinal, monto, idPedidoDestino]);

    return { importe_total: calcFinal, monto_cubierto_anticipo: monto };
  });
}

export async function quitarAplicacionAnticipo({ idPedidoDestino }) {
  return withTransaction(async (query) => {
    const destinoRows = await query(
      "SELECT id, familia, es_anticipo, situaciones_especiales, porcentaje_descuento FROM pedidos WHERE id = ? FOR UPDATE",
      [idPedidoDestino]
    );
    const destino = destinoRows?.[0];
    if (!destino) throw Object.assign(new Error("Pedido no encontrado"), { status: 404 });
    await query("DELETE FROM pedidos_anticipo_aplicaciones WHERE id_pedido_destino = ?", [idPedidoDestino]);
    const calcFinal = await calcularImporteDesdeDetalles({ ...destino, monto_cubierto_anticipo: 0 }, { includeSubtotal: false });
    await query("UPDATE pedidos SET importe_total = ?, monto_cubierto_anticipo = 0 WHERE id = ?", [calcFinal, idPedidoDestino]);
    return { importe_total: calcFinal, monto_cubierto_anticipo: 0 };
  });
}

// Usado por actualizar() cuando se reemplaza el detalle de un pedido destino que ya tenía
// anticipo aplicado: si el nuevo valor del material es menor al monto ya cubierto, hace
// clamp de la aplicación y libera el excedente de vuelta al saldo del anticipo (la aplicación
// vive en pedidos_anticipo_aplicaciones, que es lo único que cuenta para el saldo del anticipo).
export async function reconciliarCoberturaAnticipo({ pedidoDestinoId, totalMaterial, salidaTlatilco }) {
  return withTransaction(async (query) => {
    const rows = await query(
      "SELECT id, monto_aplicado FROM pedidos_anticipo_aplicaciones WHERE id_pedido_destino = ? FOR UPDATE",
      [pedidoDestinoId]
    );
    const aplicacion = rows?.[0];
    let cubierto = aplicacion ? Number(aplicacion.monto_aplicado || 0) : 0;
    if (aplicacion && cubierto > totalMaterial) {
      const nuevoCubierto = Number(Math.max(0, totalMaterial).toFixed(2));
      if (nuevoCubierto <= 0) {
        await query("DELETE FROM pedidos_anticipo_aplicaciones WHERE id = ?", [aplicacion.id]);
      } else {
        await query("UPDATE pedidos_anticipo_aplicaciones SET monto_aplicado = ? WHERE id = ?", [nuevoCubierto, aplicacion.id]);
      }
      cubierto = nuevoCubierto;
    }
    const total = salidaTlatilco ? 0 : Number(Math.max(0, totalMaterial - cubierto).toFixed(2));
    await query("UPDATE pedidos SET importe_total = ?, monto_cubierto_anticipo = ? WHERE id = ?", [total, cubierto, pedidoDestinoId]);
    return { importe_total: total, monto_cubierto_anticipo: cubierto };
  });
}

// idUsuarioRestringido: id de cualquier usuario no-Superadmin (antes solo Supervisor) cuya
// visibilidad de proyectos debe respetarse; null = sin restricción (ej. Superadmin).
export async function getConteoPendientes(idUsuarioRestringido = null) {
  const sql = `SELECT COUNT(*) AS total FROM pedidos p
    WHERE p.estado = 'levantado'
    ${idUsuarioRestringido
      ? "AND p.id_proyecto IN (SELECT id_proyecto FROM supervisores_proyectos WHERE id_usuario = ?)"
      : ""}`;
  const rows = await queryAsync(sql, idUsuarioRestringido ? [idUsuarioRestringido] : []);
  return rows?.[0]?.total ?? 0;
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
