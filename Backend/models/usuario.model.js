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

export async function updatePassword(idUsuario, hash) {
  return queryAsync("UPDATE usuarios SET contrasena = ? WHERE id_usuario = ?", [hash, idUsuario]);
}

export async function listUsuarios() {
  return queryAsync(
    `SELECT u.id_usuario, u.nombre_usuario, r.id_rol, r.nombre AS tipo_usuario
     FROM usuarios u
     JOIN roles r ON r.id_rol = u.id_rol
     ORDER BY u.nombre_usuario`
  );
}

export async function findRoleByName(nombre) {
  const rows = await queryAsync("SELECT id_rol, nombre FROM roles WHERE LOWER(nombre) = LOWER(?) LIMIT 1", [nombre]);
  return rows && rows.length > 0 ? rows[0] : null;
}

export async function findRoleById(idRol) {
  const rows = await queryAsync("SELECT id_rol, nombre FROM roles WHERE id_rol = ? LIMIT 1", [idRol]);
  return rows && rows.length > 0 ? rows[0] : null;
}

export async function insertUsuario(nombreUsuario, hash, idRol) {
  return queryAsync(
    "INSERT INTO usuarios (nombre_usuario, contrasena, id_rol) VALUES (?, ?, ?)",
    [nombreUsuario, hash, idRol]
  );
}

export async function usuarioExists(idUsuario) {
  const rows = await queryAsync("SELECT id_usuario FROM usuarios WHERE id_usuario = ? LIMIT 1", [idUsuario]);
  return Array.isArray(rows) && rows.length > 0;
}

export async function updateRol(idUsuario, idRol) {
  return queryAsync("UPDATE usuarios SET id_rol = ? WHERE id_usuario = ?", [idRol, idUsuario]);
}

export async function getRoleNombreByUsuarioId(idUsuario) {
  const rows = await queryAsync(
    "SELECT r.nombre FROM usuarios u JOIN roles r ON r.id_rol = u.id_rol WHERE u.id_usuario = ? LIMIT 1",
    [idUsuario]
  );
  return rows && rows.length > 0 ? rows[0].nombre : null;
}
