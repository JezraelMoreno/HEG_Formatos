import jwt from "jsonwebtoken";
import { findByUsername, updatePassword } from "../models/usuario.model.js";
import { JWT_SECRET } from "../middleware/auth.js";
import { verifyPassword, hashPassword } from "../helpers/password.js";

export async function login(req, res) {
  try {
    const { nombre_usuario, contrasena } = req.body || {};
    if (!nombre_usuario || !contrasena) {
      return res.status(400).json({ success: false, message: "Faltan datos" });
    }
    const user = await findByUsername(nombre_usuario);
    if (!user) {
      return res.status(401).json({ success: false, message: "Credenciales incorrectas" });
    }
    const { ok, needsRehash } = await verifyPassword(contrasena, user.contrasena);
    if (!ok) {
      return res.status(401).json({ success: false, message: "Credenciales incorrectas" });
    }
    if (needsRehash) {
      try {
        const newHash = await hashPassword(contrasena);
        await updatePassword(user.id_usuario, newHash);
      } catch (rehashErr) {
        console.error("No se pudo re-hashear la contraseña con bcrypt:", rehashErr);
      }
    }
    const roleVal = user.rol_nombre;
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
