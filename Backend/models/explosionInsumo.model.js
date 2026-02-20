import { queryAsync } from "../config/db.js";
import {
  redondearMoneda,
  acumularGastoPorFamilia,
} from "../helpers/utils.js";

export async function obtenerContextoExplosion(proyectoId) {
  const proyectoRows = await queryAsync(
    "SELECT presupuesto_miscelaneos FROM proyectos WHERE id_proyecto = ? LIMIT 1",
    [proyectoId]
  );
  if (!Array.isArray(proyectoRows) || proyectoRows.length === 0) {
    throw new Error("Proyecto no encontrado");
  }
  const disponibleMiscelaneos = redondearMoneda(proyectoRows[0].presupuesto_miscelaneos);
  const pedidosRows = await queryAsync(
    "SELECT clan, familia, importe_total FROM pedidos WHERE id_proyecto = ?",
    [proyectoId]
  );
  const { gastoPorClave, gastoMiscelaneos } = acumularGastoPorFamilia(pedidosRows || []);
  const baseMiscelaneos = redondearMoneda(disponibleMiscelaneos + gastoMiscelaneos);
  const totRows = await queryAsync(
    "SELECT SUM(presupuesto_asignado) AS total FROM explosion_insumos WHERE id_proyecto = ?",
    [proyectoId]
  );
  const totalAsignado = redondearMoneda(totRows?.[0]?.total || 0);
  return {
    gastoPorClave,
    gastoMiscelaneos,
    baseMiscelaneos,
    totalAsignado,
    disponibleMiscelaneos,
  };
}

export async function findByProyecto(proyectoId) {
  return queryAsync(
    "SELECT id, clan, familia, presupuesto_asignado FROM explosion_insumos WHERE id_proyecto = ? ORDER BY id ASC",
    [proyectoId]
  );
}

export async function findExisting(proyectoId, clan, familia) {
  const rows = await queryAsync(
    "SELECT id FROM explosion_insumos WHERE id_proyecto = ? AND clan = ? AND familia = ? LIMIT 1",
    [proyectoId, clan, familia]
  );
  return Array.isArray(rows) && rows.length > 0;
}

export async function create(proyectoId, clan, familia, presupuesto) {
  return queryAsync(
    "INSERT INTO explosion_insumos (id_proyecto, clan, familia, presupuesto_asignado) VALUES (?, ?, ?, ?)",
    [proyectoId, clan, familia, presupuesto]
  );
}

export async function findById(explosionId, proyectoId) {
  const rows = await queryAsync(
    "SELECT id, presupuesto_asignado FROM explosion_insumos WHERE id = ? AND id_proyecto = ? LIMIT 1",
    [explosionId, proyectoId]
  );
  return rows && rows.length > 0 ? rows[0] : null;
}

export async function findDuplicate(proyectoId, clan, familia, excludeId) {
  const rows = await queryAsync(
    "SELECT id FROM explosion_insumos WHERE id_proyecto = ? AND clan = ? AND familia = ? AND id <> ? LIMIT 1",
    [proyectoId, clan, familia, excludeId]
  );
  return Array.isArray(rows) && rows.length > 0;
}

export async function update(explosionId, proyectoId, { clan, familia, presupuesto }) {
  return queryAsync(
    "UPDATE explosion_insumos SET clan = ?, familia = ?, presupuesto_asignado = ? WHERE id = ? AND id_proyecto = ?",
    [clan, familia, presupuesto, explosionId, proyectoId]
  );
}

export async function deleteById(explosionId, proyectoId) {
  return queryAsync("DELETE FROM explosion_insumos WHERE id = ? AND id_proyecto = ?", [explosionId, proyectoId]);
}
