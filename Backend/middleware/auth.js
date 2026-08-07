import jwt from "jsonwebtoken";

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

const PUBLIC_ROUTES = ["/login"];

function globalAuth(req, res, next) {
  if (req.method === "OPTIONS") return next();
  if (PUBLIC_ROUTES.includes(req.path)) return next();
  return authenticateToken(req, res, next);
}

export { authenticateToken, requireRole, globalAuth, JWT_SECRET };
