import { queryAsync } from "../config/db.js";

export async function listByProyecto(idProyecto) {
  const sql = `SELECT sp.id, sp.id_usuario, u.nombre_usuario, sp.fecha_asignacion
    FROM supervisores_proyectos sp
    JOIN usuarios u ON u.id_usuario = sp.id_usuario
    WHERE sp.id_proyecto = ?
    ORDER BY u.nombre_usuario ASC`;
  return queryAsync(sql, [idProyecto]);
}

export async function asignar(idProyecto, idUsuario) {
  return queryAsync(
    "INSERT INTO supervisores_proyectos (id_usuario, id_proyecto) VALUES (?, ?)",
    [idUsuario, idProyecto]
  );
}

export async function quitar(idProyecto, idUsuario) {
  return queryAsync(
    "DELETE FROM supervisores_proyectos WHERE id_proyecto = ? AND id_usuario = ?",
    [idProyecto, idUsuario]
  );
}

export async function misProyectos(idUsuario) {
  const sql = `SELECT p.id_proyecto, p.nombre, p.fecha_proyecto, p.estado
    FROM supervisores_proyectos sp
    JOIN proyectos p ON p.id_proyecto = sp.id_proyecto
    WHERE sp.id_usuario = ?
    ORDER BY p.nombre ASC`;
  return queryAsync(sql, [idUsuario]);
}

export async function proyectoExists(idProyecto) {
  const rows = await queryAsync("SELECT id_proyecto FROM proyectos WHERE id_proyecto = ? LIMIT 1", [idProyecto]);
  return Array.isArray(rows) && rows.length > 0;
}
