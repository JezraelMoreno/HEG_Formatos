import jwt from "jsonwebtoken";
import { queryAsync } from "../config/db.js";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET no está definido. Configúralo en el entorno antes de arrancar el servidor.");
}

const JWT_SECRET = process.env.JWT_SECRET;

function authenticateToken(req, res, next) {
  if (req.user) return next();
  try {
    const auth = req.headers["authorization"] || req.headers["Authorization"];
    if (!auth || typeof auth !== "string" || !auth.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "No autorizado" });
    }
    const token = auth.slice("Bearer ".length);
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ success: false, message: "Token inválido o expirado" });
  }
}

function requireRole(...roles) {
  const allowed = roles.map(r => String(r).toLowerCase());
  return (req, res, next) => {
    const role = String((req.user && req.user.role) || "").toLowerCase();
    if (!role || (allowed.length && !allowed.includes(role))) {
      return res.status(403).json({ success: false, message: "Permisos insuficientes" });
    }
    next();
  };
}

async function supervisorTieneAcceso(idUsuario, idProyecto) {
  const rows = await queryAsync(
    "SELECT 1 FROM supervisores_proyectos WHERE id_usuario = ? AND id_proyecto = ? LIMIT 1",
    [idUsuario, idProyecto]
  );
  return Array.isArray(rows) && rows.length > 0;
}

// Para rutas con :pedidoId en la URL (no :id de proyecto). Si el rol es Supervisor, valida
// que tenga asignado (en supervisores_proyectos) el proyecto dueño de ese pedido antes de
// dejarlo pasar; cualquier otro rol permitido por el requireRole(...) previo pasa directo.
function requireProjectAccess(req, res, next) {
  const role = String((req.user && req.user.role) || "").toLowerCase();
  if (role !== "supervisor") return next();

  const pedidoId = Number(req.params.pedidoId);
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    return res.status(400).json({ success: false, message: "Pedido inválido" });
  }

  queryAsync("SELECT id_proyecto FROM pedidos WHERE id = ? LIMIT 1", [pedidoId])
    .then(async (rows) => {
      if (!rows || rows.length === 0) {
        return res.status(404).json({ success: false, message: "Pedido no encontrado" });
      }
      const acceso = await supervisorTieneAcceso(req.user.sub, rows[0].id_proyecto);
      if (!acceso) {
        return res.status(403).json({ success: false, message: "No tienes acceso a este proyecto" });
      }
      next();
    })
    .catch((err) => {
      console.error("Error validando acceso de supervisor:", err);
      res.status(500).json({ success: false, message: "Error validando acceso" });
    });
}

// Para rutas con :id de proyecto directo en la URL (ej. GET /proyectos/:id/pedidos). Mismo
// criterio que requireProjectAccess pero sin tener que resolver primero un pedido.
function requireProjectAccessByProyectoId(req, res, next) {
  const role = String((req.user && req.user.role) || "").toLowerCase();
  if (role !== "supervisor") return next();

  const proyectoId = Number(req.params.id);
  if (!Number.isInteger(proyectoId) || proyectoId <= 0) {
    return res.status(400).json({ success: false, message: "Proyecto inválido" });
  }

  supervisorTieneAcceso(req.user.sub, proyectoId)
    .then((acceso) => {
      if (!acceso) {
        return res.status(403).json({ success: false, message: "No tienes acceso a este proyecto" });
      }
      next();
    })
    .catch((err) => {
      console.error("Error validando acceso de supervisor:", err);
      res.status(500).json({ success: false, message: "Error validando acceso" });
    });
}

const PUBLIC_ROUTES = ["/login"];

function globalAuth(req, res, next) {
  if (req.method === "OPTIONS") return next();
  if (PUBLIC_ROUTES.includes(req.path)) return next();
  return authenticateToken(req, res, next);
}

export { authenticateToken, requireRole, requireProjectAccess, requireProjectAccessByProyectoId, globalAuth, JWT_SECRET };
