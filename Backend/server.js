import dotenv from "dotenv";
dotenv.config();

import express from "express";
import mysql from "mysql2";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import ExcelJS from "exceljs";
import { createUploader } from "./helpers/upload.js";
import * as FacturasCtrl from "./controllers/facturas.controller.js";

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
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Health check para Railway
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Uploaders multer
const uploadRemision = createUploader({ subdir: "remisiones", allowedExts: [".pdf"] }).single("pdf");
const uploadFactura = createUploader({ subdir: "facturas", allowedExts: [".pdf", ".xml"] })
  .fields([{ name: "pdf", maxCount: 1 }, { name: "xml", maxCount: 1 }]);

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
      miscel_familias,
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

    // Calcular presupuesto de misceláneos desde familias si se proporcionan
    const familiaRows = Array.isArray(miscel_familias) ? miscel_familias : [];
    let presupuestoMiscelaneos;
    if (familiaRows.length > 0) {
      presupuestoMiscelaneos = Number(
        familiaRows.reduce((sum, f) => {
          const n = Number(f.presupuesto);
          return Number.isFinite(n) && n >= 0 ? sum + n : sum;
        }, 0).toFixed(2)
      );
    } else {
      presupuestoMiscelaneos = parseBudget(presupuesto_miscelaneos);
    }

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

    // Crear registros de explosion_insumos para cada familia de misceláneos
    for (const f of familiaRows) {
      const familia = String(f.familia || "").trim().toUpperCase();
      const pres = Number(f.presupuesto);
      if (familia && Number.isFinite(pres) && pres >= 0) {
        try {
          await queryAsync(
            "INSERT INTO explosion_insumos (id_proyecto, clan, familia, presupuesto_asignado) VALUES (?, ?, ?, ?)",
            [result.insertId, "", familia, pres]
          );
        } catch (explErr) {
          console.error(`No se pudo crear explosion_insumos para familia ${familia}:`, explErr);
        }
      }
    }

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
        COALESCE(SUM(CASE WHEN pe.familia LIKE 'CR%' THEN pe.importe_total ELSE 0 END), 0) AS gastado_cristal,
        COALESCE(SUM(CASE WHEN pe.familia = 'MQAL' OR pe.familia LIKE 'AL%' OR pe.familia LIKE '%ALUM%' THEN pe.importe_total ELSE 0 END), 0) AS gastado_aluminio,
        COALESCE(SUM(CASE WHEN pe.familia IS NOT NULL AND pe.familia NOT LIKE 'CR%' AND pe.familia != 'MQAL' AND pe.familia NOT LIKE 'AL%' AND pe.familia NOT LIKE '%ALUM%' THEN pe.importe_total ELSE 0 END), 0) AS gastado_miscelaneos,
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
    const gastadoCristal = Number(proyecto.gastado_cristal || 0);
    const gastadoAluminio = Number(proyecto.gastado_aluminio || 0);
    const gastadoMiscelaneos = Number(proyecto.gastado_miscelaneos || 0);
    const baseProyecto = {
      ...proyecto,
      presupuesto_cristal: presupuestoCristal,
      presupuesto_aluminio: presupuestoAluminio,
      presupuesto_miscelaneos: presupuestoMiscelaneos,
      presupuesto_total: presupuestoTotal,
      presupuesto: Number(proyecto.presupuesto ?? presupuestoTotal ?? 0),
      presupuesto_disponible: presupuestoTotal,
      // Total presupuestado por categoría (restante + gastado) — usado para pre-llenar el modal de ajuste
      presupuesto_cristal_total: Number((presupuestoCristal + gastadoCristal).toFixed(2)),
      presupuesto_aluminio_total: Number((presupuestoAluminio + gastadoAluminio).toFixed(2)),
      presupuesto_miscelaneos_total: Number((presupuestoMiscelaneos + gastadoMiscelaneos).toFixed(2)),
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
    // Los valores del usuario representan el NUEVO TOTAL de presupuesto (no el saldo restante)
    const cristalInput = parseBudgetValue(presupuesto_cristal);
    const aluminioInput = parseBudgetValue(presupuesto_aluminio);
    const miscelaneosInput = parseBudgetValue(presupuesto_miscelaneos);
    if ([cristalInput, aluminioInput, miscelaneosInput].some((v) => v !== null && (!Number.isFinite(v) || v < 0))) {
      return res.status(400).json({ success: false, message: "Presupuestos inválidos" });
    }
    // Obtener lo ya gastado en pedidos para calcular el nuevo saldo restante
    const gastadoRows = await queryAsync(
      "SELECT familia, SUM(importe_total) as gastado FROM pedidos WHERE id_proyecto = ? GROUP BY familia",
      [proyectoId]
    );
    let gastadoCristal = 0, gastadoAluminio = 0, gastadoMiscelaneos = 0;
    for (const row of gastadoRows || []) {
      const tipo = normalizarFamiliaPresupuesto(row.familia);
      const g = Number(row.gastado || 0);
      if (tipo === "cristal") gastadoCristal += g;
      else if (tipo === "aluminio") gastadoAluminio += g;
      else if (tipo === "miscelaneos") gastadoMiscelaneos += g;
    }
    // Nuevo saldo restante = nuevo total ingresado - ya gastado; conservar actual si no se cambió
    const cristal = cristalInput !== null
      ? Number((cristalInput - gastadoCristal).toFixed(2))
      : Number(actuales.presupuesto_cristal || 0);
    const aluminio = aluminioInput !== null
      ? Number((aluminioInput - gastadoAluminio).toFixed(2))
      : Number(actuales.presupuesto_aluminio || 0);
    const miscelaneos = miscelaneosInput !== null
      ? Number((miscelaneosInput - gastadoMiscelaneos).toFixed(2))
      : Number(actuales.presupuesto_miscelaneos || 0);
    const total = Number((cristal + aluminio + miscelaneos).toFixed(2));
    await queryAsync(
      `UPDATE proyectos
         SET presupuesto_cristal = ?, presupuesto_aluminio = ?, presupuesto_miscelaneos = ?,
             presupuesto_total = ?, presupuesto = ?
       WHERE id_proyecto = ?`,
      [cristal, aluminio, miscelaneos, total, total, proyectoId]
    );
    // Historial guarda el total presupuestado (lo que el usuario ingresó), no el saldo restante
    const cristalHist = cristalInput !== null ? cristalInput : Number((actuales.presupuesto_cristal || 0) + gastadoCristal);
    const aluminioHist = aluminioInput !== null ? aluminioInput : Number((actuales.presupuesto_aluminio || 0) + gastadoAluminio);
    const miscelaneosHist = miscelaneosInput !== null ? miscelaneosInput : Number((actuales.presupuesto_miscelaneos || 0) + gastadoMiscelaneos);
    try {
      await registrarHistorialPresupuesto(proyectoId, {
        fecha: fecha_presupuesto,
        presupuesto_cristal: cristalHist,
        presupuesto_aluminio: aluminioHist,
        presupuesto_miscelaneos: miscelaneosHist,
        presupuesto_total: Number((cristalHist + aluminioHist + miscelaneosHist).toFixed(2)),
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
app.get("/proyectos/:id/pedidos", authenticateToken, requireRole("administrador", "visor"), (req, res) => {
  const { id } = req.params;
  const { familia } = req.query;
  let query =
    "SELECT id, id_proyecto, nombre_proyecto, pedido, clan, familia, proveedor, nombre_usuario, DATE_FORMAT(fecha_aprobacion, '%Y-%m-%d') AS fecha_aprobacion, concepto, situaciones_especiales, porcentaje_descuento, importe_total AS importe FROM pedidos WHERE id_proyecto = ?";
  const params = [id];
  const toList = (v) => Array.isArray(v) ? v : (typeof v === 'string' ? v.split(',').map(s => s.trim()).filter(Boolean) : []);
  const addMulti = (field, values) => {
    const list = toList(values);
    if (list.length === 1) { query += ` AND ${field} = ?`; params.push(list[0]); }
    else if (list.length > 1) { query += ` AND ${field} IN (${list.map(_ => '?').join(',')})`; params.push(...list); }
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
  query += " ORDER BY clan ASC, familia ASC, CAST(pedido AS UNSIGNED) ASC";
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
app.get("/pedidos/resumen", authenticateToken, requireRole("administrador", "visor"), async (req, res) => {
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
app.get("/pedidos/:pedidoId/detalles", authenticateToken, requireRole("administrador", "visor"), (req, res) => {
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

app.get("/pedidos/:pedidoId/detalles-cristal", authenticateToken, requireRole("administrador", "visor"), (req, res) => {
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

app.get("/pedidos/:pedidoId/detalles-aluminio", authenticateToken, requireRole("administrador", "visor"), (req, res) => {
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
app.get("/proyectos/:id/pedidos/export", authenticateToken, requireRole("administrador", "visor"), (req, res) => {
  const { id } = req.params;
  const { familia } = req.query;
  const qProyecto = "SELECT nombre FROM proyectos WHERE id_proyecto = ?";
  let qPedidos =
    "SELECT id, nombre_proyecto, pedido, clan, familia, proveedor, DATE_FORMAT(fecha_aprobacion, '%Y-%m-%d') AS fecha_aprobacion, concepto, situaciones_especiales, importe_total AS importe FROM pedidos WHERE id_proyecto = ?";
  const pedidosParams = [id];
  const toListE = (v) => Array.isArray(v) ? v : (typeof v === 'string' ? v.split(',').map(s => s.trim()).filter(Boolean) : []);
  const addMultiE = (field, values) => {
    const list = toListE(values);
    if (list.length === 1) { qPedidos += ` AND ${field} = ?`; pedidosParams.push(list[0]); }
    else if (list.length > 1) { qPedidos += ` AND ${field} IN (${list.map(_ => '?').join(',')})`; pedidosParams.push(...list); }
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
  qPedidos += " ORDER BY clan ASC, familia ASC, CAST(pedido AS UNSIGNED) ASC";

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
app.get("/proyectos/:id/explosion-insumos", authenticateToken, async (req, res) => {
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

// Endpoints de Dashboards

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

// ==================== ENDPOINTS DE DASHBOARDS POR PROYECTO ====================

// Dashboard Ejecutivo por Proyecto
app.get("/api/dashboard/proyecto/:id/ejecutivo", authenticateToken, async (req, res) => {
  const proyectoId = Number(req.params.id);

  if (!proyectoId || isNaN(proyectoId)) {
    return res.status(400).json({ success: false, message: "ID de proyecto inválido" });
  }

  try {
    // Info del proyecto
    const proyectoQuery = `
      SELECT
        p.id_proyecto,
        p.nombre,
        p.estado,
        p.fecha_proyecto,
        COALESCE(p.presupuesto_total, p.presupuesto, 0) as presupuestoTotal,
        COALESCE(p.presupuesto_cristal, 0) as presupuestoCristal,
        COALESCE(p.presupuesto_aluminio, 0) as presupuestoAluminio,
        COALESCE(p.presupuesto_miscelaneos, 0) as presupuestoMiscelaneos,
        COALESCE(pe.total_pedidos, 0) as presupuestoEjecutado
      FROM proyectos p
      LEFT JOIN (
        SELECT id_proyecto, SUM(importe_total) as total_pedidos
        FROM pedidos
        GROUP BY id_proyecto
      ) pe ON p.id_proyecto = pe.id_proyecto
      WHERE p.id_proyecto = ?
    `;
    const proyectoResult = await queryAsync(proyectoQuery, [proyectoId]);

    if (!proyectoResult || proyectoResult.length === 0) {
      return res.status(404).json({ success: false, message: "Proyecto no encontrado" });
    }

    const proyecto = proyectoResult[0];

    // Distribución de presupuesto por categoría
    const distribucionCategoria = [
      { categoria: 'Cristal', monto: parseFloat(proyecto.presupuestoCristal) || 0 },
      { categoria: 'Aluminio', monto: parseFloat(proyecto.presupuestoAluminio) || 0 },
      { categoria: 'Misceláneos', monto: parseFloat(proyecto.presupuestoMiscelaneos) || 0 }
    ].filter(item => item.monto > 0);

    // Gastos por mes del proyecto
    const gastosMensualesQuery = `
      SELECT
        DATE_FORMAT(fecha_aprobacion, '%Y-%m') as mes,
        SUM(importe_total) as gasto
      FROM pedidos
      WHERE id_proyecto = ? AND fecha_aprobacion IS NOT NULL
      GROUP BY DATE_FORMAT(fecha_aprobacion, '%Y-%m')
      ORDER BY mes ASC
      LIMIT 12
    `;
    const gastosMensuales = await queryAsync(gastosMensualesQuery, [proyectoId]);

    // Pedidos por concepto
    const pedidosConceptoQuery = `
      SELECT
        concepto,
        COUNT(*) as cantidad,
        SUM(importe_total) as total
      FROM pedidos
      WHERE id_proyecto = ?
      GROUP BY concepto
      ORDER BY total DESC
      LIMIT 10
    `;
    const pedidosPorConcepto = await queryAsync(pedidosConceptoQuery, [proyectoId]);

    const presupuestoTotal = parseFloat(proyecto.presupuestoTotal) || 0;
    const presupuestoEjecutado = parseFloat(proyecto.presupuestoEjecutado) || 0;
    const presupuestoDisponible = presupuestoTotal - presupuestoEjecutado;

    res.json({
      proyecto: {
        id: proyecto.id_proyecto,
        nombre: proyecto.nombre,
        estado: proyecto.estado === 'en_progreso' ? 'En Progreso' : 'Completado',
        fechaProyecto: proyecto.fecha_proyecto
      },
      kpis: {
        presupuestoTotal,
        presupuestoEjecutado,
        presupuestoDisponible,
        porcentajeEjecutado: presupuestoTotal > 0 ? (presupuestoEjecutado / presupuestoTotal) * 100 : 0
      },
      distribucionCategoria,
      gastosMensuales: gastosMensuales.map(item => ({
        mes: item.mes,
        gasto: parseFloat(item.gasto) || 0
      })),
      pedidosPorConcepto: pedidosPorConcepto.map(item => ({
        concepto: item.concepto,
        cantidad: item.cantidad,
        total: parseFloat(item.total) || 0
      }))
    });
  } catch (err) {
    console.error("Error en dashboard ejecutivo por proyecto:", err);
    res.status(500).json({ success: false, message: "Error al obtener datos del dashboard" });
  }
});

// Dashboard Presupuestos por Proyecto
// NOTA: Endpoints de dashboards movidos al final del archivo (l�neas 4128+)
// Dashboard Materiales por Proyecto
app.get("/api/dashboard/proyecto/:id/materiales", authenticateToken, async (req, res) => {
  const proyectoId = Number(req.params.id);

  if (!proyectoId || isNaN(proyectoId)) {
    return res.status(400).json({ success: false, message: "ID de proyecto inválido" });
  }

  try {
    // Verificar proyecto existe
    const proyectoQuery = `SELECT id_proyecto, nombre FROM proyectos WHERE id_proyecto = ?`;
    const proyectoResult = await queryAsync(proyectoQuery, [proyectoId]);

    if (!proyectoResult || proyectoResult.length === 0) {
      return res.status(404).json({ success: false, message: "Proyecto no encontrado" });
    }

    const proyecto = proyectoResult[0];

    // Materiales usados en misceláneos (tabla puede no existir)
    let materialesUsados = [];
    try {
      const materialesQuery = `
        SELECT
          pdm.descripcion as material,
          SUM(pdm.cantidad) as cantidad,
          SUM(pdm.importe) as costoTotal
        FROM pedidos_detalles_miscelaneos pdm
        INNER JOIN pedidos p ON pdm.id_pedido = p.id_pedido
        WHERE p.id_proyecto = ?
        GROUP BY pdm.descripcion
        ORDER BY costoTotal DESC
        LIMIT 15
      `;
      materialesUsados = await queryAsync(materialesQuery, [proyectoId]);
    } catch (matErr) {
      console.log("Tabla pedidos_detalles_miscelaneos no disponible");
    }

    // Explosión de insumos del proyecto (tabla puede no existir)
    let explosionInsumos = [];
    try {
      const explosionQuery = `
        SELECT
          familia,
          clan,
          presupuesto_asignado
        FROM explosion_insumos
        WHERE id_proyecto = ?
        ORDER BY presupuesto_asignado DESC
      `;
      explosionInsumos = await queryAsync(explosionQuery, [proyectoId]);
    } catch (expErr) {
      console.log("Tabla explosion_insumos no disponible");
    }

    // Costo por tipo de pedido
    const costoTipoQuery = `
      SELECT
        concepto as tipo,
        COUNT(*) as cantidad,
        SUM(importe_total) as costoTotal
      FROM pedidos
      WHERE id_proyecto = ?
      GROUP BY concepto
      ORDER BY costoTotal DESC
    `;
    const costoPorTipo = await queryAsync(costoTipoQuery, [proyectoId]);

    // Proveedores del proyecto
    const proveedoresQuery = `
      SELECT
        proveedor,
        COUNT(*) as cantidadPedidos,
        SUM(importe_total) as totalCompras
      FROM pedidos
      WHERE id_proyecto = ? AND proveedor IS NOT NULL AND proveedor != ''
      GROUP BY proveedor
      ORDER BY totalCompras DESC
      LIMIT 10
    `;
    const proveedores = await queryAsync(proveedoresQuery, [proyectoId]);

    // KPIs
    const kpisQuery = `
      SELECT
        COUNT(DISTINCT concepto) as totalConceptos,
        COALESCE(SUM(importe_total), 0) as totalGastado,
        COUNT(*) as totalPedidos
      FROM pedidos
      WHERE id_proyecto = ?
    `;
    const kpisResult = await queryAsync(kpisQuery, [proyectoId]);
    const kpis = kpisResult[0] || {};

    res.json({
      proyecto: {
        id: proyecto.id_proyecto,
        nombre: proyecto.nombre
      },
      kpis: {
        totalConceptos: kpis.totalConceptos || 0,
        totalGastado: parseFloat(kpis.totalGastado) || 0,
        totalPedidos: kpis.totalPedidos || 0,
        totalProveedores: proveedores.length
      },
      materialesUsados: materialesUsados.map(item => ({
        material: item.material,
        cantidad: parseFloat(item.cantidad) || 0,
        costoTotal: parseFloat(item.costoTotal) || 0
      })),
      explosionInsumos: explosionInsumos.map(item => ({
        familia: item.familia,
        clan: item.clan,
        presupuesto: parseFloat(item.presupuesto_asignado) || 0
      })),
      costoPorTipo: costoPorTipo.map(item => ({
        tipo: item.tipo,
        cantidad: item.cantidad,
        costoTotal: parseFloat(item.costoTotal) || 0
      })),
      proveedores: proveedores.map(item => ({
        proveedor: item.proveedor,
        cantidadPedidos: item.cantidadPedidos,
        totalCompras: parseFloat(item.totalCompras) || 0
      }))
    });
  } catch (err) {
    console.error("Error en dashboard materiales por proyecto:", err);
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
        COALESCE(cp.importe_cobrado, 0) AS importe_cobrado,
        (COALESCE(p.presupuesto_total, p.presupuesto, 0) - COALESCE(cp.importe_cobrado, 0)) AS importe_a_cobrar,
        COALESCE(cp.fondo_garantia, 0) AS fondo_garantia,
        (COALESCE(p.presupuesto_total, p.presupuesto, 0) - COALESCE(cp.importe_cobrado, 0) - COALESCE(cp.fondo_garantia, 0)) AS liquido_por_cobrar,
        COALESCE(facturas.saldo_pendiente, 0) AS facturas_por_cobrar,
        COALESCE(gastos_directos.total_pedidos, 0) AS total_pedidos,
        COALESCE(gastos_viaticos.total_viaticos, 0) AS total_viaticos,
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

      // Cálculos de indirectos (usando factor de la BD)
      const factorIndirectos = parseFloat(row.factor_indirectos) || 0.20;
      const indirectoEsperado = importeContratado * factorIndirectos;
      const indirectoCobrado = importeCobrado * factorIndirectos;
      const indirectoAplicado = parseFloat(row.indirectos_aplicados) || 0;
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
      dataRow.getCell(12).value = factorIndirectos;
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

    // Calcular campos de indirectos y totales
    const totales = {
      importe_contratado: 0,
      importe_cobrado: 0,
      importe_a_cobrar: 0,
      fondo_garantia: 0,
      liquido_por_cobrar: 0,
      facturas_por_cobrar: 0,
      aplicado: 0,
      cobrado_vs_aplicado: 0,
      indirectos_esperado: 0,
      indirectos_cobrado: 0,
      indirectos_aplicados: 0,
      indirectos_cobrado_vs_aplicado: 0
    };

    results.forEach(row => {
      const importeContratado = parseFloat(row.importe_contratado) || 0;
      const importeCobrado = parseFloat(row.importe_cobrado) || 0;
      const factorIndirectos = parseFloat(row.factor_indirectos) || 0.20;
      const indirectosAplicados = parseFloat(row.indirectos_aplicados) || 0;

      // Agregar campos calculados de indirectos
      row.indirectos_esperado = importeContratado * factorIndirectos;
      row.indirectos_cobrado = importeCobrado * factorIndirectos;
      row.indirectos_cobrado_vs_aplicado = row.indirectos_cobrado - indirectosAplicados;

      // Acumular totales
      totales.importe_contratado += importeContratado;
      totales.importe_cobrado += importeCobrado;
      totales.importe_a_cobrar += parseFloat(row.importe_a_cobrar) || 0;
      totales.fondo_garantia += parseFloat(row.fondo_garantia) || 0;
      totales.liquido_por_cobrar += parseFloat(row.liquido_por_cobrar) || 0;
      totales.facturas_por_cobrar += parseFloat(row.facturas_por_cobrar) || 0;
      totales.aplicado += parseFloat(row.aplicado) || 0;
      totales.cobrado_vs_aplicado += parseFloat(row.cobrado_vs_aplicado) || 0;
      totales.indirectos_esperado += row.indirectos_esperado;
      totales.indirectos_cobrado += row.indirectos_cobrado;
      totales.indirectos_aplicados += indirectosAplicados;
      totales.indirectos_cobrado_vs_aplicado += row.indirectos_cobrado_vs_aplicado;
    });

    res.json({
      success: true,
      data: results,
      totales,
      proyectos_en_rojo: results.filter(r => parseFloat(r.cobrado_vs_aplicado) < 0).length,
      proyectos_indirectos_rojo: results.filter(r => r.indirectos_cobrado_vs_aplicado < 0).length
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

    // importe_cobrado se lee directamente del campo manual en cobranza_proyecto
    const query = `
      SELECT
        p.id_proyecto,
        p.nombre AS proyecto,
        COALESCE(cp.codigo_control, '') AS codigo_control,
        COALESCE(p.presupuesto_total, p.presupuesto, 0) AS importe_contratado,
        COALESCE(cp.importe_cobrado, 0) AS importe_cobrado,
        (COALESCE(p.presupuesto_total, p.presupuesto, 0) - COALESCE(cp.importe_cobrado, 0)) AS importe_a_cobrar,
        COALESCE(cp.fondo_garantia, 0) AS fondo_garantia,
        (COALESCE(p.presupuesto_total, p.presupuesto, 0) - COALESCE(cp.importe_cobrado, 0) - COALESCE(cp.fondo_garantia, 0)) AS liquido_por_cobrar,
        COALESCE(facturas.saldo_pendiente, 0) AS facturas_por_cobrar,
        COALESCE(gastos.total_pedidos, 0) AS total_pedidos,
        COALESCE(gastos.total_viaticos, 0) AS total_viaticos,
        (COALESCE(gastos.total_pedidos, 0) + COALESCE(gastos.total_viaticos, 0)) AS aplicado,
        (COALESCE(cp.importe_cobrado, 0) - COALESCE(gastos.total_pedidos, 0) - COALESCE(gastos.total_viaticos, 0)) AS cobrado_vs_aplicado,
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

// Actualizar datos de cobranza de un proyecto
app.put("/proyectos/:id/cobranza-resumen", authenticateToken, requireRole("contador"), async (req, res) => {
  try {
    const proyectoId = Number(req.params.id);
    const { codigo_control, importe_cobrado, fondo_garantia, factor_indirectos, indirectos_aplicados } = req.body || {};
    const username = req.user?.username || "unknown";

    if (!Number.isInteger(proyectoId) || proyectoId <= 0) {
      return res.status(400).json({ success: false, message: "Proyecto inválido" });
    }

    const importeCobradoVal = Number(importe_cobrado);
    const fondoGarantiaVal = Number(fondo_garantia);
    const factorIndirectosVal = Number(factor_indirectos);
    const indirectosAplicadosVal = Number(indirectos_aplicados);

    if (importe_cobrado !== undefined && (!Number.isFinite(importeCobradoVal) || importeCobradoVal < 0)) {
      return res.status(400).json({ success: false, message: "Importe cobrado inválido" });
    }

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
      INSERT INTO cobranza_proyecto (id_proyecto, codigo_control, importe_cobrado, fondo_garantia, factor_indirectos, indirectos_aplicados, nombre_usuario)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        codigo_control = COALESCE(VALUES(codigo_control), codigo_control),
        importe_cobrado = COALESCE(VALUES(importe_cobrado), importe_cobrado),
        fondo_garantia = COALESCE(VALUES(fondo_garantia), fondo_garantia),
        factor_indirectos = COALESCE(VALUES(factor_indirectos), factor_indirectos),
        indirectos_aplicados = COALESCE(VALUES(indirectos_aplicados), indirectos_aplicados),
        nombre_usuario = VALUES(nombre_usuario)
    `;

    await queryAsync(query, [
      proyectoId,
      codigo_control || null,
      importe_cobrado !== undefined ? importeCobradoVal : null,
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

// ============================================================================
// ENDPOINTS PARA DASHBOARDS DE PROYECTOS
// ============================================================================

// Dashboard de Presupuestos por Proyecto
app.get("/api/dashboard/proyecto/:id/presupuestos", authenticateToken, async (req, res) => {
  try {
    const proyectoId = Number(req.params.id);
    if (!Number.isInteger(proyectoId) || proyectoId <= 0) {
      return res.status(400).json({ success: false, message: "Proyecto inválido" });
    }

    // Obtener información del proyecto
    const proyectoRows = await queryAsync(
      `SELECT id_proyecto, nombre, presupuesto_total, presupuesto_cristal, presupuesto_aluminio, presupuesto_miscelaneos
       FROM proyectos WHERE id_proyecto = ?`,
      [proyectoId]
    );

    if (!proyectoRows || proyectoRows.length === 0) {
      return res.status(404).json({ success: false, message: "Proyecto no encontrado" });
    }

    const proyecto = proyectoRows[0];
    const presupuestoTotal = Number(proyecto.presupuesto_total || 0);
    const presupuestoCristal = Number(proyecto.presupuesto_cristal || 0);
    const presupuestoAluminio = Number(proyecto.presupuesto_aluminio || 0);
    const presupuestoMiscelaneos = Number(proyecto.presupuesto_miscelaneos || 0);

    // Obtener total gastado por familia
    const gastadoPorFamilia = await queryAsync(
      `SELECT familia, SUM(importe_total) as total
       FROM pedidos
       WHERE id_proyecto = ?
       GROUP BY familia`,
      [proyectoId]
    );

    let gastadoCristal = 0;
    let gastadoAluminio = 0;
    let gastadoMiscelaneos = 0;

    (gastadoPorFamilia || []).forEach(row => {
      const familia = (row.familia || '').toUpperCase();
      const total = Number(row.total || 0);
      if (familia === 'CRISTAL') gastadoCristal = total;
      else if (familia === 'ALUMINIO') gastadoAluminio = total;
      else gastadoMiscelaneos += total;
    });

    const presupuestoEjecutado = gastadoCristal + gastadoAluminio + gastadoMiscelaneos;
    const presupuestoDisponible = presupuestoTotal - presupuestoEjecutado;
    const eficienciaGasto = presupuestoTotal > 0 ? (presupuestoEjecutado / presupuestoTotal) * 100 : 0;

    // Distribución por categoría
    const distribucionCategoria = [
      {
        categoria: 'Cristal',
        presupuesto: presupuestoCristal,
        gastado: gastadoCristal
      },
      {
        categoria: 'Aluminio',
        presupuesto: presupuestoAluminio,
        gastado: gastadoAluminio
      },
      {
        categoria: 'Misceláneos',
        presupuesto: presupuestoMiscelaneos,
        gastado: gastadoMiscelaneos
      }
    ];

    // Historial de presupuestos
    const historialRows = await queryAsync(
      `SELECT fecha_presupuesto as fecha, presupuesto_total as presupuesto, 'Actualización de presupuesto' as motivo
       FROM proyectos_presupuestos_historial
       WHERE id_proyecto = ?
       ORDER BY fecha_presupuesto DESC
       LIMIT 10`,
      [proyectoId]
    );

    // Pedidos más costosos
    const pedidosCostosos = await queryAsync(
      `SELECT id, concepto, proveedor, importe_total as importe, fecha_aprobacion as fecha
       FROM pedidos
       WHERE id_proyecto = ?
       ORDER BY importe_total DESC
       LIMIT 10`,
      [proyectoId]
    );

    res.json({
      proyecto: {
        id: proyectoId,
        nombre: proyecto.nombre
      },
      kpis: {
        presupuestoTotal,
        presupuestoEjecutado,
        presupuestoDisponible,
        eficienciaGasto
      },
      distribucionCategoria,
      historialPresupuesto: historialRows || [],
      pedidosCostosos: (pedidosCostosos || []).map(p => ({
        id: p.id,
        concepto: p.concepto || '',
        proveedor: p.proveedor || '',
        importe: Number(p.importe || 0),
        fecha: p.fecha || ''
      }))
    });
  } catch (err) {
    console.error("Error en dashboard de presupuestos:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
});

// Dashboard General por Proyecto
app.get("/api/dashboard/proyecto/:id/general", authenticateToken, async (req, res) => {
  try {
    const proyectoId = Number(req.params.id);
    if (!Number.isInteger(proyectoId) || proyectoId <= 0) {
      return res.status(400).json({ success: false, message: "Proyecto inválido" });
    }

    // Obtener información del proyecto
    const proyectoRows = await queryAsync(
      `SELECT id_proyecto, nombre, estado, fecha_proyecto, presupuesto_total
       FROM proyectos WHERE id_proyecto = ?`,
      [proyectoId]
    );

    if (!proyectoRows || proyectoRows.length === 0) {
      return res.status(404).json({ success: false, message: "Proyecto no encontrado" });
    }

    const proyecto = proyectoRows[0];
    const presupuestoTotal = Number(proyecto.presupuesto_total || 0);
    const fechaProyecto = proyecto.fecha_proyecto;

    // Calcular días transcurridos
    const diasTranscurridos = fechaProyecto
      ? Math.floor((new Date() - new Date(fechaProyecto)) / (1000 * 60 * 60 * 24))
      : 0;

    // Obtener total gastado
    const totalGastadoRows = await queryAsync(
      `SELECT SUM(importe_total) as total FROM pedidos WHERE id_proyecto = ?`,
      [proyectoId]
    );
    const totalGastado = Number(totalGastadoRows[0]?.total || 0);
    const presupuestoDisponible = presupuestoTotal - totalGastado;

    // Cantidad de pedidos y proveedores
    const estadisticasRows = await queryAsync(
      `SELECT COUNT(DISTINCT id) as cantidadPedidos, COUNT(DISTINCT proveedor) as cantidadProveedores
       FROM pedidos WHERE id_proyecto = ?`,
      [proyectoId]
    );
    const cantidadPedidos = Number(estadisticasRows[0]?.cantidadPedidos || 0);
    const cantidadProveedores = Number(estadisticasRows[0]?.cantidadProveedores || 0);

    // Proveedores con más compras
    const proveedoresRows = await queryAsync(
      `SELECT proveedor, COUNT(*) as cantidadPedidos, SUM(importe_total) as totalCompras
       FROM pedidos
       WHERE id_proyecto = ?
       GROUP BY proveedor
       ORDER BY totalCompras DESC
       LIMIT 5`,
      [proyectoId]
    );

    // Timeline de pedidos por mes
    const timelineRows = await queryAsync(
      `SELECT 
         DATE_FORMAT(fecha_aprobacion, '%Y-%m') as mes,
         COUNT(*) as cantidadPedidos,
         SUM(importe_total) as totalMes
       FROM pedidos
       WHERE id_proyecto = ?
       GROUP BY DATE_FORMAT(fecha_aprobacion, '%Y-%m')
       ORDER BY mes ASC`,
      [proyectoId]
    );

    // Últimos pedidos
    const ultimosPedidosRows = await queryAsync(
      `SELECT id, concepto, proveedor, importe_total as importe, fecha_aprobacion as fecha, 'pendiente' as estatusPago
       FROM pedidos
       WHERE id_proyecto = ?
       ORDER BY fecha_aprobacion DESC
       LIMIT 10`,
      [proyectoId]
    );

    res.json({
      proyecto: {
        id: proyectoId,
        nombre: proyecto.nombre,
        estado: proyecto.estado === 'completado' ? 'Completado' : 'En Progreso',
        fechaProyecto: fechaProyecto || '',
        diasTranscurridos
      },
      kpis: {
        presupuestoTotal,
        totalGastado,
        presupuestoDisponible,
        cantidadPedidos,
        cantidadProveedores
      },
      proveedores: (proveedoresRows || []).map(p => ({
        proveedor: p.proveedor || '',
        cantidadPedidos: Number(p.cantidadPedidos || 0),
        totalCompras: Number(p.totalCompras || 0)
      })),
      timelinePedidos: (timelineRows || []).map(t => ({
        mes: t.mes || '',
        cantidadPedidos: Number(t.cantidadPedidos || 0),
        totalMes: Number(t.totalMes || 0)
      })),
      ultimosPedidos: (ultimosPedidosRows || []).map(p => ({
        id: p.id,
        concepto: p.concepto || '',
        proveedor: p.proveedor || '',
        importe: Number(p.importe || 0),
        fecha: p.fecha || '',
        estatusPago: p.estatusPago || 'pendiente'
      }))
    });
  } catch (err) {
    console.error("Error en dashboard general:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
});

// =============================================
// REPORTES DE EXISTENCIA Y REMISIONES
// =============================================

// Reporte Cristal - datos agregados de detalles cristal por proyecto
app.get("/proyectos/:id/reportes/cristal", authenticateToken, async (req, res) => {
  try {
    const proyectoId = Number(req.params.id);
    if (!Number.isInteger(proyectoId) || proyectoId <= 0) {
      return res.status(400).json({ success: false, message: "Proyecto inválido" });
    }

    // Obtener filtros disponibles
    const filtrosRows = await queryAsync(
      `SELECT DISTINCT p.proveedor, p.clan, p.concepto, p.pedido
       FROM pedidos p
       INNER JOIN pedidos_detalles_cristal dc ON dc.id_pedido = p.id
       WHERE p.id_proyecto = ?`,
      [proyectoId]
    );
    const filtros_disponibles = {
      proveedores: [...new Set((filtrosRows || []).map(r => r.proveedor).filter(Boolean))].sort(),
      clanes: [...new Set((filtrosRows || []).map(r => r.clan).filter(Boolean))].sort(),
      conceptos: [...new Set((filtrosRows || []).map(r => r.concepto).filter(Boolean))].sort(),
      pedidos: [...new Set((filtrosRows || []).map(r => r.pedido).filter(Boolean))].sort((a, b) => {
        const na = parseInt(a) || 0;
        const nb = parseInt(b) || 0;
        return na - nb;
      }),
    };

    let query = `
      SELECT dc.id_detalle, p.id AS id_pedido, p.pedido, p.proveedor, p.clan, p.concepto,
             DATE_FORMAT(p.fecha_aprobacion, '%Y-%m-%d') AS fecha_aprobacion,
             dc.descripcion, dc.clave_modelo, dc.ancho, dc.largo, dc.m2_corte,
             dc.piezas, dc.m2_pedido, dc.precio_unitario, dc.importe
      FROM pedidos p
      INNER JOIN pedidos_detalles_cristal dc ON dc.id_pedido = p.id
      WHERE p.id_proyecto = ?
    `;
    const params = [proyectoId];

    const toList = (v) => Array.isArray(v) ? v : (typeof v === 'string' ? v.split(',').map(s => s.trim()).filter(Boolean) : []);
    const addMulti = (field, values) => {
      const list = toList(values);
      if (list.length === 1) { query += ` AND ${field} = ?`; params.push(list[0]); }
      else if (list.length > 1) { query += ` AND ${field} IN (${list.map(() => '?').join(',')})`; params.push(...list); }
    };

    const { proveedor, clan, concepto, pedido, fecha_desde, fecha_hasta, clave_modelo } = req.query;
    addMulti('p.proveedor', proveedor);
    addMulti('p.clan', clan);
    addMulti('p.pedido', pedido);
    if (concepto && String(concepto).trim()) {
      query += " AND p.concepto = ?";
      params.push(String(concepto));
    }
    if (fecha_desde && String(fecha_desde).trim()) {
      query += " AND p.fecha_aprobacion >= ?";
      params.push(String(fecha_desde));
    }
    if (fecha_hasta && String(fecha_hasta).trim()) {
      query += " AND p.fecha_aprobacion <= ?";
      params.push(String(fecha_hasta));
    }
    if (clave_modelo && String(clave_modelo).trim()) {
      query += " AND dc.clave_modelo LIKE ?";
      params.push(`%${String(clave_modelo).trim()}%`);
    }

    query += " ORDER BY CAST(p.pedido AS UNSIGNED) ASC, dc.id_detalle ASC";

    const rows = await queryAsync(query, params);
    const data = (rows || []).map(r => ({
      id_detalle: r.id_detalle,
      id_pedido: r.id_pedido,
      pedido: r.pedido,
      proveedor: r.proveedor,
      clan: r.clan,
      concepto: r.concepto,
      fecha_aprobacion: r.fecha_aprobacion,
      descripcion: r.descripcion,
      clave_modelo: r.clave_modelo || null,
      ancho: r.ancho != null ? Number(r.ancho) : null,
      largo: r.largo != null ? Number(r.largo) : null,
      m2_corte: r.m2_corte != null ? Number(r.m2_corte) : null,
      piezas: Number(r.piezas || 0),
      m2_pedido: r.m2_pedido != null ? Number(r.m2_pedido) : null,
      precio_unitario: Number(r.precio_unitario || 0),
      importe: Number(r.importe || 0),
    }));

    const totals = {
      total_piezas: data.reduce((sum, r) => sum + r.piezas, 0),
      total_m2_pedido: Number(data.reduce((sum, r) => sum + Number(r.m2_pedido || 0), 0).toFixed(3)),
      total_importe: Number(data.reduce((sum, r) => sum + r.importe, 0).toFixed(2)),
    };

    res.json({ success: true, data, totals, filtros_disponibles });
  } catch (err) {
    console.error("Error en reporte cristal:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
});

// Reporte Aluminio - datos agregados de detalles aluminio por proyecto
app.get("/proyectos/:id/reportes/aluminio", authenticateToken, async (req, res) => {
  try {
    const proyectoId = Number(req.params.id);
    if (!Number.isInteger(proyectoId) || proyectoId <= 0) {
      return res.status(400).json({ success: false, message: "Proyecto inválido" });
    }

    // Obtener filtros disponibles (incluye acabados)
    const filtrosRows = await queryAsync(
      `SELECT DISTINCT p.proveedor, p.clan, p.concepto, p.pedido, da.acabado
       FROM pedidos p
       INNER JOIN pedidos_detalles_aluminio da ON da.id_pedido = p.id
       WHERE p.id_proyecto = ?`,
      [proyectoId]
    );
    const filtros_disponibles = {
      proveedores: [...new Set((filtrosRows || []).map(r => r.proveedor).filter(Boolean))].sort(),
      clanes: [...new Set((filtrosRows || []).map(r => r.clan).filter(Boolean))].sort(),
      conceptos: [...new Set((filtrosRows || []).map(r => r.concepto).filter(Boolean))].sort(),
      pedidos: [...new Set((filtrosRows || []).map(r => r.pedido).filter(Boolean))].sort((a, b) => {
        const na = parseInt(a) || 0;
        const nb = parseInt(b) || 0;
        return na - nb;
      }),
      acabados: [...new Set((filtrosRows || []).map(r => r.acabado).filter(Boolean))].sort(),
    };

    let query = `
      SELECT da.id_detalle, p.id AS id_pedido, p.pedido, p.proveedor, p.clan, p.concepto,
             DATE_FORMAT(p.fecha_aprobacion, '%Y-%m-%d') AS fecha_aprobacion,
             da.descripcion, da.numero_perfil, da.medida_tramo, da.unidad,
             da.peso_kg_ml, da.perimetro_m2_ml, da.acabado, da.total_tramos,
             da.ml, da.kg, da.m2, da.importe
      FROM pedidos p
      INNER JOIN pedidos_detalles_aluminio da ON da.id_pedido = p.id
      WHERE p.id_proyecto = ?
    `;
    const params = [proyectoId];

    const toList = (v) => Array.isArray(v) ? v : (typeof v === 'string' ? v.split(',').map(s => s.trim()).filter(Boolean) : []);
    const addMulti = (field, values) => {
      const list = toList(values);
      if (list.length === 1) { query += ` AND ${field} = ?`; params.push(list[0]); }
      else if (list.length > 1) { query += ` AND ${field} IN (${list.map(() => '?').join(',')})`; params.push(...list); }
    };

    const { proveedor, clan, concepto, pedido, fecha_desde, fecha_hasta, acabado } = req.query;
    addMulti('p.proveedor', proveedor);
    addMulti('p.clan', clan);
    addMulti('p.pedido', pedido);
    addMulti('da.acabado', acabado);
    if (concepto && String(concepto).trim()) {
      query += " AND p.concepto = ?";
      params.push(String(concepto));
    }
    if (fecha_desde && String(fecha_desde).trim()) {
      query += " AND p.fecha_aprobacion >= ?";
      params.push(String(fecha_desde));
    }
    if (fecha_hasta && String(fecha_hasta).trim()) {
      query += " AND p.fecha_aprobacion <= ?";
      params.push(String(fecha_hasta));
    }

    query += " ORDER BY CAST(p.pedido AS UNSIGNED) ASC, da.id_detalle ASC";

    const rows = await queryAsync(query, params);
    const data = (rows || []).map(r => ({
      id_detalle: r.id_detalle,
      id_pedido: r.id_pedido,
      pedido: r.pedido,
      proveedor: r.proveedor,
      clan: r.clan,
      concepto: r.concepto,
      fecha_aprobacion: r.fecha_aprobacion,
      descripcion: r.descripcion,
      numero_perfil: r.numero_perfil || null,
      medida_tramo: r.medida_tramo != null ? Number(r.medida_tramo) : null,
      unidad: r.unidad || null,
      peso_kg_ml: r.peso_kg_ml != null ? Number(r.peso_kg_ml) : null,
      perimetro_m2_ml: r.perimetro_m2_ml != null ? Number(r.perimetro_m2_ml) : null,
      acabado: r.acabado || null,
      total_tramos: r.total_tramos != null ? Number(r.total_tramos) : null,
      ml: r.ml != null ? Number(r.ml) : null,
      kg: r.kg != null ? Number(r.kg) : null,
      m2: r.m2 != null ? Number(r.m2) : null,
      importe: Number(r.importe || 0),
    }));

    const totals = {
      total_tramos: data.reduce((sum, r) => sum + Number(r.total_tramos || 0), 0),
      total_ml: Number(data.reduce((sum, r) => sum + Number(r.ml || 0), 0).toFixed(3)),
      total_kg: Number(data.reduce((sum, r) => sum + Number(r.kg || 0), 0).toFixed(3)),
      total_m2: Number(data.reduce((sum, r) => sum + Number(r.m2 || 0), 0).toFixed(3)),
      total_importe: Number(data.reduce((sum, r) => sum + r.importe, 0).toFixed(2)),
    };

    res.json({ success: true, data, totals, filtros_disponibles });
  } catch (err) {
    console.error("Error en reporte aluminio:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
});

// Exportar Reporte Cristal a Excel
app.get("/proyectos/:id/reportes/cristal/export", authenticateToken, async (req, res) => {
  try {
    const proyectoId = Number(req.params.id);
    if (!Number.isInteger(proyectoId) || proyectoId <= 0) {
      return res.status(400).json({ success: false, message: "Proyecto inválido" });
    }

    // Obtener nombre del proyecto
    const proyectoRows = await queryAsync("SELECT nombre FROM proyectos WHERE id_proyecto = ?", [proyectoId]);
    const nombreProyecto = (proyectoRows && proyectoRows[0] && proyectoRows[0].nombre) || `Proyecto ${proyectoId}`;

    // Construir query con filtros
    let query = `
      SELECT dc.id_detalle, p.pedido, p.proveedor, p.clan, p.concepto,
             DATE_FORMAT(p.fecha_aprobacion, '%Y-%m-%d') AS fecha_aprobacion,
             dc.descripcion, dc.clave_modelo, dc.ancho, dc.largo, dc.m2_corte,
             dc.piezas, dc.m2_pedido, dc.precio_unitario, dc.importe
      FROM pedidos p
      INNER JOIN pedidos_detalles_cristal dc ON dc.id_pedido = p.id
      WHERE p.id_proyecto = ?
    `;
    const params = [proyectoId];
    const toList = (v) => Array.isArray(v) ? v : (typeof v === 'string' ? v.split(',').map(s => s.trim()).filter(Boolean) : []);
    const addMulti = (field, values) => {
      const list = toList(values);
      if (list.length === 1) { query += ` AND ${field} = ?`; params.push(list[0]); }
      else if (list.length > 1) { query += ` AND ${field} IN (${list.map(() => '?').join(',')})`; params.push(...list); }
    };

    const { proveedor, clan, concepto, pedido, fecha_desde, fecha_hasta, clave_modelo } = req.query;
    addMulti('p.proveedor', proveedor);
    addMulti('p.clan', clan);
    addMulti('p.pedido', pedido);
    if (concepto && String(concepto).trim()) { query += " AND p.concepto = ?"; params.push(String(concepto)); }
    if (fecha_desde && String(fecha_desde).trim()) { query += " AND p.fecha_aprobacion >= ?"; params.push(String(fecha_desde)); }
    if (fecha_hasta && String(fecha_hasta).trim()) { query += " AND p.fecha_aprobacion <= ?"; params.push(String(fecha_hasta)); }
    if (clave_modelo && String(clave_modelo).trim()) { query += " AND dc.clave_modelo LIKE ?"; params.push(`%${String(clave_modelo).trim()}%`); }

    query += " ORDER BY CAST(p.pedido AS UNSIGNED) ASC, dc.id_detalle ASC";
    const rows = await queryAsync(query, params);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Reporte Cristal");

    try {
      const logoPath = path.join(__dirname, "assets", "heg_logo.jpg");
      const imgId = wb.addImage({ filename: logoPath, extension: "jpeg" });
      ws.addImage(imgId, { tl: { col: 0, row: 0 }, ext: { width: 220, height: 80 } });
    } catch (imgErr) {
      console.warn("No se pudo cargar el logo:", imgErr?.message || imgErr);
    }

    const now = new Date();
    const fechaGen = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
    const titleRow = ws.getRow(5);
    titleRow.getCell(1).value = `Reporte Cristal - ${nombreProyecto} - ${fechaGen}`;
    titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: "FF333333" } };
    ws.mergeCells(5, 1, 5, 15);

    const headerRowIndex = 7;
    ws.columns = [
      { key: "no", width: 6 },
      { key: "pedido", width: 10 },
      { key: "proveedor", width: 20 },
      { key: "clan", width: 10 },
      { key: "concepto", width: 18 },
      { key: "fecha", width: 14 },
      { key: "clave_modelo", width: 16 },
      { key: "descripcion", width: 30 },
      { key: "ancho", width: 10 },
      { key: "largo", width: 10 },
      { key: "m2_corte", width: 12 },
      { key: "piezas", width: 10 },
      { key: "m2_pedido", width: 12 },
      { key: "precio_unitario", width: 14 },
      { key: "importe", width: 14 },
    ];
    const headerRow = ws.getRow(headerRowIndex);
    const headers = ["NO.", "PEDIDO", "PROVEEDOR", "CLAN", "CONCEPTO", "FECHA", "CLAVE/MODELO", "DESCRIPCION", "ANCHO", "LARGO", "M2 CORTE", "PIEZAS", "M2 PEDIDO", "P. UNITARIO", "IMPORTE"];
    headers.forEach((text, idx) => { headerRow.getCell(idx + 1).value = text; });
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };
    headerRow.height = 20;
    headerRow.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF224C84" } };
      cell.border = {
        top: { style: "thin", color: { argb: "FFDDDDDD" } },
        left: { style: "thin", color: { argb: "FFDDDDDD" } },
        bottom: { style: "thin", color: { argb: "FFDDDDDD" } },
        right: { style: "thin", color: { argb: "FFDDDDDD" } },
      };
    });

    const startDataRow = headerRowIndex + 1;
    let totalPiezas = 0, totalM2Pedido = 0, totalImporte = 0;
    (rows || []).forEach((p, i) => {
      const r = ws.getRow(startDataRow + i);
      r.getCell(1).value = i + 1;
      r.getCell(2).value = p.pedido;
      r.getCell(3).value = p.proveedor;
      r.getCell(4).value = p.clan;
      r.getCell(5).value = p.concepto;
      r.getCell(6).value = p.fecha_aprobacion;
      r.getCell(7).value = p.clave_modelo || "";
      r.getCell(8).value = p.descripcion || "";
      const ancho = p.ancho != null ? Number(p.ancho) : null;
      const largo = p.largo != null ? Number(p.largo) : null;
      const m2Corte = p.m2_corte != null ? Number(p.m2_corte) : null;
      const piezas = Number(p.piezas || 0);
      const m2Pedido = p.m2_pedido != null ? Number(p.m2_pedido) : null;
      const pu = Number(p.precio_unitario || 0);
      const imp = Number(p.importe || 0);
      r.getCell(9).value = ancho; if (ancho != null) r.getCell(9).numFmt = "0.000";
      r.getCell(10).value = largo; if (largo != null) r.getCell(10).numFmt = "0.000";
      r.getCell(11).value = m2Corte; if (m2Corte != null) r.getCell(11).numFmt = "0.000";
      r.getCell(12).value = piezas;
      r.getCell(13).value = m2Pedido; if (m2Pedido != null) r.getCell(13).numFmt = "0.000";
      r.getCell(14).value = pu; r.getCell(14).numFmt = "#,##0.00";
      r.getCell(15).value = imp; r.getCell(15).numFmt = "#,##0.00";
      totalPiezas += piezas;
      totalM2Pedido += Number(m2Pedido || 0);
      totalImporte += imp;
    });

    const totalRowIdx = startDataRow + (rows || []).length;
    const tRow = ws.getRow(totalRowIdx);
    tRow.getCell(11).value = "TOTALES";
    tRow.getCell(11).font = { bold: true };
    tRow.getCell(11).alignment = { horizontal: "right" };
    tRow.getCell(12).value = totalPiezas;
    tRow.getCell(12).font = { bold: true };
    tRow.getCell(13).value = Number(totalM2Pedido.toFixed(3));
    tRow.getCell(13).numFmt = "0.000";
    tRow.getCell(13).font = { bold: true };
    tRow.getCell(15).value = Number(totalImporte.toFixed(2));
    tRow.getCell(15).numFmt = "#,##0.00";
    tRow.getCell(15).font = { bold: true };
    tRow.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFDDDDDD" } },
        left: { style: "thin", color: { argb: "FFDDDDDD" } },
        bottom: { style: "thin", color: { argb: "FFDDDDDD" } },
        right: { style: "thin", color: { argb: "FFDDDDDD" } },
      };
    });

    ws.views = [{ state: "frozen", ySplit: headerRowIndex }];

    const filename = `reporte_cristal_${proyectoId}_${fechaGen}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Error generando XLSX reporte cristal:", err);
    res.status(500).json({ success: false, message: "Error generando archivo" });
  }
});

// Exportar Reporte Aluminio a Excel
app.get("/proyectos/:id/reportes/aluminio/export", authenticateToken, async (req, res) => {
  try {
    const proyectoId = Number(req.params.id);
    if (!Number.isInteger(proyectoId) || proyectoId <= 0) {
      return res.status(400).json({ success: false, message: "Proyecto inválido" });
    }

    const proyectoRows = await queryAsync("SELECT nombre FROM proyectos WHERE id_proyecto = ?", [proyectoId]);
    const nombreProyecto = (proyectoRows && proyectoRows[0] && proyectoRows[0].nombre) || `Proyecto ${proyectoId}`;

    let query = `
      SELECT da.id_detalle, p.pedido, p.proveedor, p.clan, p.concepto,
             DATE_FORMAT(p.fecha_aprobacion, '%Y-%m-%d') AS fecha_aprobacion,
             da.descripcion, da.numero_perfil, da.medida_tramo, da.unidad,
             da.peso_kg_ml, da.perimetro_m2_ml, da.acabado, da.total_tramos,
             da.ml, da.kg, da.m2, da.importe
      FROM pedidos p
      INNER JOIN pedidos_detalles_aluminio da ON da.id_pedido = p.id
      WHERE p.id_proyecto = ?
    `;
    const params = [proyectoId];
    const toList = (v) => Array.isArray(v) ? v : (typeof v === 'string' ? v.split(',').map(s => s.trim()).filter(Boolean) : []);
    const addMulti = (field, values) => {
      const list = toList(values);
      if (list.length === 1) { query += ` AND ${field} = ?`; params.push(list[0]); }
      else if (list.length > 1) { query += ` AND ${field} IN (${list.map(() => '?').join(',')})`; params.push(...list); }
    };

    const { proveedor, clan, concepto, pedido, fecha_desde, fecha_hasta, acabado } = req.query;
    addMulti('p.proveedor', proveedor);
    addMulti('p.clan', clan);
    addMulti('p.pedido', pedido);
    addMulti('da.acabado', acabado);
    if (concepto && String(concepto).trim()) { query += " AND p.concepto = ?"; params.push(String(concepto)); }
    if (fecha_desde && String(fecha_desde).trim()) { query += " AND p.fecha_aprobacion >= ?"; params.push(String(fecha_desde)); }
    if (fecha_hasta && String(fecha_hasta).trim()) { query += " AND p.fecha_aprobacion <= ?"; params.push(String(fecha_hasta)); }

    query += " ORDER BY CAST(p.pedido AS UNSIGNED) ASC, da.id_detalle ASC";
    const rows = await queryAsync(query, params);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Reporte Aluminio");

    try {
      const logoPath = path.join(__dirname, "assets", "heg_logo.jpg");
      const imgId = wb.addImage({ filename: logoPath, extension: "jpeg" });
      ws.addImage(imgId, { tl: { col: 0, row: 0 }, ext: { width: 220, height: 80 } });
    } catch (imgErr) {
      console.warn("No se pudo cargar el logo:", imgErr?.message || imgErr);
    }

    const now = new Date();
    const fechaGen = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
    const titleRow = ws.getRow(5);
    titleRow.getCell(1).value = `Reporte Aluminio - ${nombreProyecto} - ${fechaGen}`;
    titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: "FF333333" } };
    ws.mergeCells(5, 1, 5, 18);

    const headerRowIndex = 7;
    ws.columns = [
      { key: "no", width: 6 },
      { key: "pedido", width: 10 },
      { key: "proveedor", width: 20 },
      { key: "clan", width: 10 },
      { key: "concepto", width: 18 },
      { key: "fecha", width: 14 },
      { key: "descripcion", width: 30 },
      { key: "numero_perfil", width: 12 },
      { key: "medida_tramo", width: 14 },
      { key: "unidad", width: 10 },
      { key: "peso_kg_ml", width: 12 },
      { key: "perimetro_m2_ml", width: 14 },
      { key: "acabado", width: 16 },
      { key: "total_tramos", width: 14 },
      { key: "ml", width: 10 },
      { key: "kg", width: 10 },
      { key: "m2", width: 10 },
      { key: "importe", width: 14 },
    ];
    const headerRow = ws.getRow(headerRowIndex);
    const headers = ["NO.", "PEDIDO", "PROVEEDOR", "CLAN", "CONCEPTO", "FECHA", "DESCRIPCION", "N° PERFIL", "MEDIDA(TRAMO)", "UNIDAD", "PESO(KG/ML)", "PERÍM(M2/ML)", "ACABADO", "TOTAL TRAMOS", "ML", "KG", "M2", "IMPORTE"];
    headers.forEach((text, idx) => { headerRow.getCell(idx + 1).value = text; });
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };
    headerRow.height = 20;
    headerRow.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF224C84" } };
      cell.border = {
        top: { style: "thin", color: { argb: "FFDDDDDD" } },
        left: { style: "thin", color: { argb: "FFDDDDDD" } },
        bottom: { style: "thin", color: { argb: "FFDDDDDD" } },
        right: { style: "thin", color: { argb: "FFDDDDDD" } },
      };
    });

    const startDataRow = headerRowIndex + 1;
    let totalTramos = 0, totalMl = 0, totalKg = 0, totalM2 = 0, totalImporte = 0;
    (rows || []).forEach((p, i) => {
      const r = ws.getRow(startDataRow + i);
      r.getCell(1).value = i + 1;
      r.getCell(2).value = p.pedido;
      r.getCell(3).value = p.proveedor;
      r.getCell(4).value = p.clan;
      r.getCell(5).value = p.concepto;
      r.getCell(6).value = p.fecha_aprobacion;
      r.getCell(7).value = p.descripcion || "";
      r.getCell(8).value = p.numero_perfil || "";
      const medTramo = p.medida_tramo != null ? Number(p.medida_tramo) : null;
      r.getCell(9).value = medTramo; if (medTramo != null) r.getCell(9).numFmt = "0.000";
      r.getCell(10).value = p.unidad || "";
      const pesoKg = p.peso_kg_ml != null ? Number(p.peso_kg_ml) : null;
      r.getCell(11).value = pesoKg; if (pesoKg != null) r.getCell(11).numFmt = "0.000";
      const perim = p.perimetro_m2_ml != null ? Number(p.perimetro_m2_ml) : null;
      r.getCell(12).value = perim; if (perim != null) r.getCell(12).numFmt = "0.000";
      r.getCell(13).value = p.acabado || "";
      const tramos = p.total_tramos != null ? Number(p.total_tramos) : null;
      r.getCell(14).value = tramos;
      const ml = p.ml != null ? Number(p.ml) : null;
      r.getCell(15).value = ml; if (ml != null) r.getCell(15).numFmt = "0.000";
      const kg = p.kg != null ? Number(p.kg) : null;
      r.getCell(16).value = kg; if (kg != null) r.getCell(16).numFmt = "0.000";
      const m2 = p.m2 != null ? Number(p.m2) : null;
      r.getCell(17).value = m2; if (m2 != null) r.getCell(17).numFmt = "0.000";
      const imp = Number(p.importe || 0);
      r.getCell(18).value = imp; r.getCell(18).numFmt = "#,##0.00";
      totalTramos += Number(tramos || 0);
      totalMl += Number(ml || 0);
      totalKg += Number(kg || 0);
      totalM2 += Number(m2 || 0);
      totalImporte += imp;
    });

    const totalRowIdx = startDataRow + (rows || []).length;
    const tRow = ws.getRow(totalRowIdx);
    tRow.getCell(13).value = "TOTALES";
    tRow.getCell(13).font = { bold: true };
    tRow.getCell(13).alignment = { horizontal: "right" };
    tRow.getCell(14).value = totalTramos; tRow.getCell(14).font = { bold: true };
    tRow.getCell(15).value = Number(totalMl.toFixed(3)); tRow.getCell(15).numFmt = "0.000"; tRow.getCell(15).font = { bold: true };
    tRow.getCell(16).value = Number(totalKg.toFixed(3)); tRow.getCell(16).numFmt = "0.000"; tRow.getCell(16).font = { bold: true };
    tRow.getCell(17).value = Number(totalM2.toFixed(3)); tRow.getCell(17).numFmt = "0.000"; tRow.getCell(17).font = { bold: true };
    tRow.getCell(18).value = Number(totalImporte.toFixed(2)); tRow.getCell(18).numFmt = "#,##0.00"; tRow.getCell(18).font = { bold: true };
    tRow.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFDDDDDD" } },
        left: { style: "thin", color: { argb: "FFDDDDDD" } },
        bottom: { style: "thin", color: { argb: "FFDDDDDD" } },
        right: { style: "thin", color: { argb: "FFDDDDDD" } },
      };
    });

    ws.views = [{ state: "frozen", ySplit: headerRowIndex }];

    const filename = `reporte_aluminio_${proyectoId}_${fechaGen}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Error generando XLSX reporte aluminio:", err);
    res.status(500).json({ success: false, message: "Error generando archivo" });
  }
});

// ============================================================
// MÓDULO DE REMISIONES Y EXISTENCIAS
// Lee de pedidos_detalles_aluminio y pedidos_detalles_cristal
// ============================================================

// Listar control de entregas por proyecto (Aluminio + Cristal)
app.get("/proyectos/:id/remisiones", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { prioridad, proveedor, search, tipo } = req.query;

    // Query para ALUMINIO - LEFT JOIN con remisiones_control
    let queryAluminio = `
      SELECT
        da.id_detalle as id_programacion,
        ped.id_proyecto,
        pr.nombre AS nombre_proyecto,
        ped.pedido as numero_pedido,
        '-' as subpedido,
        da.numero_perfil,
        da.descripcion,
        da.medida_tramo,
        da.peso_kg_ml,
        da.acabado,
        COALESCE(rc.cantidad_pedida, da.total_tramos, 0) as cantidad_pedida,
        COALESCE(rc.cantidad_recibida, 0) as cantidad_recibida,
        COALESCE(rc.cantidad_pedida, da.total_tramos, 0) - COALESCE(rc.cantidad_recibida, 0) as cantidad_saldo,
        COALESCE(rc.cantidad_extruido, 0) as cantidad_extruido,
        COALESCE(rc.cantidad_pintado, 0) as cantidad_pintado,
        COALESCE(da.kg, 0) as total_kg,
        (COALESCE(rc.cantidad_pedida, da.total_tramos, 0) - COALESCE(rc.cantidad_recibida, 0)) * COALESCE(da.medida_tramo, 0) * COALESCE(da.peso_kg_ml, 0) as kg_saldo,
        0 as kg_por_pintar,
        0 as kg_entrega,
        CASE WHEN COALESCE(rc.cantidad_pedida, da.total_tramos, 0) > 0
          THEN COALESCE(rc.cantidad_recibida, 0) / COALESCE(rc.cantidad_pedida, da.total_tramos, 1)
          ELSE 0 END as porcentaje_avance,
        ped.proveedor,
        COALESCE(rc.fecha_liberacion, ped.fecha_aprobacion) as fecha_liberacion,
        rc.fecha_entrega,
        NULL as fecha_entrega_desfazada,
        NULL as fecha_ultima_recepcion,
        COALESCE(rc.prioridad, 'C') as prioridad,
        rc.observaciones_proveedor,
        rc.observaciones_heg,
        'aluminio' as tipo_material
      FROM pedidos_detalles_aluminio da
      JOIN pedidos ped ON ped.id = da.id_pedido
      JOIN proyectos pr ON pr.id_proyecto = ped.id_proyecto
      LEFT JOIN remisiones_control rc ON rc.id_detalle = da.id_detalle AND rc.tipo_material = 'aluminio'
      WHERE ped.id_proyecto = ?
        AND LOWER(da.descripcion) NOT LIKE '%traspaso%'
    `;

    // Query para CRISTAL - LEFT JOIN con remisiones_control
    let queryCristal = `
      SELECT
        dc.id_detalle as id_programacion,
        ped.id_proyecto,
        pr.nombre AS nombre_proyecto,
        ped.pedido as numero_pedido,
        '-' as subpedido,
        dc.clave_modelo as numero_perfil,
        dc.descripcion,
        NULL as medida_tramo,
        NULL as peso_kg_ml,
        NULL as acabado,
        COALESCE(rc.cantidad_pedida, dc.piezas, 0) as cantidad_pedida,
        COALESCE(rc.cantidad_recibida, 0) as cantidad_recibida,
        COALESCE(rc.cantidad_pedida, dc.piezas, 0) - COALESCE(rc.cantidad_recibida, 0) as cantidad_saldo,
        0 as cantidad_extruido,
        0 as cantidad_pintado,
        COALESCE(dc.m2_pedido, 0) as total_kg,
        (COALESCE(rc.cantidad_pedida, dc.piezas, 0) - COALESCE(rc.cantidad_recibida, 0)) as kg_saldo,
        0 as kg_por_pintar,
        0 as kg_entrega,
        CASE WHEN COALESCE(rc.cantidad_pedida, dc.piezas, 0) > 0
          THEN COALESCE(rc.cantidad_recibida, 0) / COALESCE(rc.cantidad_pedida, dc.piezas, 1)
          ELSE 0 END as porcentaje_avance,
        ped.proveedor,
        COALESCE(rc.fecha_liberacion, ped.fecha_aprobacion) as fecha_liberacion,
        rc.fecha_entrega,
        rc.fecha_entrega_desfazada,
        NULL as fecha_ultima_recepcion,
        COALESCE(rc.prioridad, 'C') as prioridad,
        rc.observaciones_proveedor,
        rc.observaciones_heg,
        'cristal' as tipo_material
      FROM pedidos_detalles_cristal dc
      JOIN pedidos ped ON ped.id = dc.id_pedido
      JOIN proyectos pr ON pr.id_proyecto = ped.id_proyecto
      LEFT JOIN remisiones_control rc ON rc.id_detalle = dc.id_detalle AND rc.tipo_material = 'cristal'
      WHERE ped.id_proyecto = ?
        AND LOWER(dc.descripcion) NOT LIKE '%traspaso%'
    `;

    const params = [id];
    let rows = [];

    if (!tipo || tipo === 'aluminio' || tipo === 'todos') {
      let qAlu = queryAluminio;
      const pAlu = [...params];

      if (prioridad && prioridad !== 'TODAS') {
        qAlu += ` AND COALESCE(rc.prioridad, 'C') = ?`;
        pAlu.push(prioridad);
      }
      if (proveedor) {
        qAlu += ` AND ped.proveedor LIKE ?`;
        pAlu.push(`%${proveedor}%`);
      }
      if (search) {
        qAlu += ` AND (da.numero_perfil LIKE ? OR da.descripcion LIKE ? OR ped.pedido LIKE ?)`;
        pAlu.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      const rowsAluminio = await queryAsync(qAlu, pAlu);
      rows = rows.concat(rowsAluminio);
    }

    if (!tipo || tipo === 'cristal' || tipo === 'todos') {
      let qCri = queryCristal;
      const pCri = [...params];

      if (prioridad && prioridad !== 'TODAS') {
        qCri += ` AND COALESCE(rc.prioridad, 'C') = ?`;
        pCri.push(prioridad);
      }
      if (proveedor) {
        qCri += ` AND ped.proveedor LIKE ?`;
        pCri.push(`%${proveedor}%`);
      }
      if (search) {
        qCri += ` AND (dc.clave_modelo LIKE ? OR dc.descripcion LIKE ? OR ped.pedido LIKE ?)`;
        pCri.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      const rowsCristal = await queryAsync(qCri, pCri);
      rows = rows.concat(rowsCristal);
    }

    if (!tipo || tipo === 'miscelaneo' || tipo === 'todos') {
      let qMisc = `
        SELECT
          dm.id_detalle as id_programacion,
          ped.id_proyecto,
          pr.nombre AS nombre_proyecto,
          ped.pedido as numero_pedido,
          '-' as subpedido,
          COALESCE(dm.clave, '') as numero_perfil,
          dm.descripcion,
          dm.ml as medida_tramo,
          dm.precio_x_kg as peso_kg_ml,
          dm.acabado,
          COALESCE(rc.cantidad_pedida, dm.cantidad, 0) as cantidad_pedida,
          COALESCE(rc.cantidad_recibida, 0) as cantidad_recibida,
          COALESCE(rc.cantidad_pedida, dm.cantidad, 0) - COALESCE(rc.cantidad_recibida, 0) as cantidad_saldo,
          0 as cantidad_extruido,
          0 as cantidad_pintado,
          COALESCE(dm.kg, 0) as total_kg,
          (COALESCE(rc.cantidad_pedida, dm.cantidad, 0) - COALESCE(rc.cantidad_recibida, 0)) as kg_saldo,
          0 as kg_por_pintar,
          0 as kg_entrega,
          CASE WHEN COALESCE(rc.cantidad_pedida, dm.cantidad, 0) > 0
            THEN COALESCE(rc.cantidad_recibida, 0) / COALESCE(rc.cantidad_pedida, dm.cantidad, 1)
            ELSE 0 END as porcentaje_avance,
          ped.proveedor,
          COALESCE(rc.fecha_liberacion, ped.fecha_aprobacion) as fecha_liberacion,
          rc.fecha_entrega,
          rc.fecha_entrega_desfazada,
          NULL as fecha_ultima_recepcion,
          COALESCE(rc.prioridad, 'C') as prioridad,
          rc.observaciones_proveedor,
          rc.observaciones_heg,
          'miscelaneo' as tipo_material
        FROM pedidos_detalles_miscelaneos dm
        JOIN pedidos ped ON ped.id = dm.id_pedido
        JOIN proyectos pr ON pr.id_proyecto = ped.id_proyecto
        LEFT JOIN remisiones_control rc ON rc.id_detalle = dm.id_detalle AND rc.tipo_material = 'miscelaneo'
        WHERE ped.id_proyecto = ?
          AND LOWER(dm.descripcion) NOT LIKE '%traspaso%'
      `;
      const pMisc = [...params];

      if (prioridad && prioridad !== 'TODAS') {
        qMisc += ` AND COALESCE(rc.prioridad, 'C') = ?`;
        pMisc.push(prioridad);
      }
      if (proveedor) {
        qMisc += ` AND ped.proveedor LIKE ?`;
        pMisc.push(`%${proveedor}%`);
      }
      if (search) {
        qMisc += ` AND (dm.clave LIKE ? OR dm.descripcion LIKE ? OR ped.pedido LIKE ?)`;
        pMisc.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      const rowsMisc = await queryAsync(qMisc, pMisc);
      rows = rows.concat(rowsMisc);
    }

    rows.sort((a, b) => {
      if (a.prioridad !== b.prioridad) return a.prioridad.localeCompare(b.prioridad);
      return String(a.numero_pedido).localeCompare(String(b.numero_pedido));
    });

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("Error obteniendo remisiones:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
});

// Listar todas las remisiones (vista general)
app.get("/remisiones", authenticateToken, async (req, res) => {
  try {
    const { prioridad, id_proyecto, search, tipo } = req.query;

    let queryAluminio = `
      SELECT
        da.id_detalle as id_programacion,
        ped.id_proyecto,
        pr.nombre AS nombre_proyecto,
        ped.pedido as numero_pedido,
        '-' as subpedido,
        da.numero_perfil,
        da.descripcion,
        da.medida_tramo,
        da.peso_kg_ml,
        da.acabado,
        COALESCE(rc.cantidad_pedida, da.total_tramos, 0) as cantidad_pedida,
        COALESCE(rc.cantidad_recibida, 0) as cantidad_recibida,
        COALESCE(rc.cantidad_pedida, da.total_tramos, 0) - COALESCE(rc.cantidad_recibida, 0) as cantidad_saldo,
        COALESCE(rc.cantidad_extruido, 0) as cantidad_extruido,
        COALESCE(rc.cantidad_pintado, 0) as cantidad_pintado,
        COALESCE(da.kg, 0) as total_kg,
        (COALESCE(rc.cantidad_pedida, da.total_tramos, 0) - COALESCE(rc.cantidad_recibida, 0)) * COALESCE(da.medida_tramo, 0) * COALESCE(da.peso_kg_ml, 0) as kg_saldo,
        CASE WHEN COALESCE(rc.cantidad_pedida, da.total_tramos, 0) > 0
          THEN COALESCE(rc.cantidad_recibida, 0) / COALESCE(rc.cantidad_pedida, da.total_tramos, 1)
          ELSE 0 END as porcentaje_avance,
        ped.proveedor,
        COALESCE(rc.fecha_liberacion, ped.fecha_aprobacion) as fecha_liberacion,
        rc.fecha_entrega,
        COALESCE(rc.prioridad, 'C') as prioridad,
        'aluminio' as tipo_material
      FROM pedidos_detalles_aluminio da
      JOIN pedidos ped ON ped.id = da.id_pedido
      JOIN proyectos pr ON pr.id_proyecto = ped.id_proyecto
      LEFT JOIN remisiones_control rc ON rc.id_detalle = da.id_detalle AND rc.tipo_material = 'aluminio'
      WHERE 1=1
        AND LOWER(da.descripcion) NOT LIKE '%traspaso%'
    `;

    let queryCristal = `
      SELECT
        dc.id_detalle as id_programacion,
        ped.id_proyecto,
        pr.nombre AS nombre_proyecto,
        ped.pedido as numero_pedido,
        '-' as subpedido,
        dc.clave_modelo as numero_perfil,
        dc.descripcion,
        NULL as medida_tramo,
        NULL as peso_kg_ml,
        NULL as acabado,
        COALESCE(rc.cantidad_pedida, dc.piezas, 0) as cantidad_pedida,
        COALESCE(rc.cantidad_recibida, 0) as cantidad_recibida,
        COALESCE(rc.cantidad_pedida, dc.piezas, 0) - COALESCE(rc.cantidad_recibida, 0) as cantidad_saldo,
        0 as cantidad_extruido,
        0 as cantidad_pintado,
        COALESCE(dc.m2_pedido, 0) as total_kg,
        (COALESCE(rc.cantidad_pedida, dc.piezas, 0) - COALESCE(rc.cantidad_recibida, 0)) as kg_saldo,
        CASE WHEN COALESCE(rc.cantidad_pedida, dc.piezas, 0) > 0
          THEN COALESCE(rc.cantidad_recibida, 0) / COALESCE(rc.cantidad_pedida, dc.piezas, 1)
          ELSE 0 END as porcentaje_avance,
        ped.proveedor,
        COALESCE(rc.fecha_liberacion, ped.fecha_aprobacion) as fecha_liberacion,
        rc.fecha_entrega,
        COALESCE(rc.prioridad, 'C') as prioridad,
        'cristal' as tipo_material
      FROM pedidos_detalles_cristal dc
      JOIN pedidos ped ON ped.id = dc.id_pedido
      JOIN proyectos pr ON pr.id_proyecto = ped.id_proyecto
      LEFT JOIN remisiones_control rc ON rc.id_detalle = dc.id_detalle AND rc.tipo_material = 'cristal'
      WHERE 1=1
        AND LOWER(dc.descripcion) NOT LIKE '%traspaso%'
    `;

    let rows = [];

    if (!tipo || tipo === 'aluminio' || tipo === 'todos') {
      let qAlu = queryAluminio;
      const pAlu = [];

      if (id_proyecto) {
        qAlu += ` AND ped.id_proyecto = ?`;
        pAlu.push(id_proyecto);
      }
      if (prioridad && prioridad !== 'TODAS') {
        qAlu += ` AND COALESCE(rc.prioridad, 'C') = ?`;
        pAlu.push(prioridad);
      }
      if (search) {
        qAlu += ` AND (da.numero_perfil LIKE ? OR da.descripcion LIKE ? OR ped.pedido LIKE ? OR pr.nombre LIKE ?)`;
        pAlu.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
      }

      const rowsAluminio = await queryAsync(qAlu, pAlu);
      rows = rows.concat(rowsAluminio);
    }

    if (!tipo || tipo === 'cristal' || tipo === 'todos') {
      let qCri = queryCristal;
      const pCri = [];

      if (id_proyecto) {
        qCri += ` AND ped.id_proyecto = ?`;
        pCri.push(id_proyecto);
      }
      if (prioridad && prioridad !== 'TODAS') {
        qCri += ` AND COALESCE(rc.prioridad, 'C') = ?`;
        pCri.push(prioridad);
      }
      if (search) {
        qCri += ` AND (dc.clave_modelo LIKE ? OR dc.descripcion LIKE ? OR ped.pedido LIKE ? OR pr.nombre LIKE ?)`;
        pCri.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
      }

      const rowsCristal = await queryAsync(qCri, pCri);
      rows = rows.concat(rowsCristal);
    }

    if (!tipo || tipo === 'miscelaneo' || tipo === 'todos') {
      let qMisc = `
        SELECT
          dm.id_detalle as id_programacion,
          ped.id_proyecto,
          pr.nombre AS nombre_proyecto,
          ped.pedido as numero_pedido,
          '-' as subpedido,
          COALESCE(dm.clave, '') as numero_perfil,
          dm.descripcion,
          dm.ml as medida_tramo,
          dm.precio_x_kg as peso_kg_ml,
          dm.acabado,
          COALESCE(rc.cantidad_pedida, dm.cantidad, 0) as cantidad_pedida,
          COALESCE(rc.cantidad_recibida, 0) as cantidad_recibida,
          COALESCE(rc.cantidad_pedida, dm.cantidad, 0) - COALESCE(rc.cantidad_recibida, 0) as cantidad_saldo,
          0 as cantidad_extruido,
          0 as cantidad_pintado,
          COALESCE(dm.kg, 0) as total_kg,
          (COALESCE(rc.cantidad_pedida, dm.cantidad, 0) - COALESCE(rc.cantidad_recibida, 0)) as kg_saldo,
          CASE WHEN COALESCE(rc.cantidad_pedida, dm.cantidad, 0) > 0
            THEN COALESCE(rc.cantidad_recibida, 0) / COALESCE(rc.cantidad_pedida, dm.cantidad, 1)
            ELSE 0 END as porcentaje_avance,
          ped.proveedor,
          COALESCE(rc.fecha_liberacion, ped.fecha_aprobacion) as fecha_liberacion,
          rc.fecha_entrega,
          COALESCE(rc.prioridad, 'C') as prioridad,
          'miscelaneo' as tipo_material
        FROM pedidos_detalles_miscelaneos dm
        JOIN pedidos ped ON ped.id = dm.id_pedido
        JOIN proyectos pr ON pr.id_proyecto = ped.id_proyecto
        LEFT JOIN remisiones_control rc ON rc.id_detalle = dm.id_detalle AND rc.tipo_material = 'miscelaneo'
        WHERE 1=1
          AND LOWER(dm.descripcion) NOT LIKE '%traspaso%'
      `;
      const pMisc = [];

      if (id_proyecto) {
        qMisc += ` AND ped.id_proyecto = ?`;
        pMisc.push(id_proyecto);
      }
      if (prioridad && prioridad !== 'TODAS') {
        qMisc += ` AND COALESCE(rc.prioridad, 'C') = ?`;
        pMisc.push(prioridad);
      }
      if (search) {
        qMisc += ` AND (dm.clave LIKE ? OR dm.descripcion LIKE ? OR ped.pedido LIKE ? OR pr.nombre LIKE ?)`;
        pMisc.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
      }

      const rowsMisc = await queryAsync(qMisc, pMisc);
      rows = rows.concat(rowsMisc);
    }

    rows.sort((a, b) => {
      if (a.prioridad !== b.prioridad) return a.prioridad.localeCompare(b.prioridad);
      if (a.nombre_proyecto !== b.nombre_proyecto) return a.nombre_proyecto.localeCompare(b.nombre_proyecto);
      return String(a.numero_pedido).localeCompare(String(b.numero_pedido));
    });

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("Error obteniendo remisiones:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
});

// Obtener resumen de remisiones por prioridad (de ambas tablas)
app.get("/remisiones/resumen", authenticateToken, async (req, res) => {
  try {
    // Resumen de Aluminio con LEFT JOIN a remisiones_control
    const queryAluminio = `
      SELECT
        COALESCE(rc.prioridad, 'C') as prioridad,
        COUNT(*) AS total_items,
        SUM(COALESCE(rc.cantidad_pedida, da.total_tramos, 0)) AS total_pedido,
        SUM(COALESCE(rc.cantidad_recibida, 0)) AS total_recibido,
        SUM(COALESCE(rc.cantidad_pedida, da.total_tramos, 0) - COALESCE(rc.cantidad_recibida, 0)) AS total_saldo,
        SUM(COALESCE(da.kg, 0)) AS total_kg,
        SUM((COALESCE(rc.cantidad_pedida, da.total_tramos, 0) - COALESCE(rc.cantidad_recibida, 0)) * COALESCE(da.medida_tramo, 0) * COALESCE(da.peso_kg_ml, 0)) AS kg_saldo
      FROM pedidos_detalles_aluminio da
      LEFT JOIN remisiones_control rc ON rc.id_detalle = da.id_detalle AND rc.tipo_material = 'aluminio'
      WHERE LOWER(da.descripcion) NOT LIKE '%traspaso%'
      GROUP BY COALESCE(rc.prioridad, 'C')
    `;

    // Resumen de Cristal con LEFT JOIN a remisiones_control
    const queryCristal = `
      SELECT
        COALESCE(rc.prioridad, 'C') as prioridad,
        COUNT(*) AS total_items,
        SUM(COALESCE(rc.cantidad_pedida, dc.piezas, 0)) AS total_pedido,
        SUM(COALESCE(rc.cantidad_recibida, 0)) AS total_recibido,
        SUM(COALESCE(rc.cantidad_pedida, dc.piezas, 0) - COALESCE(rc.cantidad_recibida, 0)) AS total_saldo,
        SUM(COALESCE(dc.m2_pedido, 0)) AS total_kg,
        SUM(COALESCE(rc.cantidad_pedida, dc.piezas, 0) - COALESCE(rc.cantidad_recibida, 0)) AS kg_saldo
      FROM pedidos_detalles_cristal dc
      LEFT JOIN remisiones_control rc ON rc.id_detalle = dc.id_detalle AND rc.tipo_material = 'cristal'
      WHERE LOWER(dc.descripcion) NOT LIKE '%traspaso%'
      GROUP BY COALESCE(rc.prioridad, 'C')
    `;

    const rowsAluminio = await queryAsync(queryAluminio);
    const rowsCristal = await queryAsync(queryCristal);

    // Combinar resultados por prioridad
    const resumenMap = {};
    for (const r of rowsAluminio) {
      if (!resumenMap[r.prioridad]) {
        resumenMap[r.prioridad] = { prioridad: r.prioridad, total_items: 0, total_pedido: 0, total_recibido: 0, total_saldo: 0, total_kg: 0, kg_saldo: 0 };
      }
      resumenMap[r.prioridad].total_items += Number(r.total_items) || 0;
      resumenMap[r.prioridad].total_pedido += Number(r.total_pedido) || 0;
      resumenMap[r.prioridad].total_recibido += Number(r.total_recibido) || 0;
      resumenMap[r.prioridad].total_saldo += Number(r.total_saldo) || 0;
      resumenMap[r.prioridad].total_kg += Number(r.total_kg) || 0;
      resumenMap[r.prioridad].kg_saldo += Number(r.kg_saldo) || 0;
    }
    for (const r of rowsCristal) {
      if (!resumenMap[r.prioridad]) {
        resumenMap[r.prioridad] = { prioridad: r.prioridad, total_items: 0, total_pedido: 0, total_recibido: 0, total_saldo: 0, total_kg: 0, kg_saldo: 0 };
      }
      resumenMap[r.prioridad].total_items += Number(r.total_items) || 0;
      resumenMap[r.prioridad].total_pedido += Number(r.total_pedido) || 0;
      resumenMap[r.prioridad].total_recibido += Number(r.total_recibido) || 0;
      resumenMap[r.prioridad].total_saldo += Number(r.total_saldo) || 0;
      resumenMap[r.prioridad].total_kg += Number(r.total_kg) || 0;
      resumenMap[r.prioridad].kg_saldo += Number(r.kg_saldo) || 0;
    }

    // Calcular porcentaje promedio
    const rows = Object.values(resumenMap).map(r => ({
      ...r,
      porcentaje_promedio: r.total_pedido > 0 ? Math.round((r.total_recibido / r.total_pedido) * 100 * 100) / 100 : 0
    }));

    rows.sort((a, b) => a.prioridad.localeCompare(b.prioridad));

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("Error obteniendo resumen de remisiones:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
});

// Actualizar control de entregas (aluminio o cristal)
app.put("/remisiones/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      tipo_material,
      cantidad_pedida,
      cantidad_recibida,
      cantidad_extruido,
      cantidad_pintado,
      fecha_liberacion,
      fecha_entrega,
      fecha_entrega_desfazada,
      prioridad,
      observaciones_proveedor,
      observaciones_heg
    } = req.body;

    if (!tipo_material || !['aluminio', 'cristal', 'miscelaneo'].includes(tipo_material)) {
      return res.status(400).json({ success: false, message: "tipo_material requerido (aluminio, cristal o miscelaneo)" });
    }

    // UPSERT en remisiones_control
    const query = `
      INSERT INTO remisiones_control (id_detalle, tipo_material, cantidad_pedida, cantidad_recibida, cantidad_extruido, cantidad_pintado, prioridad, fecha_liberacion, fecha_entrega, fecha_entrega_desfazada, observaciones_proveedor, observaciones_heg)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        cantidad_pedida = COALESCE(VALUES(cantidad_pedida), cantidad_pedida),
        cantidad_recibida = COALESCE(VALUES(cantidad_recibida), cantidad_recibida),
        cantidad_extruido = COALESCE(VALUES(cantidad_extruido), cantidad_extruido),
        cantidad_pintado = COALESCE(VALUES(cantidad_pintado), cantidad_pintado),
        prioridad = COALESCE(VALUES(prioridad), prioridad),
        fecha_liberacion = COALESCE(VALUES(fecha_liberacion), fecha_liberacion),
        fecha_entrega = COALESCE(VALUES(fecha_entrega), fecha_entrega),
        fecha_entrega_desfazada = COALESCE(VALUES(fecha_entrega_desfazada), fecha_entrega_desfazada),
        observaciones_proveedor = COALESCE(VALUES(observaciones_proveedor), observaciones_proveedor),
        observaciones_heg = COALESCE(VALUES(observaciones_heg), observaciones_heg)
    `;

    await queryAsync(query, [
      id,
      tipo_material,
      cantidad_pedida !== undefined ? cantidad_pedida : null,
      cantidad_recibida !== undefined ? cantidad_recibida : null,
      cantidad_extruido !== undefined ? cantidad_extruido : null,
      cantidad_pintado !== undefined ? cantidad_pintado : null,
      prioridad !== undefined ? prioridad : null,
      fecha_liberacion !== undefined ? fecha_liberacion : null,
      fecha_entrega !== undefined ? fecha_entrega : null,
      fecha_entrega_desfazada !== undefined ? fecha_entrega_desfazada : null,
      observaciones_proveedor !== undefined ? observaciones_proveedor : null,
      observaciones_heg !== undefined ? observaciones_heg : null
    ]);

    res.json({ success: true, message: "Registro actualizado exitosamente" });
  } catch (err) {
    console.error("Error actualizando control de entregas:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
});

// Exportar remisiones a Excel
app.get("/proyectos/:id/remisiones/export", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { prioridad, tipo } = req.query;

    // Obtener datos del proyecto
    const [proyecto] = await queryAsync(`SELECT nombre FROM proyectos WHERE id_proyecto = ?`, [id]);
    if (!proyecto) {
      return res.status(404).json({ success: false, message: "Proyecto no encontrado" });
    }

    // Obtener datos de pedidos_detalles
    let rows = [];

    if (!tipo || tipo === 'aluminio' || tipo === 'todos') {
      let qAlu = `
        SELECT
          da.id_detalle as id_programacion,
          pr.nombre AS nombre_proyecto,
          ped.pedido as numero_pedido,
          '-' as subpedido,
          da.numero_perfil,
          da.descripcion,
          da.medida_tramo,
          da.peso_kg_ml,
          da.acabado,
          COALESCE(rc.cantidad_pedida, da.total_tramos, 0) as cantidad_pedida,
          COALESCE(rc.cantidad_recibida, 0) as cantidad_recibida,
          COALESCE(rc.cantidad_pedida, da.total_tramos, 0) - COALESCE(rc.cantidad_recibida, 0) as cantidad_saldo,
          COALESCE(rc.cantidad_extruido, 0) as cantidad_extruido,
          COALESCE(rc.cantidad_pintado, 0) as cantidad_pintado,
          COALESCE(da.kg, 0) as total_kg,
          (COALESCE(rc.cantidad_pedida, da.total_tramos, 0) - COALESCE(rc.cantidad_recibida, 0)) * COALESCE(da.medida_tramo, 0) * COALESCE(da.peso_kg_ml, 0) as kg_saldo,
          CASE WHEN COALESCE(rc.cantidad_pedida, da.total_tramos, 0) > 0
            THEN COALESCE(rc.cantidad_recibida, 0) / COALESCE(rc.cantidad_pedida, da.total_tramos, 1)
            ELSE 0 END as porcentaje_avance,
          COALESCE(rc.fecha_liberacion, ped.fecha_aprobacion) as fecha_liberacion,
          rc.fecha_entrega,
          NULL as fecha_entrega_desfazada,
          COALESCE(rc.prioridad, 'C') as prioridad,
          rc.observaciones_proveedor,
          rc.observaciones_heg,
          'aluminio' as tipo_material
        FROM pedidos_detalles_aluminio da
        JOIN pedidos ped ON ped.id = da.id_pedido
        JOIN proyectos pr ON pr.id_proyecto = ped.id_proyecto
        LEFT JOIN remisiones_control rc ON rc.id_detalle = da.id_detalle AND rc.tipo_material = 'aluminio'
        WHERE ped.id_proyecto = ?
          AND LOWER(da.descripcion) NOT LIKE '%traspaso%'
      `;
      const pAlu = [id];
      if (prioridad && prioridad !== 'TODAS') {
        qAlu += ` AND COALESCE(rc.prioridad, 'C') = ?`;
        pAlu.push(prioridad);
      }
      const rowsAlu = await queryAsync(qAlu, pAlu);
      rows = rows.concat(rowsAlu);
    }

    if (!tipo || tipo === 'cristal' || tipo === 'todos') {
      let qCri = `
        SELECT
          dc.id_detalle as id_programacion,
          pr.nombre AS nombre_proyecto,
          ped.pedido as numero_pedido,
          '-' as subpedido,
          dc.clave_modelo as numero_perfil,
          dc.descripcion,
          NULL as medida_tramo,
          NULL as peso_kg_ml,
          NULL as acabado,
          COALESCE(rc.cantidad_pedida, dc.piezas, 0) as cantidad_pedida,
          COALESCE(rc.cantidad_recibida, 0) as cantidad_recibida,
          COALESCE(rc.cantidad_pedida, dc.piezas, 0) - COALESCE(rc.cantidad_recibida, 0) as cantidad_saldo,
          0 as cantidad_extruido,
          0 as cantidad_pintado,
          COALESCE(dc.m2_pedido, 0) as total_kg,
          (COALESCE(rc.cantidad_pedida, dc.piezas, 0) - COALESCE(rc.cantidad_recibida, 0)) as kg_saldo,
          CASE WHEN COALESCE(rc.cantidad_pedida, dc.piezas, 0) > 0
            THEN COALESCE(rc.cantidad_recibida, 0) / COALESCE(rc.cantidad_pedida, dc.piezas, 1)
            ELSE 0 END as porcentaje_avance,
          COALESCE(rc.fecha_liberacion, ped.fecha_aprobacion) as fecha_liberacion,
          rc.fecha_entrega,
          rc.fecha_entrega_desfazada,
          COALESCE(rc.prioridad, 'C') as prioridad,
          rc.observaciones_proveedor,
          rc.observaciones_heg,
          'cristal' as tipo_material
        FROM pedidos_detalles_cristal dc
        JOIN pedidos ped ON ped.id = dc.id_pedido
        JOIN proyectos pr ON pr.id_proyecto = ped.id_proyecto
        LEFT JOIN remisiones_control rc ON rc.id_detalle = dc.id_detalle AND rc.tipo_material = 'cristal'
        WHERE ped.id_proyecto = ?
          AND LOWER(dc.descripcion) NOT LIKE '%traspaso%'
      `;
      const pCri = [id];
      if (prioridad && prioridad !== 'TODAS') {
        qCri += ` AND COALESCE(rc.prioridad, 'C') = ?`;
        pCri.push(prioridad);
      }
      const rowsCri = await queryAsync(qCri, pCri);
      rows = rows.concat(rowsCri);
    }

    rows.sort((a, b) => {
      if (a.prioridad !== b.prioridad) return a.prioridad.localeCompare(b.prioridad);
      return String(a.numero_pedido).localeCompare(String(b.numero_pedido));
    });

    // Crear workbook
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Programación de Entregas');

    // Encabezados
    const headerRow1 = ws.addRow(['PROYECTO:', proyecto.nombre]);
    headerRow1.font = { bold: true };
    const fechaGen = new Date().toLocaleDateString('es-MX');
    ws.addRow(['FECHA:', fechaGen]);
    ws.addRow(['CONCEPTO:', 'PROGRAMA DE ENTREGAS - CONTROL DE REMISIONES']);
    ws.addRow([]);

    // Headers de columnas
    const headers = [
      'NO.', 'PROYECTO', 'PEDIDO', 'SUBPEDIDO', 'PERFIL', 'DESCRIPCIÓN',
      'MEDIDA', 'PESO', 'TOTAL KG', 'ACABADO',
      'PEDIDO', 'RECIBIDO', 'SALDO', 'EXTRUIDO', 'PINTADO',
      'FECHA LIBERACIÓN', 'FECHA ENTREGA', '%', 'PRIORIDAD',
      'OBS. PROVEEDOR', 'OBS. HEG', 'KG SALDO'
    ];
    const headerRowIdx = 6;
    const hRow = ws.getRow(headerRowIdx);
    headers.forEach((h, i) => {
      const cell = hRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' }, bottom: { style: 'thin' },
        left: { style: 'thin' }, right: { style: 'thin' }
      };
    });

    // Datos
    let totalKg = 0, totalKgSaldo = 0;
    rows.forEach((r, idx) => {
      const row = ws.addRow([
        idx + 1,
        proyecto.nombre,
        r.numero_pedido,
        r.subpedido,
        r.numero_perfil,
        r.descripcion,
        r.medida_tramo,
        r.peso_kg_ml,
        r.total_kg,
        r.acabado,
        r.cantidad_pedida,
        r.cantidad_recibida,
        r.cantidad_saldo,
        r.cantidad_extruido,
        r.cantidad_pintado,
        r.fecha_liberacion ? new Date(r.fecha_liberacion).toLocaleDateString('es-MX') : '',
        r.fecha_entrega ? new Date(r.fecha_entrega).toLocaleDateString('es-MX') : '',
        r.porcentaje_avance ? (r.porcentaje_avance * 100).toFixed(1) + '%' : '0%',
        r.prioridad,
        r.observaciones_proveedor || '',
        r.observaciones_heg || '',
        r.kg_saldo
      ]);

      // Formato de celdas numéricas
      row.getCell(7).numFmt = '0.000';
      row.getCell(8).numFmt = '0.0000';
      row.getCell(9).numFmt = '#,##0.000';
      row.getCell(22).numFmt = '#,##0.000';

      // Color por prioridad
      let bgColor = 'FFFFFFFF';
      if (r.prioridad === 'A') bgColor = 'FFFFCCCC';
      else if (r.prioridad === 'B') bgColor = 'FFFFFFCC';
      else if (r.prioridad === 'C') bgColor = 'FFCCFFCC';

      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
          bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
          left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
          right: { style: 'thin', color: { argb: 'FFDDDDDD' } }
        };
      });

      totalKg += Number(r.total_kg) || 0;
      totalKgSaldo += Number(r.kg_saldo) || 0;
    });

    // Fila de totales
    const totalRow = ws.addRow([
      '', '', '', '', '', 'TOTALES', '', '', totalKg, '', '', '', '', '', '',
      '', '', '', '', '', '', totalKgSaldo
    ]);
    totalRow.font = { bold: true };
    totalRow.getCell(9).numFmt = '#,##0.000';
    totalRow.getCell(22).numFmt = '#,##0.000';

    // Ajustar anchos de columna
    ws.columns.forEach((col, i) => {
      col.width = [5, 15, 10, 10, 12, 35, 8, 8, 12, 25, 8, 8, 8, 8, 8, 15, 15, 8, 8, 30, 30, 12][i] || 10;
    });

    // Congelar filas
    ws.views = [{ state: 'frozen', ySplit: headerRowIdx }];

    // Enviar archivo
    const filename = `remisiones_${proyecto.nombre.replace(/\s+/g, '_')}_${fechaGen.replace(/\//g, '-')}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Error exportando remisiones:", err);
    res.status(500).json({ success: false, message: "Error generando archivo" });
  }
});

// Exportar tabla resumen general (todos los proyectos)
app.get("/remisiones/export", authenticateToken, async (req, res) => {
  try {
    const { prioridad, tipo } = req.query;

    let rows = [];

    if (!tipo || tipo === 'aluminio' || tipo === 'todos') {
      let qAlu = `
        SELECT
          da.id_detalle as id_programacion,
          pr.nombre AS nombre_proyecto,
          ped.pedido as numero_pedido,
          '-' as subpedido,
          da.numero_perfil,
          da.descripcion,
          da.medida_tramo,
          da.peso_kg_ml,
          da.acabado,
          COALESCE(rc.cantidad_pedida, da.total_tramos, 0) as cantidad_pedida,
          COALESCE(rc.cantidad_recibida, 0) as cantidad_recibida,
          COALESCE(rc.cantidad_pedida, da.total_tramos, 0) - COALESCE(rc.cantidad_recibida, 0) as cantidad_saldo,
          COALESCE(rc.cantidad_extruido, 0) as cantidad_extruido,
          COALESCE(rc.cantidad_pintado, 0) as cantidad_pintado,
          COALESCE(da.kg, 0) as total_kg,
          (COALESCE(rc.cantidad_pedida, da.total_tramos, 0) - COALESCE(rc.cantidad_recibida, 0)) * COALESCE(da.medida_tramo, 0) * COALESCE(da.peso_kg_ml, 0) as kg_saldo,
          CASE WHEN COALESCE(rc.cantidad_pedida, da.total_tramos, 0) > 0
            THEN COALESCE(rc.cantidad_recibida, 0) / COALESCE(rc.cantidad_pedida, da.total_tramos, 1)
            ELSE 0 END as porcentaje_avance,
          rc.fecha_liberacion,
          rc.fecha_entrega,
          NULL as fecha_entrega_desfazada,
          COALESCE(rc.prioridad, 'C') as prioridad,
          rc.observaciones_proveedor,
          rc.observaciones_heg,
          'aluminio' as tipo_material
        FROM pedidos_detalles_aluminio da
        JOIN pedidos ped ON ped.id = da.id_pedido
        JOIN proyectos pr ON pr.id_proyecto = ped.id_proyecto
        LEFT JOIN remisiones_control rc ON rc.id_detalle = da.id_detalle AND rc.tipo_material = 'aluminio'
        WHERE 1=1
          AND LOWER(da.descripcion) NOT LIKE '%traspaso%'
      `;
      const pAlu = [];
      if (prioridad && prioridad !== 'TODAS') {
        qAlu += ` AND COALESCE(rc.prioridad, 'C') = ?`;
        pAlu.push(prioridad);
      }
      const rowsAlu = await queryAsync(qAlu, pAlu);
      rows = rows.concat(rowsAlu);
    }

    if (!tipo || tipo === 'cristal' || tipo === 'todos') {
      let qCri = `
        SELECT
          dc.id_detalle as id_programacion,
          pr.nombre AS nombre_proyecto,
          ped.pedido as numero_pedido,
          '-' as subpedido,
          dc.clave_modelo as numero_perfil,
          dc.descripcion,
          NULL as medida_tramo,
          NULL as peso_kg_ml,
          NULL as acabado,
          COALESCE(rc.cantidad_pedida, dc.piezas, 0) as cantidad_pedida,
          COALESCE(rc.cantidad_recibida, 0) as cantidad_recibida,
          COALESCE(rc.cantidad_pedida, dc.piezas, 0) - COALESCE(rc.cantidad_recibida, 0) as cantidad_saldo,
          0 as cantidad_extruido,
          0 as cantidad_pintado,
          COALESCE(dc.m2_pedido, 0) as total_kg,
          (COALESCE(rc.cantidad_pedida, dc.piezas, 0) - COALESCE(rc.cantidad_recibida, 0)) as kg_saldo,
          CASE WHEN COALESCE(rc.cantidad_pedida, dc.piezas, 0) > 0
            THEN COALESCE(rc.cantidad_recibida, 0) / COALESCE(rc.cantidad_pedida, dc.piezas, 1)
            ELSE 0 END as porcentaje_avance,
          rc.fecha_liberacion,
          rc.fecha_entrega,
          rc.fecha_entrega_desfazada,
          COALESCE(rc.prioridad, 'C') as prioridad,
          rc.observaciones_proveedor,
          rc.observaciones_heg,
          'cristal' as tipo_material
        FROM pedidos_detalles_cristal dc
        JOIN pedidos ped ON ped.id = dc.id_pedido
        JOIN proyectos pr ON pr.id_proyecto = ped.id_proyecto
        LEFT JOIN remisiones_control rc ON rc.id_detalle = dc.id_detalle AND rc.tipo_material = 'cristal'
        WHERE 1=1
          AND LOWER(dc.descripcion) NOT LIKE '%traspaso%'
      `;
      const pCri = [];
      if (prioridad && prioridad !== 'TODAS') {
        qCri += ` AND COALESCE(rc.prioridad, 'C') = ?`;
        pCri.push(prioridad);
      }
      const rowsCri = await queryAsync(qCri, pCri);
      rows = rows.concat(rowsCri);
    }

    rows.sort((a, b) => {
      if (a.prioridad !== b.prioridad) return a.prioridad.localeCompare(b.prioridad);
      if (a.nombre_proyecto !== b.nombre_proyecto) return a.nombre_proyecto.localeCompare(b.nombre_proyecto);
      return String(a.numero_pedido).localeCompare(String(b.numero_pedido));
    });

    // Crear workbook
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Tabla Resumen');

    const fechaGen = new Date().toLocaleDateString('es-MX');
    ws.addRow(['PROYECTO:', 'GENERAL']);
    ws.addRow(['FECHA:', fechaGen]);
    ws.addRow(['CONCEPTO:', 'PROGRAMA DE ENTREGAS - TABLA RESUMEN']);
    ws.addRow([]);

    // Headers
    const headers = [
      'NO.', 'PROYECTO', 'PEDIDO', 'SUBPEDIDO', 'PERFIL', 'DESCRIPCIÓN',
      'MEDIDA', 'PESO', 'TOTAL KG', 'ACABADO',
      'PEDIDO', 'RECIBIDO', 'SALDO', 'EXTRUIDO', 'PINTADO',
      'FECHA LIBERACIÓN', 'FECHA ENTREGA', '%', 'PRIORIDAD',
      'OBS. PROVEEDOR', 'OBS. HEG', 'KG SALDO'
    ];
    const headerRowIdx = 5;
    const hRow = ws.getRow(headerRowIdx);
    headers.forEach((h, i) => {
      const cell = hRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    let totalKg = 0, totalKgSaldo = 0;
    rows.forEach((r, idx) => {
      const row = ws.addRow([
        idx + 1,
        r.nombre_proyecto,
        r.numero_pedido,
        r.subpedido,
        r.numero_perfil,
        r.descripcion,
        r.medida_tramo,
        r.peso_kg_ml,
        r.total_kg,
        r.acabado,
        r.cantidad_pedida,
        r.cantidad_recibida,
        r.cantidad_saldo,
        r.cantidad_extruido,
        r.cantidad_pintado,
        r.fecha_liberacion ? new Date(r.fecha_liberacion).toLocaleDateString('es-MX') : '',
        r.fecha_entrega ? new Date(r.fecha_entrega).toLocaleDateString('es-MX') : '',
        r.porcentaje_avance ? (r.porcentaje_avance * 100).toFixed(1) + '%' : '0%',
        r.prioridad,
        r.observaciones_proveedor || '',
        r.observaciones_heg || '',
        r.kg_saldo
      ]);

      let bgColor = 'FFFFFFFF';
      if (r.prioridad === 'A') bgColor = 'FFFFCCCC';
      else if (r.prioridad === 'B') bgColor = 'FFFFFFCC';
      else if (r.prioridad === 'C') bgColor = 'FFCCFFCC';

      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      });

      totalKg += Number(r.total_kg) || 0;
      totalKgSaldo += Number(r.kg_saldo) || 0;
    });

    const totalRow = ws.addRow(['', '', '', '', '', 'TOTALES', '', '', totalKg, '', '', '', '', '', '', '', '', '', '', '', '', totalKgSaldo]);
    totalRow.font = { bold: true };

    ws.columns.forEach((col, i) => {
      col.width = [5, 15, 10, 10, 12, 35, 8, 8, 12, 25, 8, 8, 8, 8, 8, 15, 15, 8, 8, 30, 30, 12][i] || 10;
    });

    ws.views = [{ state: 'frozen', ySplit: headerRowIdx }];

    const filename = `remisiones_general_${fechaGen.replace(/\//g, '-')}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Error exportando remisiones:", err);
    res.status(500).json({ success: false, message: "Error generando archivo" });
  }
});

// ============================================================================
// NUEVAS RUTAS DE REMISIONES - AGREGAR REMISIÓN Y HISTORIAL
// ============================================================================

// Buscar pedidos para agregar remisión
app.get("/remisiones/buscar-pedidos", authenticateToken, async (req, res) => {
  try {
    const { tipo, search, familia } = req.query;
    console.log(`[DEBUG] Buscando pedidos - Tipo: ${tipo}, Search: ${search}, Familia: ${familia}`);

    if (!tipo || !['aluminio', 'cristal', 'miscelaneo'].includes(tipo)) {
      return res.status(400).json({ success: false, message: "Tipo de material requerido (aluminio, cristal o miscelaneo)" });
    }

    let query;
    const params = [];

    if (tipo === 'miscelaneo') {
      query = `
        SELECT DISTINCT
          ped.id,
          ped.pedido as numero_pedido,
          pr.nombre as nombre_proyecto,
          ped.proveedor,
          ped.familia
        FROM pedidos ped
        JOIN proyectos pr ON pr.id_proyecto = ped.id_proyecto
        WHERE UPPER(ped.familia) NOT IN ('AL', 'MQAL', 'CR')
      `;
    } else {
      let familiaMatch = [];
      if (tipo === 'aluminio') {
        familiaMatch = ['AL', 'MQAL', 'aluminio'];
      } else if (tipo === 'cristal') {
        familiaMatch = ['CR', 'cristal'];
      }
      query = `
        SELECT DISTINCT
          ped.id,
          ped.pedido as numero_pedido,
          pr.nombre as nombre_proyecto,
          ped.proveedor,
          ped.familia
        FROM pedidos ped
        JOIN proyectos pr ON pr.id_proyecto = ped.id_proyecto
        WHERE (LOWER(ped.familia) IN (${familiaMatch.map(() => '?').join(',')}) OR LOWER(ped.familia) LIKE ?)
      `;
      params.push(...familiaMatch.map(f => f.toLowerCase()), `%${tipo}%`);
    }

    if (search) {
      query += ` AND (ped.pedido LIKE ? OR pr.nombre LIKE ? OR ped.proveedor LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (familia) {
      query += ` AND UPPER(ped.familia) LIKE ?`;
      params.push(`%${familia.toUpperCase()}%`);
    }

    query += ` ORDER BY ped.pedido DESC LIMIT 50`;

    const rows = await queryAsync(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("Error buscando pedidos:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
});

// Obtener detalles de un pedido para agregar remisión
app.get("/remisiones/detalles-pedido/:pedidoId", authenticateToken, async (req, res) => {
  try {
    const { pedidoId } = req.params;
    const { tipo } = req.query;

    if (!tipo || !['aluminio', 'cristal', 'miscelaneo'].includes(tipo)) {
      return res.status(400).json({ success: false, message: "Tipo de material requerido" });
    }

    let query;
    if (tipo === 'aluminio') {
      query = `
        SELECT
          da.id_detalle,
          da.numero_perfil,
          NULL as clave_modelo,
          da.descripcion,
          COALESCE(da.total_tramos, 0) as cantidad_disponible,
          COALESCE(rc.cantidad_pedida, da.total_tramos, 0) as cantidad_pedida,
          COALESCE(rc.cantidad_recibida, 0) as cantidad_recibida,
          'aluminio' as tipo_material
        FROM pedidos_detalles_aluminio da
        LEFT JOIN remisiones_control rc ON rc.id_detalle = da.id_detalle AND rc.tipo_material = 'aluminio'
        WHERE da.id_pedido = ?
          AND LOWER(da.descripcion) NOT LIKE '%traspaso%'
        ORDER BY da.id_detalle ASC
      `;
    } else if (tipo === 'cristal') {
      query = `
        SELECT
          dc.id_detalle,
          NULL as numero_perfil,
          dc.clave_modelo,
          dc.descripcion,
          COALESCE(dc.piezas, 0) as cantidad_disponible,
          COALESCE(rc.cantidad_pedida, dc.piezas, 0) as cantidad_pedida,
          COALESCE(rc.cantidad_recibida, 0) as cantidad_recibida,
          'cristal' as tipo_material
        FROM pedidos_detalles_cristal dc
        LEFT JOIN remisiones_control rc ON rc.id_detalle = dc.id_detalle AND rc.tipo_material = 'cristal'
        WHERE dc.id_pedido = ?
          AND LOWER(dc.descripcion) NOT LIKE '%traspaso%'
        ORDER BY dc.id_detalle ASC
      `;
    } else {
      query = `
        SELECT
          dm.id_detalle,
          dm.clave as numero_perfil,
          NULL as clave_modelo,
          dm.descripcion,
          COALESCE(dm.cantidad, 0) as cantidad_disponible,
          COALESCE(rc.cantidad_pedida, dm.cantidad, 0) as cantidad_pedida,
          COALESCE(rc.cantidad_recibida, 0) as cantidad_recibida,
          'miscelaneo' as tipo_material
        FROM pedidos_detalles_miscelaneos dm
        LEFT JOIN remisiones_control rc ON rc.id_detalle = dm.id_detalle AND rc.tipo_material = 'miscelaneo'
        WHERE dm.id_pedido = ?
          AND LOWER(dm.descripcion) NOT LIKE '%traspaso%'
        ORDER BY dm.id_detalle ASC
      `;
    }

    const rows = await queryAsync(query, [pedidoId]);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("Error obteniendo detalles de pedido:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
});

// Registrar una entrega (acepta multipart/form-data para PDF adjunto opcional)
app.post("/remisiones/registrar-entrega", authenticateToken, (req, res, next) => {
  uploadRemision(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    next();
  });
}, async (req, res) => {
  const pdfFile = req.file || null;
  try {
    const id_pedido = req.body.id_pedido;
    const tipo_material = req.body.tipo_material;
    const observaciones = req.body.observaciones || null;
    const ruta_pdf = pdfFile ? pdfFile.filename : null;

    // entregas llega como JSON string desde FormData
    let entregas;
    try {
      entregas = JSON.parse(req.body.entregas);
    } catch {
      if (pdfFile) fs.unlinkSync(pdfFile.path);
      return res.status(400).json({ success: false, message: "El campo entregas no es JSON válido" });
    }

    const usuario = req.user?.username || 'sistema';

    if (!id_pedido || !tipo_material || !entregas || !Array.isArray(entregas) || entregas.length === 0) {
      if (pdfFile) fs.unlinkSync(pdfFile.path);
      return res.status(400).json({ success: false, message: "Datos incompletos" });
    }

    // Obtener datos del pedido
    const [pedido] = await queryAsync(
      `SELECT ped.pedido, pr.nombre as nombre_proyecto
       FROM pedidos ped
       JOIN proyectos pr ON pr.id_proyecto = ped.id_proyecto
       WHERE ped.id = ?`,
      [id_pedido]
    );

    if (!pedido) {
      if (pdfFile) fs.unlinkSync(pdfFile.path);
      return res.status(404).json({ success: false, message: "Pedido no encontrado" });
    }

    // Registrar historial de entrega
    const historialResult = await queryAsync(
      `INSERT INTO remisiones_historial_entregas (id_pedido, numero_pedido, nombre_proyecto, tipo_material, total_items, total_piezas, observaciones, usuario, ruta_pdf)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id_pedido,
        pedido.pedido,
        pedido.nombre_proyecto,
        tipo_material,
        entregas.length,
        entregas.reduce((acc, e) => acc + e.cantidad_entrega, 0),
        observaciones,
        usuario,
        ruta_pdf
      ]
    );

    const id_entrega = historialResult.insertId;

    // Actualizar cantidades en remisiones_control usando UPSERT
    for (const entrega of entregas) {
      if (entrega.cantidad_entrega > 0) {
        // Primero verificar/crear el registro en remisiones_control
        await queryAsync(`
          INSERT INTO remisiones_control (id_detalle, tipo_material, cantidad_pedida, cantidad_recibida)
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            cantidad_recibida = cantidad_recibida + VALUES(cantidad_recibida)
        `, [entrega.id_detalle, tipo_material, entrega.cantidad_pedida, entrega.cantidad_entrega]);

        // Registrar detalle de la entrega
        await queryAsync(`
          INSERT INTO remisiones_historial_entregas_detalle (id_entrega, id_detalle, cantidad_entregada, descripcion)
          VALUES (?, ?, ?, ?)
        `, [id_entrega, entrega.id_detalle, entrega.cantidad_entrega, entrega.descripcion || '']);
      }
    }

    res.json({
      success: true,
      message: "Entrega registrada exitosamente",
      id_entrega
    });
  } catch (err) {
    console.error("Error registrando entrega:", err);
    if (pdfFile) {
      try { fs.unlinkSync(pdfFile.path); } catch { /* ignorar */ }
    }
    res.status(500).json({ success: false, message: "Error al registrar entrega" });
  }
});

// Obtener historial de entregas
app.get("/remisiones/historial-entregas", authenticateToken, async (req, res) => {
  try {
    const { id_proyecto, limit = 100 } = req.query;

    let query = `
      SELECT
        id_entrega,
        fecha_entrega,
        numero_pedido,
        nombre_proyecto,
        tipo_material,
        total_items,
        total_piezas,
        observaciones,
        usuario,
        ruta_pdf
      FROM remisiones_historial_entregas
    `;
    const params = [];

    if (id_proyecto) {
      query += ` WHERE id_pedido IN (SELECT id FROM pedidos WHERE id_proyecto = ?)`;
      params.push(id_proyecto);
    }

    query += ` ORDER BY fecha_entrega DESC LIMIT ?`;
    params.push(parseInt(limit, 10));

    const rows = await queryAsync(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("Error obteniendo historial de entregas:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
});

// Obtener detalles de una entrega específica
app.get("/remisiones/historial-entregas/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [entrega] = await queryAsync(
      `SELECT * FROM remisiones_historial_entregas WHERE id_entrega = ?`,
      [id]
    );

    if (!entrega) {
      return res.status(404).json({ success: false, message: "Entrega no encontrada" });
    }

    const detalles = await queryAsync(
      `SELECT * FROM remisiones_historial_entregas_detalle WHERE id_entrega = ?`,
      [id]
    );

    res.json({ success: true, data: { ...entrega, detalles } });
  } catch (err) {
    console.error("Error obteniendo detalle de entrega:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
});

// ---------------------------------------------------------------------------
// Rutas de Contabilidad (Facturas)
// ---------------------------------------------------------------------------
app.get("/facturas", authenticateToken, FacturasCtrl.listar);

app.post("/facturas", authenticateToken, (req, res, next) => {
  uploadFactura(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    next();
  });
}, FacturasCtrl.crear);

app.put("/facturas/:id", authenticateToken, FacturasCtrl.actualizar);

app.delete("/facturas/:id", authenticateToken, FacturasCtrl.eliminar);

// Gestión de usuarios (administrador y visor)
app.get("/usuarios", authenticateToken, requireRole("administrador", "visor"), async (req, res) => {
  try {
    const rows = await new Promise((resolve, reject) => {
      db.query("SELECT id_usuario, nombre_usuario, tipo_usuario FROM usuarios ORDER BY nombre_usuario", (err, r) => {
        if (err) reject(err); else resolve(r);
      });
    });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Error al obtener usuarios" });
  }
});

app.post("/usuarios", authenticateToken, requireRole("administrador"), async (req, res) => {
  try {
    const { nombre_usuario, contrasena, tipo_usuario } = req.body || {};
    if (!nombre_usuario || !contrasena || !tipo_usuario) {
      return res.status(400).json({ success: false, message: "Faltan datos" });
    }
    const tiposValidos = ["administrador", "contador", "visor"];
    if (!tiposValidos.includes(tipo_usuario)) {
      return res.status(400).json({ success: false, message: "Tipo de usuario inválido" });
    }
    const hash = crypto.createHash("sha256").update(contrasena).digest("hex");
    await new Promise((resolve, reject) => {
      db.query(
        "INSERT INTO usuarios (nombre_usuario, contrasena, tipo_usuario) VALUES (?, ?, ?)",
        [nombre_usuario.trim(), hash, tipo_usuario],
        (err, result) => { if (err) reject(err); else resolve(result); }
      );
    });
    return res.status(201).json({ success: true, message: "Usuario creado correctamente" });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ success: false, message: "El nombre de usuario ya existe" });
    }
    return res.status(500).json({ success: false, message: "Error al crear usuario" });
  }
});

app.listen(PORT, () => {
  console.log(` Servidor corriendo en http://localhost:${PORT}`);
});
