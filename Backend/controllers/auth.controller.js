import crypto from "crypto";
import jwt from "jsonwebtoken";
import { findByUsername } from "../models/usuario.model.js";
import { JWT_SECRET } from "../middleware/auth.js";

export async function login(req, res) {
  try {
    const { nombre_usuario, contrasena } = req.body || {};
    if (!nombre_usuario || !contrasena) {
      return res.status(400).json({ success: false, message: "Faltan datos" });
    }
    const hash = crypto.createHash("sha256").update(contrasena).digest("hex");
    const user = await findByUsername(nombre_usuario);
    if (!user) {
      return res.status(401).json({ success: false, message: "Credenciales incorrectas" });
    }
    const stored = String(user.contrasena || "");
    const ok = stored === hash || stored.toLowerCase() === hash.toLowerCase() || stored === contrasena;
    if (!ok) {
      return res.status(401).json({ success: false, message: "Credenciales incorrectas" });
    }
    const roleVal = (user.tipo_usuario || user.rol || user.role || "contador");
    const payload = {
      sub: user.id_usuario || user.id || nombre_usuario,
      username: nombre_usuario,
      role: roleVal,
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "8h" });
    return res.json({ success: true, message: "Login exitoso", token, user: { username: nombre_usuario, role: payload.role } });
  } catch (err) {
    console.error("Error en login:", err);
    return res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}
