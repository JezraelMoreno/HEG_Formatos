import { queryAsync } from "../config/db.js";

export async function findByUsername(nombre_usuario) {
  const sql = `
    SELECT u.*, r.nombre AS rol_nombre
    FROM usuarios u
    JOIN roles r ON r.id_rol = u.id_rol
    WHERE u.nombre_usuario = ?
    LIMIT 1
  `;
  const rows = await queryAsync(sql, [nombre_usuario]);
  return rows && rows.length > 0 ? rows[0] : null;
}
