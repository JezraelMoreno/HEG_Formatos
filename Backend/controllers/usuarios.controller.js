import * as UsuarioModel from "../models/usuario.model.js";
import { hashPassword } from "../helpers/password.js";
import { normalizeTextValue } from "../helpers/utils.js";

// Compatibilidad con el formulario actual del frontend (Frontend/src/pages/mainPage.tsx),
// que todavía envía estos 3 valores legado hasta que se actualice en semana 3.
const TIPO_USUARIO_LEGADO_A_ROL = {
  administrador: "Superadmin",
  contador: "Contador",
  visor: "Visor",
};

export async function listar(req, res) {
  try {
    const rows = await UsuarioModel.listUsuarios();
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("Error consultando usuarios:", err);
    return res.status(500).json({ success: false, message: "Error al obtener usuarios" });
  }
}

async function resolveRoleFromBody(body) {
  const { id_rol, rol, tipo_usuario } = body || {};
  if (id_rol !== undefined && id_rol !== null && id_rol !== "") {
    const idRolNum = Number(id_rol);
    if (!Number.isInteger(idRolNum) || idRolNum <= 0) return { error: "id_rol inválido" };
    const roleRow = await UsuarioModel.findRoleById(idRolNum);
    if (!roleRow) return { error: "Rol no encontrado" };
    return { roleRow };
  }
  const rolTexto = normalizeTextValue(rol) || normalizeTextValue(tipo_usuario);
  if (!rolTexto) return { error: "Falta el rol" };
  const nombreRol = TIPO_USUARIO_LEGADO_A_ROL[rolTexto.toLowerCase()] || rolTexto;
  const roleRow = await UsuarioModel.findRoleByName(nombreRol);
  if (!roleRow) return { error: "Rol no encontrado" };
  return { roleRow };
}

export async function crear(req, res) {
  try {
    const { nombre_usuario, contrasena } = req.body || {};
    const nombreUsuario = normalizeTextValue(nombre_usuario);
    if (!nombreUsuario || !contrasena) {
      return res.status(400).json({ success: false, message: "Faltan datos" });
    }
    const { roleRow, error } = await resolveRoleFromBody(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error });
    }
    const hash = await hashPassword(contrasena);
    await UsuarioModel.insertUsuario(nombreUsuario, hash, roleRow.id_rol);
    return res.status(201).json({ success: true, message: "Usuario creado correctamente" });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ success: false, message: "El nombre de usuario ya existe" });
    }
    console.error("Error creando usuario:", err);
    return res.status(500).json({ success: false, message: "Error al crear usuario" });
  }
}

export async function cambiarRol(req, res) {
  try {
    const idUsuario = Number(req.params.id);
    if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
      return res.status(400).json({ success: false, message: "Usuario inválido" });
    }
    if (!(await UsuarioModel.usuarioExists(idUsuario))) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    }
    const { roleRow, error } = await resolveRoleFromBody(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error });
    }
    await UsuarioModel.updateRol(idUsuario, roleRow.id_rol);
    return res.json({ success: true, message: "Rol actualizado correctamente" });
  } catch (err) {
    console.error("Error actualizando rol de usuario:", err);
    return res.status(500).json({ success: false, message: "Error al actualizar el rol" });
  }
}
