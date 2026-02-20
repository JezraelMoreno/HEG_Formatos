import { queryAsync } from "../config/db.js";
import {
  parseDateToISO,
  todayISO,
  parseBudgetValue,
  toFiniteNumber,
  normalizarFamiliaPresupuesto,
  PRESUPUESTO_FAMILIA_COL,
} from "../helpers/utils.js";

export async function findAll() {
  const sql = `
    SELECT
      p.id_proyecto,
      p.nombre,
      p.fecha_proyecto,
      p.estado,
      COALESCE(p.presupuesto_cristal, 0) AS presupuesto_cristal,
      COALESCE(p.presupuesto_aluminio, 0) AS presupuesto_aluminio,
      COALESCE(p.presupuesto_miscelaneos, 0) AS presupuesto_miscelaneos,
      COALESCE(
        NULLIF(p.presupuesto_total, 0),
        NULLIF(COALESCE(p.presupuesto_cristal, 0) + COALESCE(p.presupuesto_aluminio, 0) + COALESCE(p.presupuesto_miscelaneos, 0), 0),
        p.presupuesto,
        0
      ) AS presupuesto_total,
      COALESCE(
        NULLIF(p.presupuesto, 0),
        NULLIF(p.presupuesto_total, 0),
        NULLIF(COALESCE(p.presupuesto_cristal, 0) + COALESCE(p.presupuesto_aluminio, 0) + COALESCE(p.presupuesto_miscelaneos, 0), 0),
        0
      ) AS presupuesto,
      COALESCE(SUM(pe.importe_total), 0) AS total_pedidos,
      COALESCE(
        NULLIF(p.presupuesto_total, 0),
        NULLIF(COALESCE(p.presupuesto_cristal, 0) + COALESCE(p.presupuesto_aluminio, 0) + COALESCE(p.presupuesto_miscelaneos, 0), 0),
        p.presupuesto,
        0
      ) AS presupuesto_disponible
    FROM proyectos p
    LEFT JOIN pedidos pe ON pe.id_proyecto = p.id_proyecto
    GROUP BY p.id_proyecto, p.nombre, p.fecha_proyecto, p.estado, p.presupuesto, p.presupuesto_cristal, p.presupuesto_aluminio, p.presupuesto_miscelaneos, p.presupuesto_total
    ORDER BY p.id_proyecto DESC
  `;
  return queryAsync(sql);
}

export async function findById(id) {
  const sql = `
    SELECT
      p.id_proyecto,
      p.nombre,
      p.fecha_proyecto,
      p.estado,
      COALESCE(p.presupuesto_cristal, 0) AS presupuesto_cristal,
      COALESCE(p.presupuesto_aluminio, 0) AS presupuesto_aluminio,
      COALESCE(p.presupuesto_miscelaneos, 0) AS presupuesto_miscelaneos,
      COALESCE(
        NULLIF(p.presupuesto_total, 0),
        NULLIF(COALESCE(p.presupuesto_cristal, 0) + COALESCE(p.presupuesto_aluminio, 0) + COALESCE(p.presupuesto_miscelaneos, 0), 0),
        p.presupuesto,
        0
      ) AS presupuesto_total,
      COALESCE(
        NULLIF(p.presupuesto, 0),
        NULLIF(p.presupuesto_total, 0),
        NULLIF(COALESCE(p.presupuesto_cristal, 0) + COALESCE(p.presupuesto_aluminio, 0) + COALESCE(p.presupuesto_miscelaneos, 0), 0),
        0
      ) AS presupuesto,
      COALESCE(SUM(pe.importe_total), 0) AS total_pedidos,
      COALESCE(
        NULLIF(p.presupuesto_total, 0),
        NULLIF(COALESCE(p.presupuesto_cristal, 0) + COALESCE(p.presupuesto_aluminio, 0) + COALESCE(p.presupuesto_miscelaneos, 0), 0),
        p.presupuesto,
        0
      ) AS presupuesto_disponible
    FROM proyectos p
    LEFT JOIN pedidos pe ON pe.id_proyecto = p.id_proyecto
    WHERE p.id_proyecto = ?
    GROUP BY p.id_proyecto, p.nombre, p.fecha_proyecto, p.presupuesto, p.presupuesto_cristal, p.presupuesto_aluminio, p.presupuesto_miscelaneos, p.presupuesto_total
    LIMIT 1
  `;
  const rows = await queryAsync(sql, [id]);
  return rows && rows.length > 0 ? rows[0] : null;
}

export async function create({ nombre, fecha_proyecto, presupuestoCristal, presupuestoAluminio, presupuestoMiscelaneos, presupuestoTotal }) {
  const sql =
    "INSERT INTO proyectos (nombre, fecha_proyecto, presupuesto, presupuesto_cristal, presupuesto_aluminio, presupuesto_miscelaneos, presupuesto_total) VALUES (?, ?, ?, ?, ?, ?, ?)";
  return queryAsync(sql, [nombre, fecha_proyecto, presupuestoTotal, presupuestoCristal, presupuestoAluminio, presupuestoMiscelaneos, presupuestoTotal]);
}

export async function updateEstado(id, estado) {
  const sql = "UPDATE proyectos SET estado = ? WHERE id_proyecto = ?";
  return queryAsync(sql, [estado, id]);
}

export async function deleteById(id) {
  await queryAsync("DELETE FROM pedidos WHERE id_proyecto = ?", [id]);
  return queryAsync("DELETE FROM proyectos WHERE id_proyecto = ?", [id]);
}

export async function getBudgets(proyectoId) {
  const rows = await queryAsync(
    "SELECT presupuesto_cristal, presupuesto_aluminio, presupuesto_miscelaneos FROM proyectos WHERE id_proyecto = ? LIMIT 1",
    [proyectoId]
  );
  return rows && rows.length > 0 ? rows[0] : null;
}

export async function updateBudgets(proyectoId, { cristal, aluminio, miscelaneos, total }) {
  return queryAsync(
    `UPDATE proyectos
       SET presupuesto_cristal = ?, presupuesto_aluminio = ?, presupuesto_miscelaneos = ?,
           presupuesto_total = ?, presupuesto = ?
     WHERE id_proyecto = ?`,
    [cristal, aluminio, miscelaneos, total, total, proyectoId]
  );
}

export async function getBudgetHistory(proyectoId) {
  return queryAsync(
    `SELECT id_historial,
            DATE_FORMAT(fecha_presupuesto, '%Y-%m-%d') AS fecha_presupuesto,
            presupuesto_cristal,
            presupuesto_aluminio,
            presupuesto_miscelaneos,
            presupuesto_total
     FROM proyectos_presupuestos_historial
     WHERE id_proyecto = ?
     ORDER BY fecha_presupuesto DESC, id_historial DESC`,
    [proyectoId]
  );
}

export async function registrarHistorialPresupuesto(idProyecto, { fecha, presupuesto_cristal, presupuesto_aluminio, presupuesto_miscelaneos, presupuesto_total }) {
  const proyectoId = Number(idProyecto);
  if (!Number.isInteger(proyectoId) || proyectoId <= 0) return;
  const fechaISO = parseDateToISO(fecha) || todayISO();
  const cristal = parseBudgetValue(presupuesto_cristal, { allowNull: false });
  const aluminio = parseBudgetValue(presupuesto_aluminio, { allowNull: false });
  const miscelaneos = parseBudgetValue(presupuesto_miscelaneos, { allowNull: false });
  const total =
    parseBudgetValue(presupuesto_total, { allowNull: true }) ??
    Number(((cristal || 0) + (aluminio || 0) + (miscelaneos || 0)).toFixed(2));
  const sql = `INSERT INTO proyectos_presupuestos_historial (id_proyecto, fecha_presupuesto, presupuesto_cristal, presupuesto_aluminio, presupuesto_miscelaneos, presupuesto_total)
               VALUES (?, ?, ?, ?, ?, ?)`;
  await queryAsync(sql, [proyectoId, fechaISO, cristal || 0, aluminio || 0, miscelaneos || 0, total]);
}

export async function ajustarPresupuestoProyecto(idProyecto, familia, importe, { revert = false } = {}) {
  const proyectoId = Number(idProyecto);
  const monto = toFiniteNumber(importe);
  if (!Number.isInteger(proyectoId) || proyectoId <= 0 || monto === null) return;
  if (monto === 0) return;
  const tipoFamilia = normalizarFamiliaPresupuesto(familia);
  const columna = PRESUPUESTO_FAMILIA_COL[tipoFamilia];
  if (!columna) return;
  const deltaBase = revert ? monto : -monto;
  const delta = Number(deltaBase.toFixed(2));
  await queryAsync(
    `UPDATE proyectos SET ${columna} = COALESCE(${columna}, 0) + ? WHERE id_proyecto = ?`,
    [delta, proyectoId]
  );
  await queryAsync(
    `UPDATE proyectos
        SET presupuesto_total = COALESCE(presupuesto_cristal, 0) + COALESCE(presupuesto_aluminio, 0) + COALESCE(presupuesto_miscelaneos, 0),
            presupuesto = COALESCE(presupuesto_cristal, 0) + COALESCE(presupuesto_aluminio, 0) + COALESCE(presupuesto_miscelaneos, 0)
      WHERE id_proyecto = ?`,
    [proyectoId]
  );
}
