import dotenv from "dotenv";
dotenv.config();

import express from "express";
import mysql from "mysql2";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import ExcelJS from "exceljs";

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "change-me-dev-secret";

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));


// Servir assets estáticos (logo, etc.)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use("/assets", express.static(path.join(__dirname, "assets")));

// Conexión a MySQL
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

db.connect(err => {
  if (err) throw err;
  console.log("Conectado a la base de datos MySQL");
});

const queryAsync = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });

// Ruta de login (compatibilidad: acepta hash SHA-256 o texto plano)
app.post("/login", (req, res) => {
  const { nombre_usuario, contrasena } = req.body || {};
  if (!nombre_usuario || !contrasena) {
    return res.status(400).json({ success: false, message: "Faltan datos" });
  }
  const hash = crypto.createHash("sha256").update(contrasena).digest("hex");
  const q = "SELECT * FROM usuarios WHERE nombre_usuario = ? LIMIT 1";
  db.query(q, [nombre_usuario], (err, rows) => {
    if (err) {
      console.error("Error en la consulta MySQL:", err);
      return res.status(500).json({ success: false, message: "Error interno del servidor" });
    }
    if (!rows || rows.length === 0) {
      return res.status(401).json({ success: false, message: "Credenciales incorrectas" });
    }
    const user = rows[0] || {};
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
  });
});

// Ruta de login
app.post("/login", (req, res) => {
  const { nombre_usuario, contrasena } = req.body;

  if (!nombre_usuario || !contrasena) {
    return res.status(400).json({ success: false, message: "Faltan datos" });
  }

  // Hasheamos la contraseña recibida
  const hash = crypto.createHash("sha256").update(contrasena).digest("hex");

  const query =
    "SELECT * FROM usuarios WHERE nombre_usuario = ? AND contrasena = ?";
  console.log("Usuario:", nombre_usuario);
  console.log("Contraseña (hash):", hash);
  db.query(query, [nombre_usuario, hash], (err, results) => {
    if (err) {
      console.error("Error en la consulta MySQL:", err);
      return res
        .status(500)
        .json({ success: false, message: "Error interno del servidor" });
    }
    console.log("Resultados de MySQL:", results);

    if (results.length > 0) {
      const user = results[0] || {};
      const roleVal = (user.tipo_usuario || user.rol || user.role || "contador");
      const payload = {
        sub: user.id_usuario || user.id || nombre_usuario,
        username: nombre_usuario,
        role: roleVal,
      };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "8h" });
      return res.json({ success: true, message: "Login exitoso", token, user: { username: nombre_usuario, role: payload.role } });
    }
    return res
      .status(401)
      .json({ success: false, message: "Credenciales incorrectas" });
  });
});

// Middleware de autenticación con JWT
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

// Middleware global: todo requiere sesión iniciada excepto /login y preflight
const PUBLIC_ROUTES = ["/login"];
app.use((req, res, next) => {
  if (req.method === "OPTIONS") return next();
  if (PUBLIC_ROUTES.includes(req.path)) return next();
  return authenticateToken(req, res, next);
});

// Proyectos - listar
app.get("/proyectos", authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT
        p.id_proyecto,
        p.nombre,
        p.fecha_proyecto,
        p.estado,
        COALESCE(p.presupuesto_cristal, 0) AS presupuesto_cristal,
        COALESCE(p.presupuesto_aluminio, 0) AS presupuesto_aluminio,
        COALESCE(p.presupuesto_miscelaneos, 0) AS presupuesto_miscelaneos,
        COALESCE(
          NULLIF(p.presupuesto_total, 0),
          NULLIF(COALESCE(p.presupuesto_cristal, 0) + COALESCE(p.presupuesto_aluminio, 0) + COALESCE(p.presupuesto_miscelaneos, 0), 0),
          p.presupuesto,
          0
        ) AS presupuesto_total,
        COALESCE(
          NULLIF(p.presupuesto, 0),
          NULLIF(p.presupuesto_total, 0),
          NULLIF(COALESCE(p.presupuesto_cristal, 0) + COALESCE(p.presupuesto_aluminio, 0) + COALESCE(p.presupuesto_miscelaneos, 0), 0),
          0
        ) AS presupuesto,
        COALESCE(SUM(pe.importe_total), 0) AS total_pedidos,
        COALESCE(
          NULLIF(p.presupuesto_total, 0),
          NULLIF(COALESCE(p.presupuesto_cristal, 0) + COALESCE(p.presupuesto_aluminio, 0) + COALESCE(p.presupuesto_miscelaneos, 0), 0),
          p.presupuesto,
          0
        ) AS presupuesto_disponible
      FROM proyectos p
      LEFT JOIN pedidos pe ON pe.id_proyecto = p.id_proyecto
      GROUP BY p.id_proyecto, p.nombre, p.fecha_proyecto, p.estado, p.presupuesto, p.presupuesto_cristal, p.presupuesto_aluminio, p.presupuesto_miscelaneos, p.presupuesto_total
      ORDER BY p.id_proyecto DESC
    `;
    const results = await queryAsync(query);
    res.json({ success: true, data: results });
  } catch (err) {
    console.error("Error consultando proyectos:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
});

// Proyectos - crear
app.post("/proyectos", authenticateToken, async (req, res) => {
  try {
    const {
      nombre,
      fecha_proyecto,
      presupuesto_cristal,
      presupuesto_aluminio,
      presupuesto_miscelaneos,
      presupuesto,
    } = req.body || {};

    const parseBudget = (raw) => {
      if (raw === undefined || raw === null || String(raw).trim() === "") return null;
      const num = Number(raw);
      if (!Number.isFinite(num) || num < 0) return null;
      return Number(num.toFixed(2));
    };

    let presupuestoCristal = parseBudget(presupuesto_cristal);
    let presupuestoAluminio = parseBudget(presupuesto_aluminio);
    let presupuestoMiscelaneos = parseBudget(presupuesto_miscelaneos);

    const algunPresupuesto =
      presupuestoCristal !== null || presupuestoAluminio !== null || presupuestoMiscelaneos !== null;

    if (!algunPresupuesto) {
      const legado = parseBudget(presupuesto);
      if (legado !== null) {
        presupuestoMiscelaneos = legado;
      }
    }

    presupuestoCristal = presupuestoCristal ?? 0;
    presupuestoAluminio = presupuestoAluminio ?? 0;
    presupuestoMiscelaneos = presupuestoMiscelaneos ?? 0;

    const presupuestoTotal = Number((presupuestoCristal + presupuestoAluminio + presupuestoMiscelaneos).toFixed(2));
    if (!nombre || !fecha_proyecto || !Number.isFinite(presupuestoTotal) || presupuestoTotal < 0) {
      return res.status(400).json({ success: false, message: "Faltan datos o presupuestos inválidos" });
    }

    const query =
      "INSERT INTO proyectos (nombre, fecha_proyecto, presupuesto, presupuesto_cristal, presupuesto_aluminio, presupuesto_miscelaneos, presupuesto_total) VALUES (?, ?, ?, ?, ?, ?, ?)";
    const params = [
      nombre,
      fecha_proyecto,
      presupuestoTotal,
      presupuestoCristal,
      presupuestoAluminio,
      presupuestoMiscelaneos,
      presupuestoTotal,
    ];
    const result = await queryAsync(query, params);
    try {
      await registrarHistorialPresupuesto(result.insertId, {
        fecha: fecha_proyecto,
        presupuesto_cristal: presupuestoCristal,
        presupuesto_aluminio: presupuestoAluminio,
        presupuesto_miscelaneos: presupuestoMiscelaneos,
        presupuesto_total: presupuestoTotal,
      });
    } catch (histErr) {
      console.error("No se pudo registrar historial inicial de presupuesto:", histErr);
    }
    res.status(201).json({
      success: true,
      data: {
        id_proyecto: result.insertId,
        nombre,
        fecha_proyecto,
        presupuesto: presupuestoTotal,
        presupuesto_total: presupuestoTotal,
        presupuesto_cristal: presupuestoCristal,
        presupuesto_aluminio: presupuestoAluminio,
        presupuesto_miscelaneos: presupuestoMiscelaneos,
      },
    });
  } catch (err) {
    console.error("Error creando proyecto:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
});

// Proyectos - actualizar estado
app.patch("/proyectos/:id/estado", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    if (!estado || !['en_progreso', 'completado'].includes(estado)) {
      return res.status(400).json({
        success: false,
        message: "Estado inválido. Debe ser 'en_progreso' o 'completado'"
      });
    }

    const query = "UPDATE proyectos SET estado = ? WHERE id_proyecto = ?";
    const result = await queryAsync(query, [estado, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Proyecto no encontrado" });
    }

    res.json({
      success: true,
      message: `Estado actualizado a '${estado}'`,
      estado
    });
  } catch (err) {
    console.error("Error actualizando estado del proyecto:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
});

app.delete("/proyectos/:id", authenticateToken, requireRole("administrador"), (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ success: false, message: "Proyecto no especificado" });
  }
  db.query("DELETE FROM pedidos WHERE id_proyecto = ?", [id], (errPedidos) => {
    if (errPedidos) {
      console.error("Error eliminando pedidos del proyecto:", errPedidos);
      return res.status(500).json({ success: false, message: "No se pudo limpiar pedidos del proyecto" });
    }
    // Las tablas cobranza_proyecto y cobranza_facturas se eliminan automáticamente por ON DELETE CASCADE
    db.query("DELETE FROM proyectos WHERE id_proyecto = ?", [id], (errProyecto, result) => {
      if (errProyecto) {
        console.error("Error eliminando proyecto:", errProyecto);
        return res.status(500).json({ success: false, message: "No se pudo eliminar el proyecto" });
      }
      if (!result || result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: "Proyecto no encontrado" });
      }
      return res.json({ success: true, message: "Proyecto eliminado correctamente" });
    });
  });
});

// Proyectos - obtener uno por id
app.get("/proyectos/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const query = `
      SELECT
        p.id_proyecto,
        p.nombre,
        p.fecha_proyecto,
        p.estado,
        COALESCE(p.presupuesto_cristal, 0) AS presupuesto_cristal,
        COALESCE(p.presupuesto_aluminio, 0) AS presupuesto_aluminio,
        COALESCE(p.presupuesto_miscelaneos, 0) AS presupuesto_miscelaneos,
        COALESCE(
          NULLIF(p.presupuesto_total, 0),
          NULLIF(COALESCE(p.presupuesto_cristal, 0) + COALESCE(p.presupuesto_aluminio, 0) + COALESCE(p.presupuesto_miscelaneos, 0), 0),
          p.presupuesto,
          0
        ) AS presupuesto_total,
        COALESCE(
          NULLIF(p.presupuesto, 0),
          NULLIF(p.presupuesto_total, 0),
          NULLIF(COALESCE(p.presupuesto_cristal, 0) + COALESCE(p.presupuesto_aluminio, 0) + COALESCE(p.presupuesto_miscelaneos, 0), 0),
          0
        ) AS presupuesto,
        COALESCE(SUM(pe.importe_total), 0) AS total_pedidos,
        COALESCE(
          NULLIF(p.presupuesto_total, 0),
          NULLIF(COALESCE(p.presupuesto_cristal, 0) + COALESCE(p.presupuesto_aluminio, 0) + COALESCE(p.presupuesto_miscelaneos, 0), 0),
          p.presupuesto,
          0
        ) AS presupuesto_disponible
      FROM proyectos p
      LEFT JOIN pedidos pe ON pe.id_proyecto = p.id_proyecto
      WHERE p.id_proyecto = ?
      GROUP BY p.id_proyecto, p.nombre, p.fecha_proyecto, p.presupuesto, p.presupuesto_cristal, p.presupuesto_aluminio, p.presupuesto_miscelaneos, p.presupuesto_total
      LIMIT 1
    `;
    const results = await queryAsync(query, [id]);
    if (!results || results.length === 0) {
      return res.status(404).json({ success: false, message: "No encontrado" });
    }
    const proyecto = results[0];
    const presupuestoCristal = Number(proyecto.presupuesto_cristal || 0);
    const presupuestoAluminio = Number(proyecto.presupuesto_aluminio || 0);
    const presupuestoMiscelaneos = Number(proyecto.presupuesto_miscelaneos || 0);
    let presupuestoTotal = Number(proyecto.presupuesto_total || 0);
    if (!Number.isFinite(presupuestoTotal) || presupuestoTotal === 0) {
      presupuestoTotal = Number((presupuestoCristal + presupuestoAluminio + presupuestoMiscelaneos).toFixed(2));
    }
    const baseProyecto = {
      ...proyecto,
      presupuesto_cristal: presupuestoCristal,
      presupuesto_aluminio: presupuestoAluminio,
      presupuesto_miscelaneos: presupuestoMiscelaneos,
      presupuesto_total: presupuestoTotal,
      presupuesto: Number(proyecto.presupuesto ?? presupuestoTotal ?? 0),
      presupuesto_disponible: presupuestoTotal,
    };
    try {
      const pedidosRows = await queryAsync(
        "SELECT id, familia, situaciones_especiales, porcentaje_descuento FROM pedidos WHERE id_proyecto = ?",
        [id]
      );
      let totalRecalc = 0;
      for (const row of pedidosRows || []) {
        const importe = await calcularImporteDesdeDetalles(row, { includeSubtotal: false });
        totalRecalc += Number(importe || 0);
      }
      const totalFix = Number(totalRecalc.toFixed(2));
      res.json({
        success: true,
        data: {
          ...baseProyecto,
          total_pedidos: totalFix,
        },
      });
    } catch (calcErr) {
      console.error("Error recalculando totales del proyecto:", calcErr);
      res.json({ success: true, data: baseProyecto });
    }
  } catch (err) {
    console.error("Error consultando proyecto:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
});

// Proyectos - actualizar presupuestos por familia y registrar historial
app.put("/proyectos/:id/presupuesto", authenticateToken, requireRole("administrador"), async (req, res) => {
  try {
    const { id } = req.params;
    const proyectoId = Number(id);
    if (!Number.isInteger(proyectoId) || proyectoId <= 0) {
      return res.status(400).json({ success: false, message: "Proyecto inválido" });
    }
    const { presupuesto_cristal, presupuesto_aluminio, presupuesto_miscelaneos, fecha_presupuesto } = req.body || {};
    const existentes = await queryAsync(
      "SELECT presupuesto_cristal, presupuesto_aluminio, presupuesto_miscelaneos FROM proyectos WHERE id_proyecto = ? LIMIT 1",
      [proyectoId]
    );
    if (!Array.isArray(existentes) || existentes.length === 0) {
      return res.status(404).json({ success: false, message: "Proyecto no encontrado" });
    }
    const actuales = existentes[0];
    const cristal = parseBudgetValue(presupuesto_cristal) ?? Number(actuales.presupuesto_cristal || 0);
    const aluminio = parseBudgetValue(presupuesto_aluminio) ?? Number(actuales.presupuesto_aluminio || 0);
    const miscelaneos = parseBudgetValue(presupuesto_miscelaneos) ?? Number(actuales.presupuesto_miscelaneos || 0);
    if (![cristal, aluminio, miscelaneos].every((v) => Number.isFinite(v) && v >= 0)) {
      return res.status(400).json({ success: false, message: "Presupuestos inválidos" });
    }
    const total = Number((cristal + aluminio + miscelaneos).toFixed(2));
    await queryAsync(
      `UPDATE proyectos
         SET presupuesto_cristal = ?, presupuesto_aluminio = ?, presupuesto_miscelaneos = ?,
             presupuesto_total = ?, presupuesto = ?
       WHERE id_proyecto = ?`,
      [cristal, aluminio, miscelaneos, total, total, proyectoId]
    );
    try {
      await registrarHistorialPresupuesto(proyectoId, {
        fecha: fecha_presupuesto,
        presupuesto_cristal: cristal,
        presupuesto_aluminio: aluminio,
        presupuesto_miscelaneos: miscelaneos,
        presupuesto_total: total,
      });
    } catch (histErr) {
      console.error("No se pudo registrar historial de cambio de presupuesto:", histErr);
    }
    return res.json({
      success: true,
      data: {
        id_proyecto: proyectoId,
        presupuesto_cristal: cristal,
        presupuesto_aluminio: aluminio,
        presupuesto_miscelaneos: miscelaneos,
        presupuesto_total: total,
        presupuesto: total,
      },
    });
  } catch (err) {
    console.error("Error actualizando presupuesto del proyecto:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
});

// Proyectos - historial de presupuestos
app.get("/proyectos/:id/presupuestos/historial", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const proyectoId = Number(id);
    if (!Number.isInteger(proyectoId) || proyectoId <= 0) {
      return res.status(400).json({ success: false, message: "Proyecto inválido" });
    }
    const rows = await queryAsync(
      `SELECT id_historial,
              DATE_FORMAT(fecha_presupuesto, '%Y-%m-%d') AS fecha_presupuesto,
              presupuesto_cristal,
              presupuesto_aluminio,
              presupuesto_miscelaneos,
              presupuesto_total
       FROM proyectos_presupuestos_historial
       WHERE id_proyecto = ?
       ORDER BY fecha_presupuesto DESC, id_historial DESC`,
      [proyectoId]
    );
    res.json({ success: true, data: rows || [] });
  } catch (err) {
    console.error("Error consultando historial de presupuestos:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
});

// Pedidos - listar por proyecto
app.get("/proyectos/:id/pedidos", authenticateToken, requireRole("administrador"), (req, res) => {
  const { id } = req.params;
  const { familia } = req.query;
  let query =
    "SELECT id, id_proyecto, nombre_proyecto, pedido, clan, familia, proveedor, nombre_usuario, DATE_FORMAT(fecha_aprobacion, '%Y-%m-%d') AS fecha_aprobacion, concepto, situaciones_especiales, porcentaje_descuento, importe_total AS importe FROM pedidos WHERE id_proyecto = ?";
  const params = [id];
  const toList = (v) => Array.isArray(v) ? v : (typeof v === 'string' ? v.split(',').map(s=>s.trim()).filter(Boolean) : []);
  const addMulti = (field, values) => {
    const list = toList(values);
    if (list.length === 1) { query += ` AND ${field} = ?`; params.push(list[0]); }
    else if (list.length > 1) { query += ` AND ${field} IN (${list.map(_=>'?').join(',')})`; params.push(...list); }
  };
  addMulti('familia', familia);
  const { clan, proveedor, concepto, fecha } = req.query;
  addMulti('clan', clan);
  addMulti('proveedor', proveedor);
  if (concepto && String(concepto).trim() !== "") {
    query += " AND concepto = ?";
    params.push(String(concepto));
  }
  if (fecha && String(fecha).trim() !== "") {
    query += " AND DATE(fecha_aprobacion) = ?";
    params.push(String(fecha));
  }
  query += " ORDER BY id ASC";
  db.query(query, params, async (err, results) => {
    if (err) {
      console.error("Error consultando pedidos:", err);
      return res
        .status(500)
        .json({ success: false, message: "Error interno del servidor" });
    }
    try {
      const rows = Array.isArray(results) ? results : [];
      const data = await Promise.all(
        rows.map(async (row) => {
          let importe = Number(row.importe || 0);
          try {
            const calc = await calcularImporteDesdeDetalles(row, { includeSubtotal: true });
            if (
              !Number.isFinite(importe) ||
              importe <= 0 ||
              (calc.subtotal > 0 && importe < calc.subtotal * 1.15)
            ) {
              importe = calc.total;
            }
          } catch (calcErr) {
            console.error("Error recalculando importe de pedido:", calcErr);
          }
          return { ...row, importe };
        })
      );
      res.json({ success: true, data });
    } catch (calcErr) {
      console.error("Error procesando pedidos:", calcErr);
      res.json({ success: true, data: results || [] });
    }
  });
});

// Pedidos - resumen por fecha de carga
app.get("/pedidos/resumen", authenticateToken, requireRole("administrador"), async (req, res) => {
  try {
    const rawFecha = typeof req.query.fecha === "string" ? req.query.fecha.trim() : "";
    const rawUsuario = typeof req.query.usuario === "string" ? req.query.usuario.trim() : "";
    const today = new Date();
    const todayIso = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
    const fechaFiltro = parseDateToISO(rawFecha) || todayIso;
    let query = `
      SELECT
        p.id,
        p.nombre_proyecto,
        p.pedido,
        p.nombre_usuario,
        DATE_FORMAT(COALESCE(pd.fecha_subida, p.fecha_aprobacion), '%Y-%m-%d') AS fecha_subida
      FROM pedidos p
      LEFT JOIN (
        SELECT id_pedido, MIN(fecha_registro) AS fecha_subida
        FROM (
          SELECT id_pedido, fecha_registro FROM pedidos_detalles_miscelaneos
          UNION ALL
          SELECT id_pedido, fecha_registro FROM pedidos_detalles_cristal
          UNION ALL
          SELECT id_pedido, fecha_registro FROM pedidos_detalles_aluminio
        ) detalles
        GROUP BY id_pedido
      ) pd ON pd.id_pedido = p.id
      WHERE 1 = 1
    `;
    const params = [];
    if (fechaFiltro) {
      query += " AND DATE(COALESCE(pd.fecha_subida, p.fecha_aprobacion)) = ?";
      params.push(fechaFiltro);
    }
    if (rawUsuario) {
      query += " AND p.nombre_usuario = ?";
      params.push(rawUsuario);
    }
    query += " ORDER BY p.id DESC";

    const rows = await queryAsync(query, params);
    const usuariosRows = await queryAsync("SELECT DISTINCT nombre_usuario FROM pedidos ORDER BY nombre_usuario ASC");
    res.json({
      success: true,
      data: rows || [],
      usuarios: (usuariosRows || []).map((row) => row.nombre_usuario).filter(Boolean),
      fechaFiltro,
    });
  } catch (err) {
    console.error("Error consultando resumen de pedidos:", err);
    res.status(500).json({ success: false, message: "Error interno al cargar pedidos" });
  }
});

// Pedidos - detalles por pedido
app.get("/pedidos/:pedidoId/detalles", authenticateToken, requireRole("administrador"), (req, res) => {
  const pedidoId = Number(req.params.pedidoId);
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    return res.status(400).json({ success: false, message: "Pedido inválido" });
  }
  const sqlDetalles = `SELECT id_detalle, id_pedido, descripcion, unidad, medida, cantidad, precio_unitario, importe, clave, ml, acabado, kg, precio_x_kg
                       FROM pedidos_detalles_miscelaneos
                       WHERE id_pedido = ?
                       ORDER BY id_detalle ASC`;
  db.query(sqlDetalles, [pedidoId], (err, rows) => {
    if (err) {
      console.error("Error consultando detalles:", err);
      return res.status(500).json({ success: false, message: "Error consultando detalles del pedido" });
    }
    const data = (rows || []).map((r) => ({
      id_detalle: r.id_detalle,
      id_pedido: r.id_pedido,
      descripcion: r.descripcion,
      unidad: r.unidad,
      medida: r.medida,
      cantidad: Number(r.cantidad || 0),
      precio_unitario: Number(r.precio_unitario || 0),
      importe: Number(r.importe || 0),
      clave: r.clave,
      ml: decimalOrNull(r.ml),
      acabado: r.acabado,
      kg: decimalOrNull(r.kg),
      precio_x_kg: decimalOrNull(r.precio_x_kg),
    }));
    return res.json({ success: true, data });
  });
});

app.get("/pedidos/:pedidoId/detalles-cristal", authenticateToken, requireRole("administrador"), (req, res) => {
  const pedidoId = Number(req.params.pedidoId);
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    return res.status(400).json({ success: false, message: "Pedido inválido" });
  }
  const sql = `SELECT id_detalle, id_pedido, descripcion, clave_modelo, ancho, largo, m2_corte, piezas, m2_pedido, precio_unitario, importe
               FROM pedidos_detalles_cristal
               WHERE id_pedido = ?
               ORDER BY id_detalle ASC`;
  db.query(sql, [pedidoId], (err, rows) => {
    if (err) {
      console.error("Error consultando detalles de cristal:", err);
      return res.status(500).json({ success: false, message: "Error consultando detalles de cristal" });
    }
    const data = (rows || []).map((r) => ({
      id_detalle: r.id_detalle,
      id_pedido: r.id_pedido,
      descripcion: r.descripcion,
      clave_modelo: r.clave_modelo,
      ancho: decimalOrNull(r.ancho),
      largo: decimalOrNull(r.largo),
      m2_corte: decimalOrNull(r.m2_corte),
      piezas: Number(r.piezas || 0),
      m2_pedido: decimalOrNull(r.m2_pedido),
      precio_unitario: Number(r.precio_unitario || 0),
      importe: Number(r.importe || 0),
    }));
    return res.json({ success: true, data });
  });
});

app.post("/pedidos/:pedidoId/detalles-cristal", authenticateToken, requireRole("administrador"), async (req, res) => {
  try {
    const pedidoId = Number(req.params.pedidoId);
    if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
      return res.status(400).json({ success: false, message: "Pedido inválido" });
    }
    const { detalles, reemplazar = true } = req.body || {};
    if (!Array.isArray(detalles) || detalles.length === 0) {
      return res.status(400).json({ success: false, message: "No hay detalles de cristal para registrar" });
    }
    const pedidoRows = await queryAsync("SELECT id FROM pedidos WHERE id = ? LIMIT 1", [pedidoId]);
    if (!Array.isArray(pedidoRows) || pedidoRows.length === 0) {
      return res.status(404).json({ success: false, message: "Pedido no encontrado" });
    }
    if (reemplazar !== false) {
      await queryAsync("DELETE FROM pedidos_detalles_cristal WHERE id_pedido = ?", [pedidoId]);
    }
    const inserted = await insertCristalDetallesRows(pedidoId, detalles);
    return res.json({
      success: inserted > 0,
      inserted,
      message: `Detalles de cristal registrados: ${inserted}`,
    });
  } catch (err) {
    console.error("Error guardando detalles de cristal:", err);
    return res.status(500).json({ success: false, message: "Error guardando detalles de cristal" });
  }
});

app.get("/pedidos/:pedidoId/detalles-aluminio", authenticateToken, requireRole("administrador"), (req, res) => {
  const pedidoId = Number(req.params.pedidoId);
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    return res.status(400).json({ success: false, message: "Pedido inválido" });
  }
  const sql = `SELECT id_detalle, id_pedido, numero_perfil, descripcion, medida_tramo, unidad, peso_kg_ml, perimetro_m2_ml, acabado, total_tramos, ml, kg, m2, importe
               FROM pedidos_detalles_aluminio
               WHERE id_pedido = ?
               ORDER BY id_detalle ASC`;
  db.query(sql, [pedidoId], (err, rows) => {
    if (err) {
      console.error("Error consultando detalles de aluminio:", err);
      return res.status(500).json({ success: false, message: "Error consultando detalles de aluminio" });
    }
    const data = (rows || []).map((r) => ({
      id_detalle: r.id_detalle,
      id_pedido: r.id_pedido,
      numero_perfil: r.numero_perfil,
      descripcion: r.descripcion,
      medida_tramo: decimalOrNull(r.medida_tramo),
      unidad: r.unidad,
      peso_kg_ml: decimalOrNull(r.peso_kg_ml),
      perimetro_m2_ml: decimalOrNull(r.perimetro_m2_ml),
      acabado: r.acabado,
      total_tramos: r.total_tramos !== null && r.total_tramos !== undefined ? Number(r.total_tramos) : null,
      ml: decimalOrNull(r.ml),
      kg: decimalOrNull(r.kg),
      m2: decimalOrNull(r.m2),
      importe: Number(r.importe || 0),
    }));
    return res.json({ success: true, data });
  });
});

app.post("/pedidos/:pedidoId/detalles-aluminio", authenticateToken, requireRole("administrador"), async (req, res) => {
  try {
    const pedidoId = Number(req.params.pedidoId);
    if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
      return res.status(400).json({ success: false, message: "Pedido inválido" });
    }
    const { detalles, reemplazar = true } = req.body || {};
    if (!Array.isArray(detalles) || detalles.length === 0) {
      return res.status(400).json({ success: false, message: "No hay detalles de aluminio para registrar" });
    }
    const pedidoRows = await queryAsync("SELECT id FROM pedidos WHERE id = ? LIMIT 1", [pedidoId]);
    if (!Array.isArray(pedidoRows) || pedidoRows.length === 0) {
      return res.status(404).json({ success: false, message: "Pedido no encontrado" });
    }
    if (reemplazar !== false) {
      await queryAsync("DELETE FROM pedidos_detalles_aluminio WHERE id_pedido = ?", [pedidoId]);
    }
    const inserted = await insertAluminioDetallesRows(pedidoId, detalles);
    return res.json({
      success: inserted > 0,
      inserted,
      message: `Detalles de aluminio registrados: ${inserted}`,
    });
  } catch (err) {
    console.error("Error guardando detalles de aluminio:", err);
    return res.status(500).json({ success: false, message: "Error guardando detalles de aluminio" });
  }
});


// Pedidos - exportar a XLSX con logo y estilos
app.get("/proyectos/:id/pedidos/export", authenticateToken, requireRole("administrador"), (req, res) => {
  const { id } = req.params;
  const { familia } = req.query;
  const qProyecto = "SELECT nombre FROM proyectos WHERE id_proyecto = ?";
  let qPedidos =
    "SELECT id, nombre_proyecto, pedido, clan, familia, proveedor, DATE_FORMAT(fecha_aprobacion, '%Y-%m-%d') AS fecha_aprobacion, concepto, situaciones_especiales, importe_total AS importe FROM pedidos WHERE id_proyecto = ?";
  const pedidosParams = [id];
  const toListE = (v) => Array.isArray(v) ? v : (typeof v === 'string' ? v.split(',').map(s=>s.trim()).filter(Boolean) : []);
  const addMultiE = (field, values) => {
    const list = toListE(values);
    if (list.length === 1) { qPedidos += ` AND ${field} = ?`; pedidosParams.push(list[0]); }
    else if (list.length > 1) { qPedidos += ` AND ${field} IN (${list.map(_=>'?').join(',')})`; pedidosParams.push(...list); }
  };
  addMultiE('familia', familia);
  const { clan, proveedor, concepto, fecha } = req.query;
  addMultiE('clan', clan);
  addMultiE('proveedor', proveedor);
  if (concepto && String(concepto).trim() !== "") {
    qPedidos += " AND concepto = ?";
    pedidosParams.push(String(concepto));
  }
  if (fecha && String(fecha).trim() !== "") {
    qPedidos += " AND DATE(fecha_aprobacion) = ?";
    pedidosParams.push(String(fecha));
  }
  qPedidos += " ORDER BY id ASC";

  db.query(qProyecto, [id], (e1, projRows) => {
    if (e1) {
      console.error(e1);
      return res.status(500).json({ success: false, message: "Error consultando proyecto" });
    }
    const nombreProyecto = projRows && projRows[0] ? projRows[0].nombre : `Proyecto ${id}`;

    db.query(qPedidos, pedidosParams, async (e2, pedidos) => {
      if (e2) {
        console.error(e2);
        return res.status(500).json({ success: false, message: "Error consultando pedidos" });
      }

      try {
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet("Explosión");

        // Insertar logo si existe
        try {
          const logoPath = path.join(__dirname, "assets", "heg_logo.jpg");
          const imgId = wb.addImage({ filename: logoPath, extension: "jpeg" });
          ws.addImage(imgId, {
            tl: { col: 0, row: 0 },
            ext: { width: 220, height: 80 },
          });
        } catch (imgErr) {
          // si falta la imagen, continuamos sin ella
          console.warn("No se pudo cargar el logo:", imgErr?.message || imgErr);
        }

        // Título con fecha de generación
        const now = new Date();
        const fechaGeneracion = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
        const titleRow = ws.getRow(5);
        const filtroText = familia && String(familia).trim() !== "" ? ` - Familia: ${familia}` : "";
        titleRow.getCell(1).value = `Explosión de insumos - ${nombreProyecto}${filtroText} - ${fechaGeneracion}`;
        titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: "FF333333" } };
        ws.mergeCells(5, 1, 5, 11);

        // Encabezados (debajo del logo y título)
        const headerRowIndex = 7;
        // Definir columnas sin 'header' para evitar cabeceras automáticas
        const columns = [
          { key: "id", width: 8 },
          { key: "nombre_proyecto", width: 30 },
          { key: "pedido", width: 12 },
          { key: "clan", width: 12 },
          { key: "familia", width: 10 },
          { key: "proveedor", width: 18 },
          { key: "fecha_aprobacion", width: 16 },
          { key: "concepto", width: 18 },
          { key: "situaciones_especiales", width: 18 },
          { key: "importe", width: 14 },
        ];
        ws.columns = columns;
        const headerRow = ws.getRow(headerRowIndex);
        const headers = [
          "ID",
          "Nombre Proyecto",
          "Pedido",
          "Clan",
          "Familia",
          "Proveedor",
          "Fecha Aprobación",
          "Concepto",
          "Situaciones",
          "Importe",
        ];
        headers.forEach((text, idx) => {
          headerRow.getCell(idx + 1).value = text;
        });
        headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
        headerRow.alignment = { vertical: "middle", horizontal: "center" };
        headerRow.height = 20;
        headerRow.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF224C84" }, // color login
          };
          cell.border = {
            top: { style: "thin", color: { argb: "FFDDDDDD" } },
            left: { style: "thin", color: { argb: "FFDDDDDD" } },
            bottom: { style: "thin", color: { argb: "FFDDDDDD" } },
            right: { style: "thin", color: { argb: "FFDDDDDD" } },
          };
        });

        // Datos
        const startDataRow = headerRowIndex + 1;
        let totalImporte = 0;
        pedidos.forEach((p, i) => {
          const r = ws.getRow(startDataRow + i);
          r.getCell(1).value = p.id;
          r.getCell(2).value = p.nombre_proyecto;
          r.getCell(3).value = p.pedido;
          r.getCell(4).value = p.clan;
          r.getCell(5).value = p.familia;
          r.getCell(6).value = p.proveedor;
          r.getCell(7).value = p.fecha_aprobacion;
          r.getCell(8).value = p.concepto;
          r.getCell(9).value = p.situaciones_especiales || "";
          const importe = Number(p.importe || 0);
          r.getCell(10).value = importe;
          r.getCell(10).numFmt = "#,##0.00";
          r.getCell(10).alignment = { horizontal: "right" };
          totalImporte += importe;
        });

        const totalRowIndex = startDataRow + pedidos.length;
        const totalRow = ws.getRow(totalRowIndex);
        totalRow.getCell(9).value = "Total";
        totalRow.getCell(9).font = { bold: true };
        totalRow.getCell(9).alignment = { horizontal: "right" };
        totalRow.getCell(10).value = totalImporte;
        totalRow.getCell(10).numFmt = "#,##0.00";
        totalRow.getCell(10).font = { bold: true };
        totalRow.getCell(10).alignment = { horizontal: "right" };
        totalRow.eachCell((cell) => {
          cell.border = {
            top: { style: "thin", color: { argb: "FFDDDDDD" } },
            left: { style: "thin", color: { argb: "FFDDDDDD" } },
            bottom: { style: "thin", color: { argb: "FFDDDDDD" } },
            right: { style: "thin", color: { argb: "FFDDDDDD" } },
          };
        });

        ws.views = [{ state: "frozen", ySplit: headerRowIndex }];

        const filename = `explosion_insumos_proyecto_${id}${(familia && String(familia).trim() !== "") ? `_${String(familia).replace(/[^A-Za-z0-9_-]+/g, "-")}` : ""}_${fechaGeneracion}.xlsx`;
        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader("Content-Disposition", `attachment; filename=${filename}`);

        await wb.xlsx.write(res);
        res.end();
      } catch (err) {
        console.error("Error generando XLSX:", err);
        res.status(500).json({ success: false, message: "Error generando archivo" });
      }
    });
  });
});

// Pedidos - explosión de insumos (asignaciones por clan/familia)
app.get("/proyectos/:id/explosion-insumos", authenticateToken, requireRole("administrador"), async (req, res) => {
  try {
    const proyectoId = Number(req.params.id);
    if (!Number.isInteger(proyectoId) || proyectoId <= 0) {
      return res.status(400).json({ success: false, message: "Proyecto inválido" });
    }
    const ctx = await obtenerContextoExplosion(proyectoId);
    const rows = await queryAsync(
      "SELECT id, clan, familia, presupuesto_asignado FROM explosion_insumos WHERE id_proyecto = ? ORDER BY id ASC",
      [proyectoId]
    );
    const data = (rows || []).map((row) => {
      const key = claveExplosion(row?.clan, row?.familia);
      const gastado = redondearMoneda(ctx.gastoPorClave.get(key) || 0);
      const presupuestoAsignado = redondearMoneda(row?.presupuesto_asignado);
      const restante = redondearMoneda(presupuestoAsignado - gastado);
      return {
        id: row.id,
        clan: normalizeTextValue(row?.clan),
        familia: normalizeTextValue(row?.familia),
        presupuesto_asignado: presupuestoAsignado,
        gastado,
        presupuesto_restante: restante,
        presupuesto_usado: restante, // compatibilidad con clientes anteriores
      };
    });
    res.json({
      success: true,
      data,
      total_asignado: ctx.totalAsignado,
      presupuesto_miscelaneos_base: ctx.baseMiscelaneos,
      presupuesto_miscelaneos_disponible: redondearMoneda(ctx.baseMiscelaneos - ctx.totalAsignado),
    });
  } catch (err) {
    if ((err?.message || "").includes("Proyecto no encontrado")) {
      return res.status(404).json({ success: false, message: "Proyecto no encontrado" });
    }
    console.error("Error consultando explosión de insumos:", err);
    res.status(500).json({ success: false, message: "Error interno al cargar explosión" });
  }
});

app.post("/proyectos/:id/explosion-insumos", authenticateToken, requireRole("administrador"), async (req, res) => {
  try {
    const proyectoId = Number(req.params.id);
    if (!Number.isInteger(proyectoId) || proyectoId <= 0) {
      return res.status(400).json({ success: false, message: "Proyecto inválido" });
    }
    const { clan, familia, presupuesto_asignado } = req.body || {};
    const familiaVal = normalizeTextValue(familia);
    const clanVal = normalizeTextValue(clan);
    const familiaDb = familiaVal.toUpperCase();
    const clanDb = clanVal ? clanVal.toUpperCase() : "";
    const presupuestoNum = parseBudgetValue(presupuesto_asignado, { allowNull: false });
    if (!familiaDb) {
      return res.status(400).json({ success: false, message: "Familia requerida" });
    }
    if (!Number.isFinite(presupuestoNum) || presupuestoNum < 0) {
      return res.status(400).json({ success: false, message: "Presupuesto inválido" });
    }
    const ctx = await obtenerContextoExplosion(proyectoId);
    const nuevoTotal = redondearMoneda(ctx.totalAsignado + presupuestoNum);
    if (nuevoTotal - ctx.baseMiscelaneos > 0.01) {
      return res.status(400).json({
        success: false,
        message: "El presupuesto asignado supera el presupuesto total de misceláneos del proyecto",
      });
    }
    const existente = await queryAsync(
      "SELECT id FROM explosion_insumos WHERE id_proyecto = ? AND clan = ? AND familia = ? LIMIT 1",
      [proyectoId, clanDb, familiaDb]
    );
    if (Array.isArray(existente) && existente.length) {
      return res.status(409).json({ success: false, message: "Ya existe una asignación para ese clan y familia" });
    }
    await queryAsync(
      "INSERT INTO explosion_insumos (id_proyecto, clan, familia, presupuesto_asignado) VALUES (?, ?, ?, ?)",
      [proyectoId, clanDb, familiaDb, presupuestoNum]
    );
    res.status(201).json({ success: true, message: "Presupuesto asignado guardado" });
  } catch (err) {
    if ((err?.message || "").includes("Proyecto no encontrado")) {
      return res.status(404).json({ success: false, message: "Proyecto no encontrado" });
    }
    console.error("Error creando explosión de insumos:", err);
    res.status(500).json({ success: false, message: "Error interno al guardar asignación" });
  }
});

app.put("/proyectos/:id/explosion-insumos/:explosionId", authenticateToken, requireRole("administrador"), async (req, res) => {
  try {
    const proyectoId = Number(req.params.id);
    const explosionId = Number(req.params.explosionId);
    if (!Number.isInteger(proyectoId) || proyectoId <= 0 || !Number.isInteger(explosionId) || explosionId <= 0) {
      return res.status(400).json({ success: false, message: "Identificadores inválidos" });
    }
    const { clan, familia, presupuesto_asignado } = req.body || {};
    const familiaVal = normalizeTextValue(familia);
    const clanVal = normalizeTextValue(clan);
    const familiaDb = familiaVal.toUpperCase();
    const clanDb = clanVal ? clanVal.toUpperCase() : "";
    const presupuestoNum = parseBudgetValue(presupuesto_asignado, { allowNull: false });
    if (!familiaDb) {
      return res.status(400).json({ success: false, message: "Familia requerida" });
    }
    if (!Number.isFinite(presupuestoNum) || presupuestoNum < 0) {
      return res.status(400).json({ success: false, message: "Presupuesto inválido" });
    }
    const actualRows = await queryAsync(
      "SELECT id, presupuesto_asignado FROM explosion_insumos WHERE id = ? AND id_proyecto = ? LIMIT 1",
      [explosionId, proyectoId]
    );
    if (!Array.isArray(actualRows) || actualRows.length === 0) {
      return res.status(404).json({ success: false, message: "Asignación no encontrada" });
    }
    const actual = actualRows[0];
    const ctx = await obtenerContextoExplosion(proyectoId);
    const nuevoTotal = redondearMoneda(ctx.totalAsignado - redondearMoneda(actual.presupuesto_asignado) + presupuestoNum);
    if (nuevoTotal - ctx.baseMiscelaneos > 0.01) {
      return res.status(400).json({
        success: false,
        message: "El presupuesto asignado supera el presupuesto total de misceláneos del proyecto",
      });
    }
    const duplicado = await queryAsync(
      "SELECT id FROM explosion_insumos WHERE id_proyecto = ? AND clan = ? AND familia = ? AND id <> ? LIMIT 1",
      [proyectoId, clanDb, familiaDb, explosionId]
    );
    if (Array.isArray(duplicado) && duplicado.length) {
      return res.status(409).json({ success: false, message: "Ya existe otra asignación con ese clan y familia" });
    }
    await queryAsync(
      "UPDATE explosion_insumos SET clan = ?, familia = ?, presupuesto_asignado = ? WHERE id = ? AND id_proyecto = ?",
      [clanDb, familiaDb, presupuestoNum, explosionId, proyectoId]
    );
    res.json({ success: true, message: "Asignación actualizada" });
  } catch (err) {
    if ((err?.message || "").includes("Proyecto no encontrado")) {
      return res.status(404).json({ success: false, message: "Proyecto no encontrado" });
    }
    console.error("Error actualizando explosión de insumos:", err);
    res.status(500).json({ success: false, message: "Error interno al actualizar asignación" });
  }
});

app.delete("/proyectos/:id/explosion-insumos/:explosionId", authenticateToken, requireRole("administrador"), async (req, res) => {
  try {
    const proyectoId = Number(req.params.id);
    const explosionId = Number(req.params.explosionId);
    if (!Number.isInteger(proyectoId) || proyectoId <= 0 || !Number.isInteger(explosionId) || explosionId <= 0) {
      return res.status(400).json({ success: false, message: "Identificadores inválidos" });
    }
    const result = await queryAsync("DELETE FROM explosion_insumos WHERE id = ? AND id_proyecto = ?", [explosionId, proyectoId]);
    if (result?.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Asignación no encontrada" });
    }
    res.json({ success: true, message: "Asignación eliminada" });
  } catch (err) {
    console.error("Error eliminando explosión de insumos:", err);
    res.status(500).json({ success: false, message: "Error interno al eliminar asignación" });
  }
});
// Utilidad: normaliza fechas a YYYY-MM-DD admitiendo varios formatos
function parseDateToISO(value) {
  if (!value) return null;
  const s = String(value).trim();
  // yyyy-mm-dd o yyyy/mm/dd
  let m = s.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
  if (m) {
    const yyyy = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    const dd = parseInt(m[3], 10);
    if (isValidYMD(yyyy, mm, dd)) return `${yyyy}-${pad2(mm)}-${pad2(dd)}`;
    return null;
  }
  // dd/mm/yyyy o dd-mm-yyyy
  m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (m) {
    const dd = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    const yyyy = parseInt(m[3], 10);
    if (isValidYMD(yyyy, mm, dd)) return `${yyyy}-${pad2(mm)}-${pad2(dd)}`;
    return null;
  }
  return null;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function isValidYMD(y, m, d) {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function normalizeTextValue(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

function parseSituacionEspecialInfo(texto) {
  const val = normalizeTextValue(texto).toUpperCase();
  if (!val) return { tipo: null, porcentaje: 0 };
  const esAmort = val.includes("AMORT");
  const esTrasp = val.includes("TRASP");
  if (!esAmort && !esTrasp) return { tipo: null, porcentaje: 0 };
  const m = val.match(/(-?\d+(?:[.,]\d+)?)\s*%/);
  const pct = m ? Number(String(m[1]).replace(",", ".")) : 0;
  const pctSeguro = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;
  return { tipo: esAmort ? "amortizacion" : "traspaso", porcentaje: pctSeguro };
}

function normalizePct(raw) {
  if (raw === null || raw === undefined) return { mathPct: 0, dbPct: null };
  let pct = Number(raw);
  if (!Number.isFinite(pct) || pct <= 0) return { mathPct: 0, dbPct: null };
  // permitir valores 0-1 como 0%-100%
  if (pct > 0 && pct <= 1) pct = pct * 100;
  const mathPct = Math.min(Math.max(pct, 0), 100); // para cálculos usamos hasta 100%
  // para DB ahora aceptamos hasta 100.00 (esquema 6,2)
  const dbPct = Number(Math.min(mathPct, 100).toFixed(2));
  return { mathPct, dbPct };
}

function isSalidaTlatilco(texto) {
  const val = normalizeTextValue(texto).toUpperCase();
  return val.includes("SALIDA TLATILCO");
}

function calcularSubtotalDetalles(detalles = []) {
  if (!Array.isArray(detalles) || !detalles.length) return 0;
  return detalles.reduce((sum, det) => {
    const importe = toFiniteNumber(det?.importe);
    return sum + (Number.isFinite(importe) ? importe : 0);
  }, 0);
}

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function decimalOrNull(value) {
  return value === null || value === undefined ? null : Number(value);
}

async function calcularImporteDesdeDetalles(row, { includeSubtotal = false } = {}) {
  const pedidoId = Number(row?.id);
  if (!Number.isFinite(pedidoId) || pedidoId <= 0) return 0;
  const familia = normalizeTextValue(row?.familia).toUpperCase();
  let table = "pedidos_detalles_miscelaneos";
  if (familia === "CR") table = "pedidos_detalles_cristal";
  if (familia === "AL" || familia === "MQAL") table = "pedidos_detalles_aluminio";
  const sumRows = await queryAsync(`SELECT SUM(importe) AS subtotal FROM ${table} WHERE id_pedido = ?`, [pedidoId]);
  const subtotal = Number(sumRows?.[0]?.subtotal || 0);
  const subtotalBase = Number(subtotal.toFixed(2));
  const salidaTlatilco = isSalidaTlatilco(row?.situaciones_especiales);
  const { mathPct } = normalizePct(row?.porcentaje_descuento);
  const descuentoMonto = subtotalBase * (mathPct / 100);
  const subtotalConDesc = subtotalBase - descuentoMonto;
  const ivaMonto = subtotalConDesc * 0.16;
  const total = salidaTlatilco ? 0 : Number(Math.max(0, subtotalConDesc + ivaMonto).toFixed(2));
  if (includeSubtotal) return { subtotal: subtotalBase, total };
  return total;
}

const PRESUPUESTO_FAMILIA_COL = {
  cristal: "presupuesto_cristal",
  aluminio: "presupuesto_aluminio",
  miscelaneos: "presupuesto_miscelaneos",
};

function parseBudgetValue(raw, { allowNull = true } = {}) {
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return allowNull ? null : 0;
  }
  const num = Number(raw);
  if (!Number.isFinite(num)) return null;
  return Number(num.toFixed(2));
}

function normalizarFamiliaPresupuesto(familia) {
  const fam = normalizeTextValue(familia).toUpperCase();
  if (fam.startsWith("CR")) return "cristal";
  if (fam === "MQAL" || fam.startsWith("AL") || fam.includes("ALUM")) return "aluminio";
  return "miscelaneos";
}

function redondearMoneda(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return 0;
  return Number(num.toFixed(2));
}

function claveExplosion(clan, familia) {
  const familiaVal = normalizeTextValue(familia).toUpperCase();
  if (familiaVal) return familiaVal; // agrupar por familia para que reste correctamente sin depender del clan
  const clanVal = normalizeTextValue(clan).toUpperCase();
  return clanVal || "";
}

function acumularGastoPorFamilia(rows = []) {
  const gastoPorClave = new Map();
  let gastoMiscelaneos = 0;
  for (const row of rows) {
    const importe = redondearMoneda(row?.importe_total);
    const key = claveExplosion(row?.clan, row?.familia);
    gastoPorClave.set(key, (gastoPorClave.get(key) || 0) + importe);
    if (normalizarFamiliaPresupuesto(row?.familia) === "miscelaneos") {
      gastoMiscelaneos += importe;
    }
  }
  return { gastoPorClave, gastoMiscelaneos: redondearMoneda(gastoMiscelaneos) };
}

async function obtenerContextoExplosion(proyectoId) {
  const proyectoRows = await queryAsync(
    "SELECT presupuesto_miscelaneos FROM proyectos WHERE id_proyecto = ? LIMIT 1",
    [proyectoId]
  );
  if (!Array.isArray(proyectoRows) || proyectoRows.length === 0) {
    throw new Error("Proyecto no encontrado");
  }
  const disponibleMiscelaneos = redondearMoneda(proyectoRows[0].presupuesto_miscelaneos);
  const pedidosRows = await queryAsync(
    "SELECT clan, familia, importe_total FROM pedidos WHERE id_proyecto = ?",
    [proyectoId]
  );
  const { gastoPorClave, gastoMiscelaneos } = acumularGastoPorFamilia(pedidosRows || []);
  const baseMiscelaneos = redondearMoneda(disponibleMiscelaneos + gastoMiscelaneos);
  const totRows = await queryAsync(
    "SELECT SUM(presupuesto_asignado) AS total FROM explosion_insumos WHERE id_proyecto = ?",
    [proyectoId]
  );
  const totalAsignado = redondearMoneda(totRows?.[0]?.total || 0);
  return {
    gastoPorClave,
    gastoMiscelaneos,
    baseMiscelaneos,
    totalAsignado,
    disponibleMiscelaneos,
  };
}

async function ajustarPresupuestoProyecto(idProyecto, familia, importe, { revert = false } = {}) {
  const proyectoId = Number(idProyecto);
  const monto = toFiniteNumber(importe);
  if (!Number.isInteger(proyectoId) || proyectoId <= 0 || monto === null) return;
  if (monto === 0) return;
  const tipoFamilia = normalizarFamiliaPresupuesto(familia);
  const columna = PRESUPUESTO_FAMILIA_COL[tipoFamilia];
  if (!columna) return;
  const deltaBase = revert ? monto : -monto;
  const delta = Number(deltaBase.toFixed(2));
  await queryAsync(
    `UPDATE proyectos SET ${columna} = COALESCE(${columna}, 0) + ? WHERE id_proyecto = ?`,
    [delta, proyectoId]
  );
  await queryAsync(
    `UPDATE proyectos
        SET presupuesto_total = COALESCE(presupuesto_cristal, 0) + COALESCE(presupuesto_aluminio, 0) + COALESCE(presupuesto_miscelaneos, 0),
            presupuesto = COALESCE(presupuesto_cristal, 0) + COALESCE(presupuesto_aluminio, 0) + COALESCE(presupuesto_miscelaneos, 0)
      WHERE id_proyecto = ?`,
    [proyectoId]
  );
}

async function registrarHistorialPresupuesto(idProyecto, { fecha, presupuesto_cristal, presupuesto_aluminio, presupuesto_miscelaneos, presupuesto_total }) {
  const proyectoId = Number(idProyecto);
  if (!Number.isInteger(proyectoId) || proyectoId <= 0) return;
  const fechaISO = parseDateToISO(fecha) || todayISO();
  const cristal = parseBudgetValue(presupuesto_cristal, { allowNull: false });
  const aluminio = parseBudgetValue(presupuesto_aluminio, { allowNull: false });
  const miscelaneos = parseBudgetValue(presupuesto_miscelaneos, { allowNull: false });
  const total =
    parseBudgetValue(presupuesto_total, { allowNull: true }) ??
    Number(((cristal || 0) + (aluminio || 0) + (miscelaneos || 0)).toFixed(2));
  const sql = `INSERT INTO proyectos_presupuestos_historial (id_proyecto, fecha_presupuesto, presupuesto_cristal, presupuesto_aluminio, presupuesto_miscelaneos, presupuesto_total)
               VALUES (?, ?, ?, ?, ?, ?)`;
  await queryAsync(sql, [proyectoId, fechaISO, cristal || 0, aluminio || 0, miscelaneos || 0, total]);
}

function prepareDetalleForInsert(detalle) {
  const descripcion = normalizeTextValue(detalle?.descripcion) || "Detalle";
  const unidad = normalizeTextValue(detalle?.unidad) || null;
  const medida = normalizeTextValue(detalle?.medida) || null;
  const clave = normalizeTextValue(detalle?.clave) || null;
  const acabado = normalizeTextValue(detalle?.acabado) || null;
  const cantidadBase = toFiniteNumber(detalle?.cantidad);
  const cantidad = cantidadBase !== null ? Math.round(cantidadBase) : 0;
  let precioUnitario = toFiniteNumber(detalle?.precio_unitario);
  const importeDato = toFiniteNumber(detalle?.importe);
  if ((precioUnitario === null || precioUnitario === 0) && importeDato !== null && cantidad) {
    precioUnitario = Number((importeDato / cantidad).toFixed(2));
  }
  const importe = importeDato !== null ? importeDato : Number((cantidad * (precioUnitario || 0)).toFixed(2));
  const ml = toFiniteNumber(detalle?.ml);
  const kg = toFiniteNumber(detalle?.kg);
  const precioKg = toFiniteNumber(detalle?.precio_x_kg);
  return {
    descripcion,
    unidad,
    medida,
    cantidad,
    precio_unitario: precioUnitario !== null ? precioUnitario : 0,
    importe,
    clave,
    ml,
    acabado,
    kg,
    precio_x_kg: precioKg,
  };
}

function prepareCristalDetalleForInsert(detalle) {
  const descripcion = normalizeTextValue(detalle?.descripcion) || "Detalle cristal";
  const claveModelo = normalizeTextValue(detalle?.clave_modelo ?? detalle?.clave) || null;
  const ancho = toFiniteNumber(detalle?.ancho);
  const largo = toFiniteNumber(detalle?.largo);
  const m2Corte = toFiniteNumber(detalle?.m2_corte);
  const piezasBase = toFiniteNumber(detalle?.piezas ?? detalle?.cantidad);
  const piezas = piezasBase !== null ? Math.max(0, Math.round(piezasBase)) : 0;
  let m2Pedido = toFiniteNumber(detalle?.m2_pedido);
  if (m2Pedido === null && piezas > 0) {
    m2Pedido = piezas;
  }
  if (m2Pedido === null && m2Corte !== null && m2Corte > 0) {
    m2Pedido = m2Corte;
  }
  let precioUnitario = toFiniteNumber(detalle?.precio_unitario);
  let importe = toFiniteNumber(detalle?.importe);
  if ((importe === null || importe === 0) && piezas && precioUnitario !== null) {
    importe = Number((piezas * precioUnitario).toFixed(2));
  }
  if ((precioUnitario === null || precioUnitario === 0) && importe !== null && piezas) {
    precioUnitario = Number((importe / piezas).toFixed(2));
  }
  if (importe === null) {
    importe = Number(((precioUnitario || 0) * piezas).toFixed(2));
  }
  return {
    descripcion,
    clave_modelo: claveModelo,
    ancho,
    largo,
    m2_corte: m2Corte,
    piezas,
    m2_pedido: m2Pedido,
    precio_unitario: precioUnitario !== null ? precioUnitario : 0,
    importe: importe !== null ? importe : 0,
  };
}

function prepareAluminioDetalleForInsert(detalle) {
  const descripcion = normalizeTextValue(detalle?.descripcion) || "Detalle aluminio";
  const numeroPerfil = normalizeTextValue(detalle?.numero_perfil) || null;
  const medidaTramo = toFiniteNumber(detalle?.medida_tramo);
  const unidad = normalizeTextValue(detalle?.unidad) || null;
  const pesoKgMl = toFiniteNumber(detalle?.peso_kg_ml);
  const perimetroM2Ml = toFiniteNumber(detalle?.perimetro_m2_ml);
  const acabado = normalizeTextValue(detalle?.acabado) || null;
  const totalTramosBase = toFiniteNumber(detalle?.total_tramos);
  const totalTramos = totalTramosBase !== null ? Math.max(0, Math.round(totalTramosBase)) : null;
  const ml = toFiniteNumber(detalle?.ml);
  const kg = toFiniteNumber(detalle?.kg);
  const m2 = toFiniteNumber(detalle?.m2);
  const importe = toFiniteNumber(detalle?.importe) || 0;
  return {
    numero_perfil: numeroPerfil,
    descripcion,
    medida_tramo: medidaTramo,
    unidad,
    peso_kg_ml: pesoKgMl,
    perimetro_m2_ml: perimetroM2Ml,
    acabado,
    total_tramos: totalTramos,
    ml,
    kg,
    m2,
    importe,
  };
}

async function insertPedidoDetallesRows(pedidoId, detallesRaw) {
  if (!Array.isArray(detallesRaw) || detallesRaw.length === 0) return;
  const sqlDetalle = "INSERT INTO pedidos_detalles_miscelaneos (id_pedido, descripcion, unidad, medida, cantidad, precio_unitario, importe, clave, ml, acabado, kg, precio_x_kg) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
  for (const detalleRaw of detallesRaw) {
    const detalle = prepareDetalleForInsert(detalleRaw || {});
    const values = [
      pedidoId,
      detalle.descripcion,
      detalle.unidad,
      detalle.medida,
      detalle.cantidad,
      detalle.precio_unitario,
      detalle.importe,
      detalle.clave,
      detalle.ml,
      detalle.acabado,
      detalle.kg,
      detalle.precio_x_kg,
    ];
    await queryAsync(sqlDetalle, values);
  }
}

async function insertCristalDetallesRows(pedidoId, detallesRaw) {
  if (!Array.isArray(detallesRaw) || detallesRaw.length === 0) return 0;
  const sqlDetalle = "INSERT INTO pedidos_detalles_cristal (id_pedido, descripcion, clave_modelo, ancho, largo, m2_corte, piezas, m2_pedido, precio_unitario, importe) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
  let inserted = 0;
  for (const detalleRaw of detallesRaw) {
    const detalle = prepareCristalDetalleForInsert(detalleRaw || {});
    const values = [
      pedidoId,
      detalle.descripcion,
      detalle.clave_modelo,
      detalle.ancho,
      detalle.largo,
      detalle.m2_corte,
      detalle.piezas,
      detalle.m2_pedido,
      detalle.precio_unitario,
      detalle.importe,
    ];
    await queryAsync(sqlDetalle, values);
    inserted += 1;
  }
  return inserted;
}

async function insertAluminioDetallesRows(pedidoId, detallesRaw) {
  if (!Array.isArray(detallesRaw) || detallesRaw.length === 0) return 0;
  const sqlDetalle = `INSERT INTO pedidos_detalles_aluminio
    (id_pedido, numero_perfil, descripcion, medida_tramo, unidad, peso_kg_ml, perimetro_m2_ml, acabado, total_tramos, ml, kg, m2, importe)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  let inserted = 0;
  for (const detalleRaw of detallesRaw) {
    const detalle = prepareAluminioDetalleForInsert(detalleRaw || {});
    const values = [
      pedidoId,
      detalle.numero_perfil,
      detalle.descripcion,
      detalle.medida_tramo,
      detalle.unidad,
      detalle.peso_kg_ml,
      detalle.perimetro_m2_ml,
      detalle.acabado,
      detalle.total_tramos,
      detalle.ml,
      detalle.kg,
      detalle.m2,
      detalle.importe,
    ];
    await queryAsync(sqlDetalle, values);
    inserted += 1;
  }
  return inserted;
}

async function insertDetallesSegunFamilia(pedidoId, familia, detallesRaw) {
  if (!Array.isArray(detallesRaw) || detallesRaw.length === 0) return;
  const familiaVal = normalizeTextValue(familia).toUpperCase();
  if (familiaVal === "CR") {
    await insertCristalDetallesRows(pedidoId, detallesRaw);
    return;
  }
  if (familiaVal === "AL" || familiaVal === "MQAL") {
    await insertAluminioDetallesRows(pedidoId, detallesRaw);
    return;
  }
  await insertPedidoDetallesRows(pedidoId, detallesRaw);
}

// Pedidos - carga masiva desde CSV (parseado en el frontend)
app.post("/proyectos/:id/pedidos", authenticateToken, requireRole("administrador"), async (req, res) => {
  try {
    const { id } = req.params;
    const proyectoId = Number(id);
    const { pedidos } = req.body || {};
    if (!Number.isInteger(proyectoId) || proyectoId <= 0) {
      return res.status(400).json({ success: false, message: "Proyecto inválido" });
    }
    if (!Array.isArray(pedidos) || pedidos.length === 0) {
      return res.status(400).json({ success: false, message: "No hay pedidos a insertar" });
    }
    const username = normalizeTextValue(req.user?.username);
    if (!username) {
      return res.status(400).json({ success: false, message: "Usuario inválido" });
    }
    const sql =
      "INSERT INTO pedidos (id_proyecto, nombre_proyecto, pedido, clan, familia, proveedor, fecha_aprobacion, concepto, situaciones_especiales, porcentaje_descuento, importe_total, nombre_usuario) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

    const detailsLog = [];
    let okCount = 0;
    for (let idx = 0; idx < pedidos.length; idx += 1) {
      const p = pedidos[idx] || {};
      const fechaISO = parseDateToISO(p.fecha_aprobacion);
      if (!fechaISO) {
        detailsLog.push({ index: idx + 1, pedido: p.pedido || null, ok: false, replaced: false, error: "Fecha inválida" });
        continue;
      }
      const pedidoNombre = normalizeTextValue(p.pedido);
      if (!pedidoNombre) {
        detailsLog.push({ index: idx + 1, pedido: null, ok: false, replaced: false, error: "Pedido sin nombre" });
        continue;
      }
      const situacionesEspeciales = normalizeTextValue(p.situaciones_especiales) || null;
      const familiaValor = normalizeTextValue(p.familia);

      const parsePct = (raw) => {
        const num = toFiniteNumber(raw);
        if (num === null) return null;
        return normalizePct(num);
      };
      let porcentajeDescuento = null; // usamos mathPct para cálculos
      let porcentajeDescuentoDb = null; // usamos dbPct para DB
      const posiblesDescuentos = [
        p?.porcentaje_descuento,
        p?.porcentaje,
        p?.porcentaje_situacion_especial,
        p?.["% situacion especial"],
      ];
      for (const candidato of posiblesDescuentos) {
        const pct = parsePct(candidato);
        if (pct !== null) {
          porcentajeDescuento = pct.mathPct;
          porcentajeDescuentoDb = pct.dbPct;
          break;
        }
      }
      if (porcentajeDescuento === null) {
        const { porcentaje } = parseSituacionEspecialInfo(p.situaciones_especiales);
        if (porcentaje > 0) {
          const norm = normalizePct(porcentaje);
          porcentajeDescuento = norm.mathPct;
          porcentajeDescuentoDb = norm.dbPct;
        }
      }
      if (porcentajeDescuento !== null && porcentajeDescuentoDb === null) {
        const norm = normalizePct(porcentajeDescuento);
        porcentajeDescuento = norm.mathPct;
        porcentajeDescuentoDb = norm.dbPct;
      }
      const tieneSalidaTlatilco = isSalidaTlatilco(p.situaciones_especiales);
      const subtotalDetalles = calcularSubtotalDetalles(p.detalles);
      const importePedido = toFiniteNumber(p.importe);
      const baseSinIva =
        subtotalDetalles > 0
          ? subtotalDetalles
          : importePedido !== null && importePedido !== 0
            ? importePedido
            : 0;
      const subtotalBase = Number(baseSinIva.toFixed(2));
      const descuentoMonto = subtotalBase * ((porcentajeDescuento || 0) / 100);
      const subtotalConDesc = subtotalBase - descuentoMonto;
      const ivaMonto = subtotalConDesc * 0.16;
      const importeTotal = tieneSalidaTlatilco ? 0 : Number(Math.max(0, subtotalConDesc + ivaMonto).toFixed(2));

      let replacedExisting = false;
      try {
        const existingRows = await queryAsync(
          "SELECT id, familia, situaciones_especiales, porcentaje_descuento, importe_total FROM pedidos WHERE id_proyecto = ? AND pedido = ? LIMIT 1",
          [proyectoId, pedidoNombre]
        );
        if (Array.isArray(existingRows) && existingRows.length) {
          const existingRow = existingRows[0];
          let importePrevio = toFiniteNumber(existingRow.importe_total) || 0;
          try {
            const importeCalc = await calcularImporteDesdeDetalles(existingRow, { includeSubtotal: false });
            if (Number.isFinite(importeCalc) && importeCalc !== null) {
              importePrevio = Number(importeCalc);
            }
          } catch (calcErr) {
            console.error("Error recalculando importe previo del pedido:", calcErr);
          }
          try {
            await ajustarPresupuestoProyecto(proyectoId, existingRow.familia, importePrevio, { revert: true });
          } catch (presErr) {
            console.error("No se pudo reintegrar presupuesto del pedido previo:", presErr);
          }
          await queryAsync("DELETE FROM pedidos WHERE id = ? AND id_proyecto = ?", [existingRow.id, proyectoId]);
          replacedExisting = true;
        }
      } catch (lookupErr) {
        console.error("Error verificando pedido existente:", lookupErr);
        detailsLog.push({ index: idx + 1, pedido: pedidoNombre, ok: false, replaced: false, error: "No se pudo validar duplicados" });
        continue;
      }

      const values = [
        proyectoId,
        normalizeTextValue(p.nombre_proyecto),
        pedidoNombre,
        normalizeTextValue(p.clan),
        familiaValor,
        normalizeTextValue(p.proveedor),
        fechaISO,
        normalizeTextValue(p.concepto),
        situacionesEspeciales,
        porcentajeDescuentoDb,
        importeTotal,
        username,
      ];
      try {
        const result = await queryAsync(sql, values);
        const pedidoId = result.insertId;
        await insertDetallesSegunFamilia(pedidoId, p.familia, p.detalles);
        let importeFinal = importeTotal;
        try {
          const calc = await calcularImporteDesdeDetalles(
            {
              id: pedidoId,
              familia: familiaValor,
              situaciones_especiales: situacionesEspeciales,
              porcentaje_descuento: porcentajeDescuentoDb,
            },
            { includeSubtotal: true }
          );
          if (calc && Number.isFinite(calc.total)) {
            importeFinal = Number(calc.total);
          }
        } catch (calcErr) {
          console.error("No se pudo recalcular el importe del pedido insertado:", calcErr);
        }
        const importeFinalSeguro = Number(
          Number.isFinite(importeFinal) ? importeFinal.toFixed(2) : Number(importeTotal.toFixed(2))
        );
        try {
          await queryAsync("UPDATE pedidos SET importe_total = ? WHERE id = ?", [importeFinalSeguro, pedidoId]);
        } catch (updErr) {
          console.error("No se pudo actualizar el importe_total del pedido:", updErr);
        }
        try {
          await ajustarPresupuestoProyecto(proyectoId, familiaValor, importeFinalSeguro);
        } catch (presErr) {
          console.error("No se pudo descontar del presupuesto del proyecto:", presErr);
        }
        okCount += 1;
        detailsLog.push({ index: idx + 1, pedido: pedidoNombre, ok: true, replaced: replacedExisting, error: null });
      } catch (err) {
        console.error("Error insertando pedido:", err);
        detailsLog.push({ index: idx + 1, pedido: pedidoNombre, ok: false, replaced: replacedExisting, error: String(err?.message || err) });
      }
    }

    const failCount = detailsLog.length - okCount;
    return res.json({
      success: okCount > 0,
      inserted: okCount,
      failed: failCount,
      message: `Pedidos insertados: ${okCount}${failCount ? ", fallidos: " + failCount : ""}`,
      details: detailsLog,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
});

//------------------------------------------------------------
// VIÁTICOS ENDPOINTS
//------------------------------------------------------------

// Get presupuestos de viáticos para un proyecto
app.get("/proyectos/:id/viaticos-presupuestos", authenticateToken, async (req, res) => {
  try {
    const proyectoId = Number(req.params.id);
    if (!Number.isInteger(proyectoId) || proyectoId <= 0) {
      return res.status(400).json({ success: false, message: "Proyecto inválido" });
    }

    const query = `
      SELECT
        id_presupuesto,
        familia,
        presupuesto_asignado,
        gastado,
        (presupuesto_asignado - gastado) AS restante
      FROM viaticos_presupuestos
      WHERE id_proyecto = ?
      ORDER BY FIELD(familia, 'Mano de Obra', 'Viáticos', 'Fletes')
    `;

    const results = await queryAsync(query, [proyectoId]);
    res.json({ success: true, data: results || [] });
  } catch (err) {
    console.error("Error consultando presupuestos de viáticos:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
});

// Crear o actualizar presupuesto de viáticos
app.post("/proyectos/:id/viaticos-presupuestos", authenticateToken, requireRole("administrador"), async (req, res) => {
  try {
    const proyectoId = Number(req.params.id);
    const { familia, presupuesto_asignado } = req.body || {};
    const username = req.user?.username || "unknown";

    const validFamilias = ['Mano de Obra', 'Viáticos', 'Fletes'];
    if (!validFamilias.includes(familia)) {
      return res.status(400).json({ success: false, message: "Familia inválida" });
    }

    const presupuesto = Number(presupuesto_asignado);
    if (!Number.isFinite(presupuesto) || presupuesto < 0) {
      return res.status(400).json({ success: false, message: "Presupuesto inválido" });
    }

    const query = `
      INSERT INTO viaticos_presupuestos (id_proyecto, familia, presupuesto_asignado, nombre_usuario)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        presupuesto_asignado = VALUES(presupuesto_asignado),
        nombre_usuario = VALUES(nombre_usuario)
    `;

    await queryAsync(query, [proyectoId, familia, presupuesto, username]);
    res.status(201).json({ success: true, message: "Presupuesto actualizado correctamente" });
  } catch (err) {
    console.error("Error actualizando presupuesto de viáticos:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
});

// Get movimientos de viáticos para un proyecto
app.get("/proyectos/:id/viaticos-movimientos", authenticateToken, async (req, res) => {
  try {
    const proyectoId = Number(req.params.id);
    const { familia, fecha_desde, fecha_hasta } = req.query;

    let query = `
      SELECT
        id_movimiento,
        familia,
        persona,
        concepto,
        clave_referencia,
        DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha,
        ingreso,
        egreso,
        saldo,
        nombre_usuario
      FROM viaticos_movimientos
      WHERE id_proyecto = ?
    `;
    const params = [proyectoId];

    if (familia) {
      query += " AND familia = ?";
      params.push(familia);
    }
    if (fecha_desde) {
      query += " AND fecha >= ?";
      params.push(fecha_desde);
    }
    if (fecha_hasta) {
      query += " AND fecha <= ?";
      params.push(fecha_hasta);
    }

    query += " ORDER BY fecha ASC, id_movimiento ASC";

    const results = await queryAsync(query, params);
    res.json({ success: true, data: results || [] });
  } catch (err) {
    console.error("Error consultando movimientos de viáticos:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
});

// Crear movimiento de viáticos
app.post("/proyectos/:id/viaticos-movimientos", authenticateToken, requireRole("administrador"), async (req, res) => {
  try {
    const proyectoId = Number(req.params.id);
    const { familia, persona, concepto, clave_referencia, fecha, ingreso, egreso } = req.body || {};
    const username = req.user?.username || "unknown";

    const validFamilias = ['Mano de Obra', 'Viáticos', 'Fletes'];
    if (!validFamilias.includes(familia)) {
      return res.status(400).json({ success: false, message: "Familia inválida" });
    }

    if (!persona || !concepto || !fecha) {
      return res.status(400).json({ success: false, message: "Faltan datos requeridos" });
    }

    const ingresoVal = Number(ingreso) || 0;
    const egresoVal = Number(egreso) || 0;

    if (ingresoVal < 0 || egresoVal < 0) {
      return res.status(400).json({ success: false, message: "Los montos no pueden ser negativos" });
    }

    if (ingresoVal === 0 && egresoVal === 0) {
      return res.status(400).json({ success: false, message: "Debe especificar un ingreso o egreso" });
    }

    if (ingresoVal > 0 && egresoVal > 0) {
      return res.status(400).json({ success: false, message: "No puede haber ingreso y egreso simultáneamente" });
    }

    const query = `
      INSERT INTO viaticos_movimientos
        (id_proyecto, familia, persona, concepto, clave_referencia, fecha, ingreso, egreso, nombre_usuario)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await queryAsync(query, [
      proyectoId, familia, persona, concepto,
      clave_referencia || null, fecha, ingresoVal, egresoVal, username
    ]);

    // Recalculate saldo for all movements in this project/familia
    await queryAsync(
      "CALL sp_recalcular_saldos_viaticos(?, ?)",
      [proyectoId, familia]
    );

    res.status(201).json({
      success: true,
      message: "Movimiento registrado correctamente",
      data: { id_movimiento: result.insertId }
    });
  } catch (err) {
    console.error("Error creando movimiento de viáticos:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
});

// Eliminar movimiento de viáticos
app.delete("/proyectos/:id/viaticos-movimientos/:movimientoId", authenticateToken, requireRole("administrador"), async (req, res) => {
  try {
    const proyectoId = Number(req.params.id);
    const movimientoId = Number(req.params.movimientoId);

    // Get familia before deleting
    const [movimientos] = await pool.query(
      "SELECT familia FROM viaticos_movimientos WHERE id_movimiento = ? AND id_proyecto = ?",
      [movimientoId, proyectoId]
    );

    if (movimientos.length === 0) {
      return res.status(404).json({ success: false, message: "Movimiento no encontrado" });
    }

    const familia = movimientos[0].familia;

    await queryAsync(
      "DELETE FROM viaticos_movimientos WHERE id_movimiento = ? AND id_proyecto = ?",
      [movimientoId, proyectoId]
    );

    // Recalculate saldo for remaining movements
    await queryAsync(
      "CALL sp_recalcular_saldos_viaticos(?, ?)",
      [proyectoId, familia]
    );

    res.json({ success: true, message: "Movimiento eliminado correctamente" });
  } catch (err) {
    console.error("Error eliminando movimiento:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
});

// Export viaticos movements to Excel
app.get("/proyectos/:id/viaticos-movimientos/export", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { familia, fecha_desde, fecha_hasta } = req.query;

  try {
    // Get project info
    const proyectoRows = await queryAsync(
      "SELECT nombre FROM proyectos WHERE id_proyecto = ?",
      [id]
    );
    const nombreProyecto = proyectoRows[0]?.nombre || `Proyecto ${id}`;

    // Build query for movements
    let query = `
      SELECT id_movimiento, familia, persona, concepto, clave_referencia, fecha,
             ingreso, egreso, saldo, nombre_usuario
      FROM viaticos_movimientos
      WHERE id_proyecto = ?
    `;
    const params = [id];

    if (familia) {
      query += " AND familia = ?";
      params.push(familia);
    }
    if (fecha_desde) {
      query += " AND fecha >= ?";
      params.push(fecha_desde);
    }
    if (fecha_hasta) {
      query += " AND fecha <= ?";
      params.push(fecha_hasta);
    }
    query += " ORDER BY fecha ASC, id_movimiento ASC";

    const movimientos = await queryAsync(query, params);

    // Get budget information
    const presupuestos = await queryAsync(
      `SELECT familia, presupuesto_asignado, gastado,
              (presupuesto_asignado - gastado) AS restante
       FROM viaticos_presupuestos
       WHERE id_proyecto = ?
       ORDER BY FIELD(familia, 'Mano de Obra', 'Viáticos', 'Fletes')`,
      [id]
    );

    // Create workbook
    const workbook = new ExcelJS.Workbook();

    // Sheet 1: Pagos en Efectivo
    const sheetMovimientos = workbook.addWorksheet("Pagos en Efectivo");

    // Add title
    sheetMovimientos.mergeCells("A1:I1");
    const titleCell = sheetMovimientos.getCell("A1");
    titleCell.value = `PAGOS EN EFECTIVO - ${nombreProyecto}`;
    titleCell.font = { bold: true, size: 14 };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };

    // Add headers
    const headers = ["N°", "NOMBRE", "CONCEPTO", "FAMILIA", "CLAVE", "PROYECTO", "FECHA", "BALANCE", "", "", "OBSERVACIONES"];
    const subheaders = ["", "", "", "", "", "", "", "INGRESO", "EGRESO", "SALDO", ""];

    sheetMovimientos.getRow(2).values = headers;
    sheetMovimientos.getRow(3).values = subheaders;

    // Merge cells for headers
    sheetMovimientos.mergeCells("A2:A3");
    sheetMovimientos.mergeCells("B2:B3");
    sheetMovimientos.mergeCells("C2:C3");
    sheetMovimientos.mergeCells("D2:D3");
    sheetMovimientos.mergeCells("E2:E3");
    sheetMovimientos.mergeCells("F2:F3");
    sheetMovimientos.mergeCells("G2:G3");
    sheetMovimientos.mergeCells("H2:J2"); // BALANCE header
    sheetMovimientos.mergeCells("K2:K3");

    // Style headers
    ["A2", "B2", "C2", "D2", "E2", "F2", "G2", "H2", "K2"].forEach(cell => {
      const c = sheetMovimientos.getCell(cell);
      c.font = { bold: true };
      c.alignment = { horizontal: "center", vertical: "middle" };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } };
      c.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
        bottom: { style: "thin" }
      };
    });

    // Style subheaders
    ["H3", "I3", "J3"].forEach(cell => {
      const c = sheetMovimientos.getCell(cell);
      c.font = { bold: true };
      c.alignment = { horizontal: "center", vertical: "middle" };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } };
      c.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
        bottom: { style: "thin" }
      };
    });

    // Add data rows
    movimientos.forEach((mov, idx) => {
      const row = sheetMovimientos.addRow([
        idx + 1,
        mov.persona,
        mov.concepto,
        mov.familia,
        mov.clave_referencia || "",
        nombreProyecto,
        mov.fecha,
        mov.ingreso,
        mov.egreso,
        mov.saldo,
        ""
      ]);

      // Format currency columns
      row.getCell(8).numFmt = "$#,##0.00";
      row.getCell(9).numFmt = "$#,##0.00";
      row.getCell(10).numFmt = "$#,##0.00";

      // Color negative balance
      if (mov.saldo < 0) {
        row.getCell(10).font = { color: { argb: "FFFF0000" } };
      }

      // Add borders
      for (let i = 1; i <= 11; i++) {
        row.getCell(i).border = {
          top: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" },
          bottom: { style: "thin" }
        };
      }
    });

    // Set column widths
    sheetMovimientos.getColumn(1).width = 8;
    sheetMovimientos.getColumn(2).width = 25;
    sheetMovimientos.getColumn(3).width = 35;
    sheetMovimientos.getColumn(4).width = 15;
    sheetMovimientos.getColumn(5).width = 12;
    sheetMovimientos.getColumn(6).width = 30;
    sheetMovimientos.getColumn(7).width = 15;
    sheetMovimientos.getColumn(8).width = 15;
    sheetMovimientos.getColumn(9).width = 15;
    sheetMovimientos.getColumn(10).width = 15;
    sheetMovimientos.getColumn(11).width = 25;

    // Sheet 2: Desglose de Presupuestos
    const sheetPresupuestos = workbook.addWorksheet("Desglose de Presupuestos");

    // Add title
    sheetPresupuestos.mergeCells("A1:J1");
    const titleCell2 = sheetPresupuestos.getCell("A1");
    titleCell2.value = `DESGLOSE DE PRESUPUESTOS - ${nombreProyecto}`;
    titleCell2.font = { bold: true, size: 14 };
    titleCell2.alignment = { horizontal: "center", vertical: "middle" };

    // Add headers
    const presupuestoHeaders = [
      "N°", "PROYECTO",
      "MANO DE OBRA", "", "",
      "VIATICOS", "", "",
      "FLETES", "", "",
      "TOTAL POR EROGAR"
    ];
    const presupuestoSubheaders = [
      "", "",
      "PRESUPUESTO", "EROGADO", "POR EROGAR",
      "PRESUPUESTO", "EROGADO", "POR EROGAR",
      "PRESUPUESTO", "EROGADO", "POR EROGAR",
      ""
    ];

    sheetPresupuestos.getRow(2).values = presupuestoHeaders;
    sheetPresupuestos.getRow(3).values = presupuestoSubheaders;

    // Merge cells for headers
    sheetPresupuestos.mergeCells("A2:A3");
    sheetPresupuestos.mergeCells("B2:B3");
    sheetPresupuestos.mergeCells("C2:E2"); // MANO DE OBRA
    sheetPresupuestos.mergeCells("F2:H2"); // VIATICOS
    sheetPresupuestos.mergeCells("I2:K2"); // FLETES
    sheetPresupuestos.mergeCells("L2:L3"); // TOTAL POR EROGAR

    // Style headers
    ["A2", "B2", "C2", "F2", "I2", "L2"].forEach(cell => {
      const c = sheetPresupuestos.getCell(cell);
      c.font = { bold: true };
      c.alignment = { horizontal: "center", vertical: "middle" };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } };
      c.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
        bottom: { style: "thin" }
      };
    });

    // Style subheaders
    ["C3", "D3", "E3", "F3", "G3", "H3", "I3", "J3", "K3"].forEach(cell => {
      const c = sheetPresupuestos.getCell(cell);
      c.font = { bold: true };
      c.alignment = { horizontal: "center", vertical: "middle" };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } };
      c.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
        bottom: { style: "thin" }
      };
    });

    // Prepare budget data by family
    const budgetByFamily = {
      "Mano de Obra": { presupuesto: 0, erogado: 0, porErogar: 0 },
      "Viáticos": { presupuesto: 0, erogado: 0, porErogar: 0 },
      "Fletes": { presupuesto: 0, erogado: 0, porErogar: 0 }
    };

    presupuestos.forEach(p => {
      if (budgetByFamily[p.familia]) {
        budgetByFamily[p.familia].presupuesto = p.presupuesto_asignado;
        budgetByFamily[p.familia].erogado = p.gastado;
        budgetByFamily[p.familia].porErogar = p.restante;
      }
    });

    // Calculate total por erogar
    const totalPorErogar =
      budgetByFamily["Mano de Obra"].porErogar +
      budgetByFamily["Viáticos"].porErogar +
      budgetByFamily["Fletes"].porErogar;

    // Add data row
    const dataRow = sheetPresupuestos.addRow([
      1,
      nombreProyecto,
      budgetByFamily["Mano de Obra"].presupuesto,
      budgetByFamily["Mano de Obra"].erogado,
      budgetByFamily["Mano de Obra"].porErogar,
      budgetByFamily["Viáticos"].presupuesto,
      budgetByFamily["Viáticos"].erogado,
      budgetByFamily["Viáticos"].porErogar,
      budgetByFamily["Fletes"].presupuesto,
      budgetByFamily["Fletes"].erogado,
      budgetByFamily["Fletes"].porErogar,
      totalPorErogar
    ]);

    // Format currency columns
    for (let i = 3; i <= 12; i++) {
      dataRow.getCell(i).numFmt = "$#,##0.00";
    }

    // Color negative values
    for (let i = 3; i <= 12; i++) {
      if (dataRow.getCell(i).value < 0) {
        dataRow.getCell(i).font = { color: { argb: "FFFF0000" } };
      }
    }

    // Add borders
    for (let i = 1; i <= 12; i++) {
      dataRow.getCell(i).border = {
        top: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
        bottom: { style: "thin" }
      };
    }

    // Set column widths
    sheetPresupuestos.getColumn(1).width = 8;
    sheetPresupuestos.getColumn(2).width = 30;
    for (let i = 3; i <= 12; i++) {
      sheetPresupuestos.getColumn(i).width = 15;
    }

    // Generate Excel file
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Pagos_Efectivo_${nombreProyecto.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Error exportando movimientos:", err);
    res.status(500).json({ success: false, message: "Error al exportar" });
  }
});

// Middleware de autorizacion por rol
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

// ==================== ENDPOINTS DE DASHBOARDS ====================

// Dashboard Ejecutivo
app.get("/api/dashboard/ejecutivo", authenticateToken, async (req, res) => {
  try {
    // KPIs principales
    const kpisQuery = `
      SELECT
        COUNT(*) as totalProyectos,
        SUM(CASE WHEN estado = 'en_progreso' THEN 1 ELSE 0 END) as proyectosActivos,
        COALESCE(SUM(COALESCE(p.presupuesto_total, p.presupuesto, 0)), 0) as presupuestoTotal,
        COALESCE(SUM(COALESCE(pe.total_pedidos, 0)), 0) as presupuestoEjecutado
      FROM proyectos p
      LEFT JOIN (
        SELECT id_proyecto, SUM(importe_total) as total_pedidos
        FROM pedidos
        GROUP BY id_proyecto
      ) pe ON p.id_proyecto = pe.id_proyecto
    `;
    const kpisResult = await queryAsync(kpisQuery);
    const kpis = kpisResult[0] || {};

    // Proyectos por estado
    const estadosQuery = `
      SELECT
        CASE
          WHEN estado = 'en_progreso' THEN 'En Progreso'
          WHEN estado = 'completado' THEN 'Completado'
          ELSE 'Desconocido'
        END as estado,
        COUNT(*) as cantidad
      FROM proyectos
      GROUP BY estado
    `;
    const proyectosPorEstado = await queryAsync(estadosQuery);

    // Tendencia de presupuesto mensual (últimos 6 meses)
    const tendenciaQuery = `
      SELECT
        DATE_FORMAT(fecha_proyecto, '%Y-%m') as mes,
        SUM(COALESCE(presupuesto_total, presupuesto, 0)) as presupuesto
      FROM proyectos
      WHERE fecha_proyecto >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(fecha_proyecto, '%Y-%m')
      ORDER BY mes ASC
    `;
    const tendenciaPresupuesto = await queryAsync(tendenciaQuery);

    // Proyectos creados por mes
    const completadosQuery = `
      SELECT
        DATE_FORMAT(fecha_proyecto, '%Y-%m') as mes,
        COUNT(*) as cantidad
      FROM proyectos
      WHERE fecha_proyecto >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(fecha_proyecto, '%Y-%m')
      ORDER BY mes ASC
    `;
    const proyectosCompletados = await queryAsync(completadosQuery);

    res.json({
      kpis: {
        totalProyectos: kpis.totalProyectos || 0,
        proyectosActivos: kpis.proyectosActivos || 0,
        presupuestoTotal: parseFloat(kpis.presupuestoTotal) || 0,
        presupuestoEjecutado: parseFloat(kpis.presupuestoEjecutado) || 0
      },
      proyectosPorEstado: proyectosPorEstado.map(item => ({
        estado: item.estado,
        cantidad: item.cantidad
      })),
      tendenciaPresupuesto: tendenciaPresupuesto.map(item => ({
        mes: item.mes,
        presupuesto: parseFloat(item.presupuesto) || 0
      })),
      proyectosCompletados: proyectosCompletados.map(item => ({
        mes: item.mes,
        cantidad: item.cantidad
      }))
    });
  } catch (err) {
    console.error("Error en dashboard ejecutivo:", err);
    res.status(500).json({ success: false, message: "Error al obtener datos del dashboard" });
  }
});

// Dashboard de Presupuestos
app.get("/api/dashboard/presupuestos", authenticateToken, async (req, res) => {
  try {
    // KPIs de presupuestos
    // Calculamos el presupuesto total planeado desde el historial o reconstruyéndolo
    const kpisQuery = `
      SELECT
        COALESCE(SUM(
          COALESCE(
            (SELECT presupuesto_total
             FROM proyectos_presupuestos_historial h
             WHERE h.id_proyecto = p.id_proyecto
             ORDER BY fecha_presupuesto ASC
             LIMIT 1),
            COALESCE(p.presupuesto_total, p.presupuesto, 0) + COALESCE(pe.total_pedidos, 0)
          )
        ), 0) as presupuestoTotal,
        COALESCE(SUM(COALESCE(pe.total_pedidos, 0)), 0) as presupuestoEjecutado
      FROM proyectos p
      LEFT JOIN (
        SELECT id_proyecto, SUM(importe_total) as total_pedidos
        FROM pedidos
        GROUP BY id_proyecto
      ) pe ON p.id_proyecto = pe.id_proyecto
    `;
    const kpisResult = await queryAsync(kpisQuery);
    const kpis = kpisResult[0] || {};

    // Calculamos el disponible después de obtener los valores
    kpis.presupuestoDisponible = (kpis.presupuestoTotal || 0) - (kpis.presupuestoEjecutado || 0);

    const eficienciaGasto = kpis.presupuestoTotal > 0
      ? (kpis.presupuestoEjecutado / kpis.presupuestoTotal) * 100
      : 0;

    // Distribución por categoría
    const categoriaQuery = `
      SELECT
        'Cristal' as categoria,
        SUM(COALESCE(presupuesto_cristal, 0)) as monto
      FROM proyectos
      UNION ALL
      SELECT
        'Aluminio' as categoria,
        SUM(COALESCE(presupuesto_aluminio, 0)) as monto
      FROM proyectos
      UNION ALL
      SELECT
        'Misceláneos' as categoria,
        SUM(COALESCE(presupuesto_miscelaneos, 0)) as monto
      FROM proyectos
    `;
    const distribucionPorCategoria = await queryAsync(categoriaQuery);

    // Top proyectos por inversión
    const topProyectosQuery = `
      SELECT
        nombre,
        COALESCE(presupuesto_total, presupuesto, 0) as presupuesto
      FROM proyectos
      ORDER BY presupuesto DESC
      LIMIT 10
    `;
    const topProyectos = await queryAsync(topProyectosQuery);

    // Variación presupuestal
    // Obtenemos el presupuesto planeado inicial desde el historial (primera entrada)
    // o sumamos las categorías actuales + el total ejecutado para reconstruir el presupuesto original
    const variacionQuery = `
      SELECT
        p.nombre as proyecto,
        COALESCE(
          (SELECT presupuesto_total
           FROM proyectos_presupuestos_historial h
           WHERE h.id_proyecto = p.id_proyecto
           ORDER BY fecha_presupuesto ASC
           LIMIT 1),
          COALESCE(p.presupuesto_total, p.presupuesto, 0) + COALESCE(total_ejecutado.ejecutado, 0)
        ) as planeado,
        COALESCE(total_ejecutado.ejecutado, 0) as ejecutado
      FROM proyectos p
      LEFT JOIN (
        SELECT id_proyecto, SUM(importe_total) as ejecutado
        FROM pedidos
        GROUP BY id_proyecto
      ) total_ejecutado ON p.id_proyecto = total_ejecutado.id_proyecto
      GROUP BY p.id_proyecto, p.nombre, p.presupuesto_total, p.presupuesto
      ORDER BY planeado DESC
      LIMIT 10
    `;
    const variacionPresupuestal = await queryAsync(variacionQuery);

    res.json({
      kpis: {
        presupuestoTotal: parseFloat(kpis.presupuestoTotal) || 0,
        presupuestoEjecutado: parseFloat(kpis.presupuestoEjecutado) || 0,
        presupuestoDisponible: parseFloat(kpis.presupuestoDisponible) || 0,
        eficienciaGasto: parseFloat(eficienciaGasto) || 0
      },
      distribucionPorCategoria: distribucionPorCategoria.map(item => ({
        categoria: item.categoria,
        monto: parseFloat(item.monto) || 0
      })).filter(item => item.monto > 0),
      topProyectos: topProyectos.map(item => ({
        nombre: item.nombre,
        presupuesto: parseFloat(item.presupuesto) || 0
      })),
      variacionPresupuestal: variacionPresupuestal.map(item => ({
        proyecto: item.proyecto,
        planeado: parseFloat(item.planeado) || 0,
        ejecutado: parseFloat(item.ejecutado) || 0
      }))
    });
  } catch (err) {
    console.error("Error en dashboard presupuestos:", err);
    res.status(500).json({ success: false, message: "Error al obtener datos del dashboard" });
  }
});

// Dashboard de Proyectos
app.get("/api/dashboard/proyectos", authenticateToken, async (req, res) => {
  try {
    // KPIs de proyectos
    const kpisQuery = `
      SELECT
        COUNT(*) as totalProyectos,
        SUM(CASE WHEN estado = 'en_progreso' THEN 1 ELSE 0 END) as proyectosEnProgreso,
        SUM(CASE WHEN estado = 'completado' THEN 1 ELSE 0 END) as proyectosCompletados,
        SUM(CASE WHEN estado = 'en_progreso' AND fecha_proyecto >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as proyectosPendientes
      FROM proyectos
    `;
    const kpisResult = await queryAsync(kpisQuery);
    const kpis = kpisResult[0] || {};

    const tasaCompletacion = kpis.totalProyectos > 0
      ? (kpis.proyectosCompletados / kpis.totalProyectos) * 100
      : 0;

    // Proyectos por estado
    const estadosQuery = `
      SELECT
        CASE
          WHEN estado = 'en_progreso' THEN 'En Progreso'
          WHEN estado = 'completado' THEN 'Completado'
          ELSE 'Desconocido'
        END as estado,
        COUNT(*) as cantidad
      FROM proyectos
      GROUP BY estado
    `;
    const proyectosPorEstado = await queryAsync(estadosQuery);

    // Proyectos críticos (con presupuesto > 60% utilizado)
    const criticosQuery = `
      SELECT
        p.id_proyecto as id,
        p.nombre,
        CASE
          WHEN p.estado = 'en_progreso' THEN 'En Progreso'
          WHEN p.estado = 'completado' THEN 'Completado'
          ELSE 'Desconocido'
        END as estado,
        CASE
          WHEN COALESCE(p.presupuesto_total, p.presupuesto, 0) > 0
          THEN (COALESCE(SUM(pe.importe_total), 0) / COALESCE(p.presupuesto_total, p.presupuesto, 1)) * 100
          ELSE 0
        END as presupuestoUtilizado,
        GREATEST(0, DATEDIFF(DATE_ADD(p.fecha_proyecto, INTERVAL 90 DAY), NOW())) as diasRestantes
      FROM proyectos p
      LEFT JOIN pedidos pe ON p.id_proyecto = pe.id_proyecto
      GROUP BY p.id_proyecto, p.nombre, p.presupuesto_total, p.presupuesto, p.fecha_proyecto
      HAVING presupuestoUtilizado > 60 OR diasRestantes < 30
      ORDER BY presupuestoUtilizado DESC, diasRestantes ASC
      LIMIT 10
    `;
    const proyectosCriticos = await queryAsync(criticosQuery);

    // Timeline de proyectos (últimos 6 meses)
    const timelineQuery = `
      SELECT
        DATE_FORMAT(fecha_proyecto, '%Y-%m') as mes,
        COUNT(*) as iniciados,
        SUM(CASE WHEN fecha_proyecto < DATE_SUB(NOW(), INTERVAL 90 DAY) THEN 1 ELSE 0 END) as completados
      FROM proyectos
      WHERE fecha_proyecto >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(fecha_proyecto, '%Y-%m')
      ORDER BY mes ASC
    `;
    const timelineProyectos = await queryAsync(timelineQuery);

    res.json({
      kpis: {
        totalProyectos: kpis.totalProyectos || 0,
        proyectosEnProgreso: kpis.proyectosEnProgreso || 0,
        proyectosCompletados: kpis.proyectosCompletados || 0,
        proyectosPendientes: kpis.proyectosPendientes || 0,
        tasaCompletacion: parseFloat(tasaCompletacion) || 0
      },
      proyectosPorEstado: proyectosPorEstado.map(item => ({
        estado: item.estado,
        cantidad: item.cantidad
      })),
      proyectosCriticos: proyectosCriticos.map(item => ({
        id: item.id,
        nombre: item.nombre,
        estado: item.estado,
        presupuestoUtilizado: parseFloat(item.presupuestoUtilizado) || 0,
        diasRestantes: item.diasRestantes || 0
      })),
      timelineProyectos: timelineProyectos.map(item => ({
        mes: item.mes,
        iniciados: item.iniciados || 0,
        completados: item.completados || 0
      }))
    });
  } catch (err) {
    console.error("Error en dashboard proyectos:", err);
    res.status(500).json({ success: false, message: "Error al obtener datos del dashboard" });
  }
});

// Dashboard de Materiales
app.get("/api/dashboard/materiales", authenticateToken, async (req, res) => {
  try {
    // KPIs de materiales
    const kpisQuery = `
      SELECT
        COUNT(DISTINCT concepto) as totalMateriales,
        COALESCE(SUM(importe_total), 0) as valorTotalInventario
      FROM pedidos
    `;
    const kpisResult = await queryAsync(kpisQuery);
    const kpis = kpisResult[0] || {};

    // Materiales más usados - usando descripción de las tablas de detalles
    const materialesQuery = `
      SELECT
        descripcion as material,
        SUM(cantidad) as cantidad,
        'unidad' as unidad
      FROM pedidos_detalles_miscelaneos
      GROUP BY descripcion
      ORDER BY cantidad DESC
      LIMIT 15
    `;
    const materialesMasUsados = await queryAsync(materialesQuery);

    // Costo por categoría (usando los tipos de presupuesto)
    const costoCategoriaQuery = `
      SELECT
        'Mano de Obra' as categoria,
        COALESCE(SUM(importe_total), 0) as costo
      FROM pedidos
      WHERE LOWER(concepto) LIKE '%mano%' OR LOWER(concepto) LIKE '%trabajo%'
      UNION ALL
      SELECT
        'Materiales' as categoria,
        COALESCE(SUM(importe_total), 0) as costo
      FROM pedidos
      WHERE LOWER(concepto) LIKE '%material%' OR LOWER(concepto) LIKE '%aluminio%' OR LOWER(concepto) LIKE '%cristal%'
      UNION ALL
      SELECT
        'Otros' as categoria,
        COALESCE(SUM(importe_total), 0) as costo
      FROM pedidos
      WHERE NOT (
        LOWER(concepto) LIKE '%mano%' OR
        LOWER(concepto) LIKE '%trabajo%' OR
        LOWER(concepto) LIKE '%material%' OR
        LOWER(concepto) LIKE '%aluminio%' OR
        LOWER(concepto) LIKE '%cristal%'
      )
    `;
    const costoPorCategoria = await queryAsync(costoCategoriaQuery);

    // Proveedores principales
    const proveedoresQuery = `
      SELECT
        proveedor,
        COUNT(*) as volumen
      FROM pedidos
      WHERE proveedor IS NOT NULL AND proveedor != ''
      GROUP BY proveedor
      ORDER BY volumen DESC
      LIMIT 10
    `;
    const proveedoresPrincipales = await queryAsync(proveedoresQuery);

    // Proyección de compras (usando explosión de insumos para proyectos en progreso)
    const proyeccionQuery = `
      SELECT
        ei.familia as material,
        SUM(ei.presupuesto_asignado) as cantidadRequerida,
        0 as cantidadDisponible,
        SUM(ei.presupuesto_asignado) as deficit,
        SUM(ei.presupuesto_asignado) as costoEstimado
      FROM explosion_insumos ei
      INNER JOIN proyectos p ON ei.id_proyecto = p.id_proyecto
      WHERE p.estado = 'en_progreso'
      GROUP BY ei.familia
      ORDER BY deficit DESC
      LIMIT 15
    `;
    const proyeccionCompras = await queryAsync(proyeccionQuery);

    // Tendencia de costos mensual (usando fecha_aprobacion)
    const tendenciaCostosQuery = `
      SELECT
        DATE_FORMAT(fecha_aprobacion, '%Y-%m') as mes,
        SUM(importe_total) as costo
      FROM pedidos
      WHERE fecha_aprobacion >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(fecha_aprobacion, '%Y-%m')
      ORDER BY mes ASC
    `;
    const tendenciaCostos = await queryAsync(tendenciaCostosQuery);

    res.json({
      kpis: {
        totalMateriales: kpis.totalMateriales || 0,
        valorTotalInventario: parseFloat(kpis.valorTotalInventario) || 0,
        materialesCriticos: proyeccionCompras.filter(item => item.deficit > 0).length,
        proveedoresActivos: proveedoresPrincipales.length
      },
      materialesMasUsados: materialesMasUsados.map(item => ({
        material: item.material,
        cantidad: parseFloat(item.cantidad) || 0,
        unidad: item.unidad
      })),
      costoPorCategoria: costoPorCategoria.map(item => ({
        categoria: item.categoria,
        costo: parseFloat(item.costo) || 0
      })).filter(item => item.costo > 0),
      proveedoresPrincipales: proveedoresPrincipales.map(item => ({
        proveedor: item.proveedor,
        volumen: item.volumen
      })),
      proyeccionCompras: proyeccionCompras.map(item => ({
        material: item.material,
        cantidadRequerida: parseFloat(item.cantidadRequerida) || 0,
        cantidadDisponible: parseFloat(item.cantidadDisponible) || 0,
        deficit: parseFloat(item.deficit) || 0,
        costoEstimado: parseFloat(item.costoEstimado) || 0
      })),
      tendenciaCostos: tendenciaCostos.map(item => ({
        mes: item.mes,
        costo: parseFloat(item.costo) || 0
      }))
    });
  } catch (err) {
    console.error("Error en dashboard materiales:", err);
    res.status(500).json({ success: false, message: "Error al obtener datos del dashboard" });
  }
});

//------------------------------------------------------------
// COBRANZA - Exportar tabla de cobranza a clientes (Excel)
// Formato similar a la hoja "COBRANZA TOTAL" del Excel original
//------------------------------------------------------------
app.get("/cobranza/export", authenticateToken, async (req, res) => {
  try {
    // Query para obtener datos de cobranza con indirectos
    const query = `
      SELECT
        p.id_proyecto,
        p.nombre AS proyecto,
        COALESCE(cp.codigo_control, '') AS codigo_control,
        COALESCE(p.presupuesto_total, p.presupuesto, 0) AS importe_contratado,
        COALESCE(facturas.total_cobrado, 0) AS importe_cobrado,
        (COALESCE(p.presupuesto_total, p.presupuesto, 0) - COALESCE(facturas.total_cobrado, 0)) AS importe_a_cobrar,
        COALESCE(cp.fondo_garantia, 0) AS fondo_garantia,
        (COALESCE(p.presupuesto_total, p.presupuesto, 0) - COALESCE(facturas.total_cobrado, 0) - COALESCE(cp.fondo_garantia, 0)) AS liquido_por_cobrar,
        COALESCE(facturas.saldo_pendiente, 0) AS facturas_por_cobrar,
        COALESCE(gastos_directos.total_pedidos, 0) AS total_pedidos,
        COALESCE(gastos_viaticos.total_viaticos, 0) AS total_viaticos,
        p.estado
      FROM proyectos p
      LEFT JOIN cobranza_proyecto cp ON cp.id_proyecto = p.id_proyecto
      LEFT JOIN (
        SELECT
          id_proyecto,
          SUM(importe_cobrado) AS total_cobrado,
          SUM(saldo_por_cobrar) AS saldo_pendiente
        FROM cobranza_facturas
        GROUP BY id_proyecto
      ) facturas ON facturas.id_proyecto = p.id_proyecto
      LEFT JOIN (
        SELECT id_proyecto, SUM(importe_total) AS total_pedidos
        FROM pedidos
        GROUP BY id_proyecto
      ) gastos_directos ON gastos_directos.id_proyecto = p.id_proyecto
      LEFT JOIN (
        SELECT id_proyecto, SUM(gastado) AS total_viaticos
        FROM viaticos_presupuestos
        GROUP BY id_proyecto
      ) gastos_viaticos ON gastos_viaticos.id_proyecto = p.id_proyecto
      WHERE p.estado = 'en_progreso'
      ORDER BY p.nombre ASC
    `;

    const rows = await queryAsync(query);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("COBRANZA TOTAL");

    // Logo
    try {
      const logoPath = path.join(__dirname, "assets", "heg_logo.jpg");
      const imgId = wb.addImage({ filename: logoPath, extension: "jpeg" });
      ws.addImage(imgId, { tl: { col: 0, row: 0 }, ext: { width: 180, height: 60 } });
    } catch (imgErr) {
      console.warn("No se pudo cargar el logo:", imgErr?.message || imgErr);
    }

    // Fecha formateada
    const now = new Date();
    const meses = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
    const fechaTitulo = `${now.getDate()} DE ${meses[now.getMonth()]} DEL ${now.getFullYear()}`;
    const pad2 = (n) => String(n).padStart(2, "0");
    const fechaArchivo = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;

    // Título
    ws.getCell("C2").value = "HEG DISEÑO E INSTALACION SA DE CV";
    ws.getCell("C2").font = { bold: true, size: 12 };
    ws.getCell("C3").value = "TABLA DE COBRANZA A CLIENTES";
    ws.getCell("C3").font = { bold: true, size: 11 };
    ws.getCell("C4").value = fechaTitulo;
    ws.getCell("C4").font = { size: 10 };

    // Sección "OBRAS EN PROCESO"
    ws.getCell("A6").value = "OBRAS EN PROCESO";
    ws.getCell("A6").font = { bold: true, size: 10 };

    // Encabezados principales (fila 7)
    const headerRowIndex = 7;

    // Encabezado de grupo INDIRECTOS (fila 6, columnas M-Q)
    ws.mergeCells("M6:Q6");
    ws.getCell("M6").value = "INDIRECTOS";
    ws.getCell("M6").font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getCell("M6").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } };
    ws.getCell("M6").alignment = { horizontal: "center", vertical: "middle" };
    ws.getCell("M6").border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };

    // Encabezados de columnas
    const headers = [
      { col: 1, text: "N", width: 5 },
      { col: 2, text: "PROYECTO", width: 35 },
      { col: 3, text: "CONTROL", width: 10 },
      { col: 4, text: "IMPORTE CONTRATADO", width: 20 },
      { col: 5, text: "IMPORTE COBRADO", width: 18 },
      { col: 6, text: "IMPORTE A COBRAR", width: 18 },
      { col: 7, text: "FONDO DE GARANTÍA", width: 18 },
      { col: 8, text: "LÍQUIDO POR COBRAR", width: 20 },
      { col: 9, text: "FACTURAS POR COBRAR", width: 20 },
      { col: 10, text: "APLICADO", width: 18 },
      { col: 11, text: "COBRADO VS APLICADO", width: 20 },
      // INDIRECTOS
      { col: 12, text: "FACTOR", width: 10 },
      { col: 13, text: "ESPERADO", width: 18 },
      { col: 14, text: "COBRADO", width: 18 },
      { col: 15, text: "APLICADO", width: 18 },
      { col: 16, text: "COBRADO VS APLICADO", width: 20 }
    ];

    const headerRow = ws.getRow(headerRowIndex);
    headers.forEach(h => {
      const cell = headerRow.getCell(h.col);
      cell.value = h.text;
      cell.font = { bold: true, size: 9 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } }; // Amarillo
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
      ws.getColumn(h.col).width = h.width;
    });
    headerRow.height = 30;

    // Estilos de borde
    const borderThin = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };

    // Variables para totales
    let totales = {
      importe_contratado: 0,
      importe_cobrado: 0,
      importe_a_cobrar: 0,
      fondo_garantia: 0,
      liquido_por_cobrar: 0,
      facturas_por_cobrar: 0,
      aplicado: 0,
      cobrado_vs_aplicado: 0,
      indirecto_esperado: 0,
      indirecto_cobrado: 0,
      indirecto_aplicado: 0,
      indirecto_cobrado_vs_aplicado: 0
    };

    // Factor de indirectos (30% típico para costos indirectos)
    const FACTOR_INDIRECTOS = 0.30;

    // Datos de proyectos
    rows.forEach((row, idx) => {
      const dataRow = ws.getRow(headerRowIndex + 1 + idx);

      const importeContratado = parseFloat(row.importe_contratado) || 0;
      const importeCobrado = parseFloat(row.importe_cobrado) || 0;
      const importeACobrar = parseFloat(row.importe_a_cobrar) || 0;
      const fondoGarantia = parseFloat(row.fondo_garantia) || 0;
      const liquidoPorCobrar = parseFloat(row.liquido_por_cobrar) || 0;
      const facturasPorCobrar = parseFloat(row.facturas_por_cobrar) || 0;
      const totalPedidos = parseFloat(row.total_pedidos) || 0;
      const totalViaticos = parseFloat(row.total_viaticos) || 0;
      const aplicado = totalPedidos + totalViaticos;
      const cobradoVsAplicado = importeCobrado - aplicado;

      // Cálculos de indirectos
      const indirectoEsperado = importeContratado * FACTOR_INDIRECTOS;
      const indirectoCobrado = importeCobrado * FACTOR_INDIRECTOS;
      const indirectoAplicado = totalViaticos; // Viáticos son gastos indirectos
      const indirectoCobradoVsAplicado = indirectoCobrado - indirectoAplicado;

      // Valores de fila
      dataRow.getCell(1).value = idx + 1;
      dataRow.getCell(2).value = row.proyecto;
      dataRow.getCell(3).value = row.codigo_control;
      dataRow.getCell(4).value = importeContratado;
      dataRow.getCell(5).value = importeCobrado;
      dataRow.getCell(6).value = importeACobrar;
      dataRow.getCell(7).value = fondoGarantia;
      dataRow.getCell(8).value = liquidoPorCobrar;
      dataRow.getCell(9).value = facturasPorCobrar;
      dataRow.getCell(10).value = aplicado;
      dataRow.getCell(11).value = cobradoVsAplicado;
      // Indirectos
      dataRow.getCell(12).value = FACTOR_INDIRECTOS;
      dataRow.getCell(13).value = indirectoEsperado;
      dataRow.getCell(14).value = indirectoCobrado;
      dataRow.getCell(15).value = indirectoAplicado;
      dataRow.getCell(16).value = indirectoCobradoVsAplicado;

      // Estilos para cada celda
      for (let col = 1; col <= 16; col++) {
        const cell = dataRow.getCell(col);
        cell.border = borderThin;
        cell.alignment = { vertical: "middle", horizontal: col === 2 ? "left" : (col === 1 || col === 3 ? "center" : "right") };
      }

      // Formato moneda
      [4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16].forEach(col => {
        dataRow.getCell(col).numFmt = '"$"#,##0.00';
      });

      // Formato porcentaje para factor
      dataRow.getCell(12).numFmt = '0%';

      // Resaltar números rojos
      if (cobradoVsAplicado < 0) {
        dataRow.getCell(11).font = { color: { argb: "FFFF0000" }, bold: true };
        dataRow.getCell(11).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFCCCC" } };
      }
      if (indirectoCobradoVsAplicado < 0) {
        dataRow.getCell(16).font = { color: { argb: "FFFF0000" }, bold: true };
        dataRow.getCell(16).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFCCCC" } };
      }

      // Acumular totales
      totales.importe_contratado += importeContratado;
      totales.importe_cobrado += importeCobrado;
      totales.importe_a_cobrar += importeACobrar;
      totales.fondo_garantia += fondoGarantia;
      totales.liquido_por_cobrar += liquidoPorCobrar;
      totales.facturas_por_cobrar += facturasPorCobrar;
      totales.aplicado += aplicado;
      totales.cobrado_vs_aplicado += cobradoVsAplicado;
      totales.indirecto_esperado += indirectoEsperado;
      totales.indirecto_cobrado += indirectoCobrado;
      totales.indirecto_aplicado += indirectoAplicado;
      totales.indirecto_cobrado_vs_aplicado += indirectoCobradoVsAplicado;
    });

    // Fila de totales
    const totalRowIndex = headerRowIndex + 1 + rows.length;
    const totalRow = ws.getRow(totalRowIndex);

    totalRow.getCell(1).value = "";
    totalRow.getCell(2).value = "TOTALES";
    totalRow.getCell(3).value = "";
    totalRow.getCell(4).value = totales.importe_contratado;
    totalRow.getCell(5).value = totales.importe_cobrado;
    totalRow.getCell(6).value = totales.importe_a_cobrar;
    totalRow.getCell(7).value = totales.fondo_garantia;
    totalRow.getCell(8).value = totales.liquido_por_cobrar;
    totalRow.getCell(9).value = totales.facturas_por_cobrar;
    totalRow.getCell(10).value = totales.aplicado;
    totalRow.getCell(11).value = totales.cobrado_vs_aplicado;
    totalRow.getCell(12).value = "";
    totalRow.getCell(13).value = totales.indirecto_esperado;
    totalRow.getCell(14).value = totales.indirecto_cobrado;
    totalRow.getCell(15).value = totales.indirecto_aplicado;
    totalRow.getCell(16).value = totales.indirecto_cobrado_vs_aplicado;

    // Estilo fila totales
    for (let col = 1; col <= 16; col++) {
      const cell = totalRow.getCell(col);
      cell.font = { bold: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF000000" } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.border = borderThin;
      cell.alignment = { vertical: "middle", horizontal: col === 2 ? "left" : (col === 1 || col === 3 ? "center" : "right") };
    }

    // Formato moneda en totales
    [4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16].forEach(col => {
      totalRow.getCell(col).numFmt = '"$"#,##0.00';
    });

    // Resaltar totales negativos
    if (totales.cobrado_vs_aplicado < 0) {
      totalRow.getCell(11).font = { bold: true, color: { argb: "FFFF6666" } };
    }
    if (totales.indirecto_cobrado_vs_aplicado < 0) {
      totalRow.getCell(16).font = { bold: true, color: { argb: "FFFF6666" } };
    }

    // Congelar encabezados
    ws.views = [{ state: "frozen", ySplit: headerRowIndex }];

    // Enviar archivo
    const filename = `cobranza_total_${fechaArchivo}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Error generando Excel de cobranza:", err);
    res.status(500).json({ success: false, message: "Error generando archivo" });
  }
});

//------------------------------------------------------------
// COBRANZA GENERAL - Nuevo módulo
//------------------------------------------------------------

// IMPORTANTE: El endpoint /export debe estar ANTES del endpoint base para que Express lo reconozca
// Exportar cobranza general a Excel
app.get("/cobranza-general/export", authenticateToken, async (req, res) => {
  try {
    // Calcula importe_cobrado automáticamente desde la suma de facturas
    const query = `
      SELECT
        p.id_proyecto,
        p.nombre AS proyecto,
        COALESCE(cp.codigo_control, '') AS codigo_control,
        COALESCE(p.presupuesto_total, p.presupuesto, 0) AS importe_contratado,
        COALESCE(facturas.total_cobrado, 0) AS importe_cobrado,
        (COALESCE(p.presupuesto_total, p.presupuesto, 0) - COALESCE(facturas.total_cobrado, 0)) AS importe_a_cobrar,
        COALESCE(cp.fondo_garantia, 0) AS fondo_garantia,
        (COALESCE(p.presupuesto_total, p.presupuesto, 0) - COALESCE(facturas.total_cobrado, 0) - COALESCE(cp.fondo_garantia, 0)) AS liquido_por_cobrar,
        COALESCE(facturas.saldo_pendiente, 0) AS facturas_por_cobrar,
        COALESCE(gastos.total_aplicado, 0) AS aplicado,
        (COALESCE(facturas.total_cobrado, 0) - COALESCE(gastos.total_aplicado, 0)) AS cobrado_vs_aplicado,
        p.estado
      FROM proyectos p
      LEFT JOIN cobranza_proyecto cp ON cp.id_proyecto = p.id_proyecto
      LEFT JOIN (
        SELECT
          id_proyecto,
          SUM(importe_cobrado) AS total_cobrado,
          SUM(saldo_por_cobrar) AS saldo_pendiente
        FROM cobranza_facturas
        GROUP BY id_proyecto
      ) facturas ON facturas.id_proyecto = p.id_proyecto
      LEFT JOIN (
        SELECT
          ped.id_proyecto,
          COALESCE(SUM(ped.importe_total), 0) + COALESCE(MAX(viat.total_viaticos), 0) AS total_aplicado
        FROM pedidos ped
        LEFT JOIN (
          SELECT id_proyecto, SUM(gastado) AS total_viaticos
          FROM viaticos_presupuestos
          GROUP BY id_proyecto
        ) viat ON viat.id_proyecto = ped.id_proyecto
        GROUP BY ped.id_proyecto
      ) gastos ON gastos.id_proyecto = p.id_proyecto
      ORDER BY p.nombre ASC
    `;

    const rows = await queryAsync(query);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Cobranza General");

    // Logo
    try {
      const logoPath = path.join(__dirname, "assets", "heg_logo.jpg");
      const imgId = wb.addImage({ filename: logoPath, extension: "jpeg" });
      ws.addImage(imgId, { tl: { col: 0, row: 0 }, ext: { width: 220, height: 80 } });
    } catch (imgErr) {
      console.warn("No se pudo cargar el logo:", imgErr?.message || imgErr);
    }

    // Título
    const now = new Date();
    const pad2 = (n) => String(n).padStart(2, "0");
    const fechaGeneracion = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;

    ws.getCell("B2").value = "HEG DISEÑO E INSTALACION SA DE CV";
    ws.getCell("B2").font = { bold: true, size: 14 };
    ws.getCell("B3").value = "TABLA DE COBRANZA A CLIENTES";
    ws.getCell("B3").font = { bold: true, size: 12 };
    ws.getCell("B4").value = fechaGeneracion;

    // Encabezados
    const headerRowIndex = 6;
    const headers = [
      "N°", "PROYECTO", "CONTROL", "IMPORTE CONTRATADO", "IMPORTE COBRADO",
      "IMPORTE A COBRAR", "FONDO DE GARANTÍA", "LÍQUIDO POR COBRAR",
      "FACTURAS POR COBRAR", "APLICADO", "COBRADO VS APLICADO", "ESTADO"
    ];

    const headerRow = ws.getRow(headerRowIndex);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" }
      };
    });

    // Anchos de columna
    ws.getColumn(1).width = 6;
    ws.getColumn(2).width = 35;
    ws.getColumn(3).width = 12;
    ws.getColumn(4).width = 20;
    ws.getColumn(5).width = 18;
    ws.getColumn(6).width = 18;
    ws.getColumn(7).width = 18;
    ws.getColumn(8).width = 18;
    ws.getColumn(9).width = 20;
    ws.getColumn(10).width = 18;
    ws.getColumn(11).width = 20;
    ws.getColumn(12).width = 14;

    // Datos
    let totalesExport = {
      importe_contratado: 0,
      importe_cobrado: 0,
      importe_a_cobrar: 0,
      fondo_garantia: 0,
      liquido_por_cobrar: 0,
      facturas_por_cobrar: 0,
      aplicado: 0,
      cobrado_vs_aplicado: 0
    };

    // Estilos reutilizables
    const borderThin = {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" }
    };
    const fillEven = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    const fillOdd = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
    const fillRojo = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF2F2" } };

    rows.forEach((row, idx) => {
      const dataRow = ws.getRow(headerRowIndex + 1 + idx);
      const cobradoVsAplicado = parseFloat(row.cobrado_vs_aplicado) || 0;
      const enRojo = cobradoVsAplicado < 0;

      dataRow.getCell(1).value = idx + 1;
      dataRow.getCell(2).value = row.proyecto;
      dataRow.getCell(3).value = row.codigo_control;
      dataRow.getCell(4).value = parseFloat(row.importe_contratado) || 0;
      dataRow.getCell(5).value = parseFloat(row.importe_cobrado) || 0;
      dataRow.getCell(6).value = parseFloat(row.importe_a_cobrar) || 0;
      dataRow.getCell(7).value = parseFloat(row.fondo_garantia) || 0;
      dataRow.getCell(8).value = parseFloat(row.liquido_por_cobrar) || 0;
      dataRow.getCell(9).value = parseFloat(row.facturas_por_cobrar) || 0;
      dataRow.getCell(10).value = parseFloat(row.aplicado) || 0;
      dataRow.getCell(11).value = cobradoVsAplicado;
      dataRow.getCell(12).value = row.estado === "en_progreso" ? "En progreso" : "Completado";

      // Aplicar estilos a todas las celdas de la fila
      for (let col = 1; col <= 12; col++) {
        const cell = dataRow.getCell(col);
        cell.border = borderThin;
        cell.alignment = { vertical: "middle", horizontal: col <= 3 || col === 12 ? "center" : "right" };

        // Color de fondo: rojo si está en números rojos, alternado si no
        if (enRojo) {
          cell.fill = fillRojo;
        } else {
          cell.fill = idx % 2 === 0 ? fillEven : fillOdd;
        }
      }

      // Nombre de proyecto alineado a la izquierda
      dataRow.getCell(2).alignment = { vertical: "middle", horizontal: "left" };

      // Resaltar cobrado vs aplicado negativo
      if (enRojo) {
        dataRow.getCell(11).font = { color: { argb: "FFDC2626" }, bold: true };
      }

      // Formato moneda para columnas numéricas
      [4, 5, 6, 7, 8, 9, 10, 11].forEach(col => {
        dataRow.getCell(col).numFmt = '"$"#,##0.00';
      });

      // Acumular totales
      totalesExport.importe_contratado += parseFloat(row.importe_contratado) || 0;
      totalesExport.importe_cobrado += parseFloat(row.importe_cobrado) || 0;
      totalesExport.importe_a_cobrar += parseFloat(row.importe_a_cobrar) || 0;
      totalesExport.fondo_garantia += parseFloat(row.fondo_garantia) || 0;
      totalesExport.liquido_por_cobrar += parseFloat(row.liquido_por_cobrar) || 0;
      totalesExport.facturas_por_cobrar += parseFloat(row.facturas_por_cobrar) || 0;
      totalesExport.aplicado += parseFloat(row.aplicado) || 0;
      totalesExport.cobrado_vs_aplicado += cobradoVsAplicado;
    });

    // Fila de totales con estilo de encabezado
    const totalRowIndex = headerRowIndex + 1 + rows.length;
    const totalRow = ws.getRow(totalRowIndex);
    totalRow.getCell(1).value = "";
    totalRow.getCell(2).value = "TOTALES";
    totalRow.getCell(3).value = "";
    totalRow.getCell(4).value = totalesExport.importe_contratado;
    totalRow.getCell(5).value = totalesExport.importe_cobrado;
    totalRow.getCell(6).value = totalesExport.importe_a_cobrar;
    totalRow.getCell(7).value = totalesExport.fondo_garantia;
    totalRow.getCell(8).value = totalesExport.liquido_por_cobrar;
    totalRow.getCell(9).value = totalesExport.facturas_por_cobrar;
    totalRow.getCell(10).value = totalesExport.aplicado;
    totalRow.getCell(11).value = totalesExport.cobrado_vs_aplicado;
    totalRow.getCell(12).value = "";

    // Aplicar estilo de encabezado a la fila de totales
    for (let col = 1; col <= 12; col++) {
      const cell = totalRow.getCell(col);
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } };
      cell.border = borderThin;
      cell.alignment = { vertical: "middle", horizontal: col <= 3 || col === 12 ? "center" : "right" };
    }
    totalRow.getCell(2).alignment = { vertical: "middle", horizontal: "left" };

    // Color especial para cobrado vs aplicado negativo en totales
    if (totalesExport.cobrado_vs_aplicado < 0) {
      totalRow.getCell(11).font = { bold: true, color: { argb: "FFFCA5A5" } };
    }

    // Formato moneda en totales
    [4, 5, 6, 7, 8, 9, 10, 11].forEach(col => {
      totalRow.getCell(col).numFmt = '"$"#,##0.00';
    });

    // Congelar encabezados
    ws.views = [{ state: "frozen", ySplit: headerRowIndex }];

    const filename = `cobranza_general_${fechaGeneracion}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Error generando Excel de cobranza general:", err);
    res.status(500).json({ success: false, message: "Error generando archivo" });
  }
});

// Obtener resumen de cobranza de TODOS los proyectos (similar a hoja COBRANZA TOTAL)
app.get("/cobranza-general", authenticateToken, async (req, res) => {
  try {
    // El importe_cobrado se calcula automáticamente desde las facturas
    const query = `
      SELECT
        p.id_proyecto,
        p.nombre AS proyecto,
        COALESCE(cp.codigo_control, '') AS codigo_control,
        COALESCE(p.presupuesto_total, p.presupuesto, 0) AS importe_contratado,
        COALESCE(facturas.total_cobrado, 0) AS importe_cobrado,
        (COALESCE(p.presupuesto_total, p.presupuesto, 0) - COALESCE(facturas.total_cobrado, 0)) AS importe_a_cobrar,
        COALESCE(cp.fondo_garantia, 0) AS fondo_garantia,
        (COALESCE(p.presupuesto_total, p.presupuesto, 0) - COALESCE(facturas.total_cobrado, 0) - COALESCE(cp.fondo_garantia, 0)) AS liquido_por_cobrar,
        COALESCE(facturas.saldo_pendiente, 0) AS facturas_por_cobrar,
        COALESCE(gastos.total_aplicado, 0) AS aplicado,
        (COALESCE(facturas.total_cobrado, 0) - COALESCE(gastos.total_aplicado, 0)) AS cobrado_vs_aplicado,
        p.estado
      FROM proyectos p
      LEFT JOIN cobranza_proyecto cp ON cp.id_proyecto = p.id_proyecto
      LEFT JOIN (
        SELECT
          id_proyecto,
          SUM(importe_cobrado) AS total_cobrado,
          SUM(saldo_por_cobrar) AS saldo_pendiente
        FROM cobranza_facturas
        GROUP BY id_proyecto
      ) facturas ON facturas.id_proyecto = p.id_proyecto
      LEFT JOIN (
        SELECT
          p2.id_proyecto,
          COALESCE(SUM(ped.importe_total), 0) + COALESCE(viat.total_viaticos, 0) AS total_aplicado
        FROM proyectos p2
        LEFT JOIN pedidos ped ON ped.id_proyecto = p2.id_proyecto
        LEFT JOIN (
          SELECT id_proyecto, SUM(gastado) AS total_viaticos
          FROM viaticos_presupuestos
          GROUP BY id_proyecto
        ) viat ON viat.id_proyecto = p2.id_proyecto
        GROUP BY p2.id_proyecto, viat.total_viaticos
      ) gastos ON gastos.id_proyecto = p.id_proyecto
      ORDER BY p.nombre ASC
    `;

    const results = await queryAsync(query);

    // Calcular totales
    const totales = results.reduce((acc, row) => {
      acc.importe_contratado += parseFloat(row.importe_contratado) || 0;
      acc.importe_cobrado += parseFloat(row.importe_cobrado) || 0;
      acc.importe_a_cobrar += parseFloat(row.importe_a_cobrar) || 0;
      acc.fondo_garantia += parseFloat(row.fondo_garantia) || 0;
      acc.liquido_por_cobrar += parseFloat(row.liquido_por_cobrar) || 0;
      acc.facturas_por_cobrar += parseFloat(row.facturas_por_cobrar) || 0;
      acc.aplicado += parseFloat(row.aplicado) || 0;
      acc.cobrado_vs_aplicado += parseFloat(row.cobrado_vs_aplicado) || 0;
      return acc;
    }, {
      importe_contratado: 0,
      importe_cobrado: 0,
      importe_a_cobrar: 0,
      fondo_garantia: 0,
      liquido_por_cobrar: 0,
      facturas_por_cobrar: 0,
      aplicado: 0,
      cobrado_vs_aplicado: 0
    });

    res.json({
      success: true,
      data: results,
      totales,
      proyectos_en_rojo: results.filter(r => parseFloat(r.cobrado_vs_aplicado) < 0).length
    });
  } catch (err) {
    console.error("Error consultando cobranza general:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
});

// Obtener cobranza de un proyecto específico
app.get("/proyectos/:id/cobranza-resumen", authenticateToken, async (req, res) => {
  try {
    const proyectoId = Number(req.params.id);
    if (!Number.isInteger(proyectoId) || proyectoId <= 0) {
      return res.status(400).json({ success: false, message: "Proyecto inválido" });
    }

    // Calcula importe_cobrado automáticamente desde la suma de facturas
    const query = `
      SELECT
        p.id_proyecto,
        p.nombre AS proyecto,
        COALESCE(cp.codigo_control, '') AS codigo_control,
        COALESCE(p.presupuesto_total, p.presupuesto, 0) AS importe_contratado,
        COALESCE(facturas.total_cobrado, 0) AS importe_cobrado,
        (COALESCE(p.presupuesto_total, p.presupuesto, 0) - COALESCE(facturas.total_cobrado, 0)) AS importe_a_cobrar,
        COALESCE(cp.fondo_garantia, 0) AS fondo_garantia,
        (COALESCE(p.presupuesto_total, p.presupuesto, 0) - COALESCE(facturas.total_cobrado, 0) - COALESCE(cp.fondo_garantia, 0)) AS liquido_por_cobrar,
        COALESCE(facturas.saldo_pendiente, 0) AS facturas_por_cobrar,
        COALESCE(gastos.total_pedidos, 0) AS total_pedidos,
        COALESCE(gastos.total_viaticos, 0) AS total_viaticos,
        (COALESCE(gastos.total_pedidos, 0) + COALESCE(gastos.total_viaticos, 0)) AS aplicado,
        (COALESCE(facturas.total_cobrado, 0) - COALESCE(gastos.total_pedidos, 0) - COALESCE(gastos.total_viaticos, 0)) AS cobrado_vs_aplicado,
        p.estado,
        COALESCE(cp.factor_indirectos, 0.20) AS factor_indirectos,
        COALESCE(cp.indirectos_aplicados, 0) AS indirectos_aplicados
      FROM proyectos p
      LEFT JOIN cobranza_proyecto cp ON cp.id_proyecto = p.id_proyecto
      LEFT JOIN (
        SELECT
          id_proyecto,
          SUM(importe_cobrado) AS total_cobrado,
          SUM(saldo_por_cobrar) AS saldo_pendiente
        FROM cobranza_facturas
        GROUP BY id_proyecto
      ) facturas ON facturas.id_proyecto = p.id_proyecto
      LEFT JOIN (
        SELECT
          p2.id_proyecto,
          COALESCE(SUM(ped.importe_total), 0) AS total_pedidos,
          COALESCE(viat.total_viaticos, 0) AS total_viaticos
        FROM proyectos p2
        LEFT JOIN pedidos ped ON ped.id_proyecto = p2.id_proyecto
        LEFT JOIN (
          SELECT id_proyecto, SUM(gastado) AS total_viaticos
          FROM viaticos_presupuestos
          GROUP BY id_proyecto
        ) viat ON viat.id_proyecto = p2.id_proyecto
        GROUP BY p2.id_proyecto, viat.total_viaticos
      ) gastos ON gastos.id_proyecto = p.id_proyecto
      WHERE p.id_proyecto = ?
    `;

    const results = await queryAsync(query, [proyectoId]);

    if (!results || results.length === 0) {
      return res.status(404).json({ success: false, message: "Proyecto no encontrado" });
    }

    // Agregar cálculos de indirectos
    const row = results[0];
    const importeContratado = parseFloat(row.importe_contratado) || 0;
    const importeCobrado = parseFloat(row.importe_cobrado) || 0;
    const factorIndirectos = parseFloat(row.factor_indirectos) || 0.20;
    const indirectosAplicados = parseFloat(row.indirectos_aplicados) || 0;

    row.indirectos_esperado = importeContratado * factorIndirectos;
    row.indirectos_cobrado = importeCobrado * factorIndirectos;
    row.indirectos_cobrado_vs_aplicado = row.indirectos_cobrado - indirectosAplicados;

    res.json({ success: true, data: row });
  } catch (err) {
    console.error("Error consultando cobranza del proyecto:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
});

// Actualizar datos de cobranza de un proyecto (código control, fondo garantía e indirectos)
// Nota: importe_cobrado se calcula automáticamente desde las facturas
app.put("/proyectos/:id/cobranza-resumen", authenticateToken, requireRole("contador"), async (req, res) => {
  try {
    const proyectoId = Number(req.params.id);
    const { codigo_control, fondo_garantia, factor_indirectos, indirectos_aplicados } = req.body || {};
    const username = req.user?.username || "unknown";

    if (!Number.isInteger(proyectoId) || proyectoId <= 0) {
      return res.status(400).json({ success: false, message: "Proyecto inválido" });
    }

    const fondoGarantiaVal = Number(fondo_garantia);
    const factorIndirectosVal = Number(factor_indirectos);
    const indirectosAplicadosVal = Number(indirectos_aplicados);

    if (fondo_garantia !== undefined && (!Number.isFinite(fondoGarantiaVal) || fondoGarantiaVal < 0)) {
      return res.status(400).json({ success: false, message: "Fondo de garantía inválido" });
    }

    if (factor_indirectos !== undefined && (!Number.isFinite(factorIndirectosVal) || factorIndirectosVal < 0 || factorIndirectosVal > 1)) {
      return res.status(400).json({ success: false, message: "Factor de indirectos inválido (debe ser entre 0 y 1)" });
    }

    if (indirectos_aplicados !== undefined && (!Number.isFinite(indirectosAplicadosVal) || indirectosAplicadosVal < 0)) {
      return res.status(400).json({ success: false, message: "Indirectos aplicados inválido" });
    }

    const query = `
      INSERT INTO cobranza_proyecto (id_proyecto, codigo_control, fondo_garantia, factor_indirectos, indirectos_aplicados, nombre_usuario)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        codigo_control = COALESCE(VALUES(codigo_control), codigo_control),
        fondo_garantia = COALESCE(VALUES(fondo_garantia), fondo_garantia),
        factor_indirectos = COALESCE(VALUES(factor_indirectos), factor_indirectos),
        indirectos_aplicados = COALESCE(VALUES(indirectos_aplicados), indirectos_aplicados),
        nombre_usuario = VALUES(nombre_usuario)
    `;

    await queryAsync(query, [
      proyectoId,
      codigo_control || null,
      fondo_garantia !== undefined ? fondoGarantiaVal : null,
      factor_indirectos !== undefined ? factorIndirectosVal : null,
      indirectos_aplicados !== undefined ? indirectosAplicadosVal : null,
      username
    ]);

    res.json({ success: true, message: "Cobranza actualizada correctamente" });
  } catch (err) {
    console.error("Error actualizando cobranza del proyecto:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
});

// Obtener facturas de cobranza de un proyecto
app.get("/proyectos/:id/cobranza-facturas", authenticateToken, async (req, res) => {
  try {
    const proyectoId = Number(req.params.id);
    if (!Number.isInteger(proyectoId) || proyectoId <= 0) {
      return res.status(400).json({ success: false, message: "Proyecto inválido" });
    }

    const query = `
      SELECT
        id_factura,
        numero,
        DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha,
        numero_factura,
        concepto,
        importe_a_cobrar,
        importe_cobrado,
        saldo_por_cobrar,
        DATE_FORMAT(fecha_pago, '%Y-%m-%d') AS fecha_pago,
        periodo,
        nombre_usuario
      FROM cobranza_facturas
      WHERE id_proyecto = ?
      ORDER BY numero ASC, fecha_registro DESC
    `;

    const results = await queryAsync(query, [proyectoId]);
    res.json({ success: true, data: results || [] });
  } catch (err) {
    console.error("Error consultando facturas de cobranza:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
});

// Agregar factura de cobranza
app.post("/proyectos/:id/cobranza-facturas", authenticateToken, requireRole("contador"), async (req, res) => {
  try {
    const proyectoId = Number(req.params.id);
    const {
      numero,
      fecha,
      numero_factura,
      concepto,
      importe_a_cobrar,
      importe_cobrado,
      fecha_pago,
      periodo
    } = req.body || {};
    const username = req.user?.username || "unknown";

    if (!Number.isInteger(proyectoId) || proyectoId <= 0) {
      return res.status(400).json({ success: false, message: "Proyecto inválido" });
    }

    if (!concepto || concepto.trim() === "") {
      return res.status(400).json({ success: false, message: "El concepto es requerido" });
    }

    const importeACobrarVal = Number(importe_a_cobrar) || 0;
    const importeCobradoVal = Number(importe_cobrado) || 0;
    const saldoPorCobrar = importeACobrarVal - importeCobradoVal;

    const query = `
      INSERT INTO cobranza_facturas
        (id_proyecto, numero, fecha, numero_factura, concepto, importe_a_cobrar, importe_cobrado, saldo_por_cobrar, fecha_pago, periodo, nombre_usuario)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await queryAsync(query, [
      proyectoId,
      numero ? Number(numero) : null,
      parseDateToISO(fecha) || null,
      numero_factura || null,
      concepto.trim(),
      importeACobrarVal,
      importeCobradoVal,
      saldoPorCobrar,
      parseDateToISO(fecha_pago) || null,
      periodo || null,
      username
    ]);

    res.status(201).json({ success: true, id_factura: result.insertId });
  } catch (err) {
    console.error("Error insertando factura de cobranza:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
});

// Actualizar factura de cobranza
app.put("/proyectos/:id/cobranza-facturas/:idFactura", authenticateToken, requireRole("contador"), async (req, res) => {
  try {
    const proyectoId = Number(req.params.id);
    const idFactura = Number(req.params.idFactura);
    const {
      numero,
      fecha,
      numero_factura,
      concepto,
      importe_a_cobrar,
      importe_cobrado,
      fecha_pago,
      periodo
    } = req.body || {};
    const username = req.user?.username || "unknown";

    if (!Number.isInteger(proyectoId) || proyectoId <= 0) {
      return res.status(400).json({ success: false, message: "Proyecto inválido" });
    }
    if (!Number.isInteger(idFactura) || idFactura <= 0) {
      return res.status(400).json({ success: false, message: "Factura inválida" });
    }

    const importeACobrarVal = Number(importe_a_cobrar) || 0;
    const importeCobradoVal = Number(importe_cobrado) || 0;
    const saldoPorCobrar = importeACobrarVal - importeCobradoVal;

    const query = `
      UPDATE cobranza_facturas SET
        numero = ?,
        fecha = ?,
        numero_factura = ?,
        concepto = ?,
        importe_a_cobrar = ?,
        importe_cobrado = ?,
        saldo_por_cobrar = ?,
        fecha_pago = ?,
        periodo = ?,
        nombre_usuario = ?
      WHERE id_factura = ? AND id_proyecto = ?
    `;

    const result = await queryAsync(query, [
      numero ? Number(numero) : null,
      parseDateToISO(fecha) || null,
      numero_factura || null,
      concepto || null,
      importeACobrarVal,
      importeCobradoVal,
      saldoPorCobrar,
      parseDateToISO(fecha_pago) || null,
      periodo || null,
      username,
      idFactura,
      proyectoId
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Factura no encontrada" });
    }

    res.json({ success: true, message: "Factura actualizada correctamente" });
  } catch (err) {
    console.error("Error actualizando factura de cobranza:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
});

// Eliminar factura de cobranza
app.delete("/proyectos/:id/cobranza-facturas/:idFactura", authenticateToken, requireRole("contador"), async (req, res) => {
  try {
    const proyectoId = Number(req.params.id);
    const idFactura = Number(req.params.idFactura);

    if (!Number.isInteger(proyectoId) || proyectoId <= 0) {
      return res.status(400).json({ success: false, message: "Proyecto inválido" });
    }
    if (!Number.isInteger(idFactura) || idFactura <= 0) {
      return res.status(400).json({ success: false, message: "Factura inválida" });
    }

    const result = await queryAsync(
      "DELETE FROM cobranza_facturas WHERE id_factura = ? AND id_proyecto = ?",
      [idFactura, proyectoId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Factura no encontrada" });
    }

    res.json({ success: true, message: "Factura eliminada correctamente" });
  } catch (err) {
    console.error("Error eliminando factura de cobranza:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
});

app.listen(PORT, () => {
  console.log(` Servidor corriendo en http://localhost:${PORT}`);
});
