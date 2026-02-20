import { queryAsync } from "../config/db.js";

export async function findByUsername(nombre_usuario) {
  const sql = "SELECT * FROM usuarios WHERE nombre_usuario = ? LIMIT 1";
  const rows = await queryAsync(sql, [nombre_usuario]);
  return rows && rows.length > 0 ? rows[0] : null;
}
