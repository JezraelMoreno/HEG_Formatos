import * as SupervisorModel from "../models/supervisor.model.js";
import * as UsuarioModel from "../models/usuario.model.js";

export async function listar(req, res) {
  try {
    const idProyecto = Number(req.params.id);
    if (!Number.isInteger(idProyecto) || idProyecto <= 0) {
      return res.status(400).json({ success: false, message: "Proyecto inválido" });
    }
    const data = await SupervisorModel.listByProyecto(idProyecto);
    return res.json({ success: true, data });
  } catch (err) {
    console.error("Error listando supervisores del proyecto:", err);
    return res.status(500).json({ success: false, message: "Error al consultar supervisores" });
  }
}

export async function asignar(req, res) {
  try {
    const idProyecto = Number(req.params.id);
    if (!Number.isInteger(idProyecto) || idProyecto <= 0) {
      return res.status(400).json({ success: false, message: "Proyecto inválido" });
    }
    const idUsuario = Number(req.body?.id_usuario);
    if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
      return res.status(400).json({ success: false, message: "id_usuario inválido" });
    }
    if (!(await SupervisorModel.proyectoExists(idProyecto))) {
      return res.status(404).json({ success: false, message: "Proyecto no encontrado" });
    }
    if (!(await UsuarioModel.usuarioExists(idUsuario))) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    }
    const rolUsuario = await UsuarioModel.getRoleNombreByUsuarioId(idUsuario);
    if (String(rolUsuario || "").toLowerCase() !== "supervisor") {
      return res.status(400).json({ success: false, message: "El usuario debe tener el rol Supervisor" });
    }
    await SupervisorModel.asignar(idProyecto, idUsuario);
    return res.status(201).json({ success: true, message: "Supervisor asignado" });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ success: false, message: "Ese supervisor ya está asignado a este proyecto" });
    }
    console.error("Error asignando supervisor:", err);
    return res.status(500).json({ success: false, message: "Error al asignar supervisor" });
  }
}

export async function quitar(req, res) {
  try {
    const idProyecto = Number(req.params.id);
    const idUsuario = Number(req.params.idUsuario);
    if (!Number.isInteger(idProyecto) || idProyecto <= 0 || !Number.isInteger(idUsuario) || idUsuario <= 0) {
      return res.status(400).json({ success: false, message: "Parámetros inválidos" });
    }
    await SupervisorModel.quitar(idProyecto, idUsuario);
    return res.json({ success: true, message: "Asignación eliminada" });
  } catch (err) {
    console.error("Error quitando supervisor:", err);
    return res.status(500).json({ success: false, message: "Error al quitar la asignación" });
  }
}

export async function misProyectos(req, res) {
  try {
    const idUsuario = req.user?.sub;
    const data = await SupervisorModel.misProyectos(idUsuario);
    return res.json({ success: true, data });
  } catch (err) {
    console.error("Error consultando mis proyectos:", err);
    return res.status(500).json({ success: false, message: "Error al consultar proyectos asignados" });
  }
}
