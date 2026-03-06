import { queryAsync } from "../config/db.js";

export async function getPresupuestos(proyectoId) {
  const sql = `
    SELECT
      id_presupuesto,
      familia,
      presupuesto_asignado,
      gastado,
      (presupuesto_asignado - gastado) AS restante
    FROM viaticos_presupuestos
    WHERE id_proyecto = ?
    ORDER BY FIELD(familia, 'Mano de Obra', 'Viáticos', 'Fletes', 'F.H.', 'Rentas Casa')
  `;
  return queryAsync(sql, [proyectoId]);
}

export async function upsertPresupuesto(proyectoId, familia, presupuesto, username) {
  const sql = `
    INSERT INTO viaticos_presupuestos (id_proyecto, familia, presupuesto_asignado, nombre_usuario)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      presupuesto_asignado = VALUES(presupuesto_asignado),
      nombre_usuario = VALUES(nombre_usuario)
  `;
  return queryAsync(sql, [proyectoId, familia, presupuesto, username]);
}

export async function getMovimientos(proyectoId, filters = {}) {
  let sql = `
    SELECT
      id_movimiento,
      familia,
      persona,
      concepto,
      clave_referencia,
      DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha,
      ingreso,
      egreso,
      saldo,
      nombre_usuario
    FROM viaticos_movimientos
    WHERE id_proyecto = ?
  `;
  const params = [proyectoId];
  if (filters.familia) {
    sql += " AND familia = ?";
    params.push(filters.familia);
  }
  if (filters.fecha_desde) {
    sql += " AND fecha >= ?";
    params.push(filters.fecha_desde);
  }
  if (filters.fecha_hasta) {
    sql += " AND fecha <= ?";
    params.push(filters.fecha_hasta);
  }
  sql += " ORDER BY fecha ASC, id_movimiento ASC";
  return queryAsync(sql, params);
}

export async function createMovimiento(proyectoId, data) {
  const sql = `
    INSERT INTO viaticos_movimientos
      (id_proyecto, familia, persona, concepto, clave_referencia, fecha, ingreso, egreso, nombre_usuario)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  return queryAsync(sql, [
    proyectoId, data.familia, data.persona, data.concepto,
    data.clave_referencia || null, data.fecha, data.ingreso, data.egreso, data.username
  ]);
}

export async function recalcularSaldos(proyectoId, familia) {
  return queryAsync("CALL sp_recalcular_saldos_viaticos(?, ?)", [proyectoId, familia]);
}

export async function getMovimientoFamilia(movimientoId, proyectoId) {
  const rows = await queryAsync(
    "SELECT familia FROM viaticos_movimientos WHERE id_movimiento = ? AND id_proyecto = ?",
    [movimientoId, proyectoId]
  );
  return rows && rows.length > 0 ? rows[0] : null;
}

export async function deleteMovimiento(movimientoId, proyectoId) {
  return queryAsync(
    "DELETE FROM viaticos_movimientos WHERE id_movimiento = ? AND id_proyecto = ?",
    [movimientoId, proyectoId]
  );
}

export async function getProyectoNombre(id) {
  const rows = await queryAsync("SELECT nombre FROM proyectos WHERE id_proyecto = ?", [id]);
  return rows && rows[0] ? rows[0].nombre : `Proyecto ${id}`;
}
