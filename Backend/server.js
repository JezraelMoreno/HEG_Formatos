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

// Proyectos - listar
app.get("/proyectos", authenticateToken, (req, res) => {
  const query =
    "SELECT id_proyecto, nombre, fecha_proyecto FROM proyectos ORDER BY id_proyecto DESC";
  db.query(query, (err, results) => {
    if (err) {
      console.error("Error consultando proyectos:", err);
      return res
        .status(500)
        .json({ success: false, message: "Error interno del servidor" });
    }
    res.json({ success: true, data: results });
  });
});

// Proyectos - crear
app.post("/proyectos", authenticateToken, (req, res) => {
  const { nombre, fecha_proyecto } = req.body;
  if (!nombre || !fecha_proyecto) {
    return res
      .status(400)
      .json({ success: false, message: "Faltan datos" });
  }

  const query =
    "INSERT INTO proyectos (nombre, fecha_proyecto) VALUES (?, ?)";
  db.query(query, [nombre, fecha_proyecto], (err, result) => {
    if (err) {
      console.error("Error creando proyecto:", err);
      return res
        .status(500)
        .json({ success: false, message: "Error interno del servidor" });
    }
    res.status(201).json({
      success: true,
      data: { id_proyecto: result.insertId, nombre, fecha_proyecto },
    });
  });
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
    db.query("DELETE FROM cobranza WHERE id_proyecto = ?", [id], (errCobranza) => {
      if (errCobranza) {
        console.error("Error eliminando cobranza del proyecto:", errCobranza);
        return res.status(500).json({ success: false, message: "No se pudo limpiar cobranza del proyecto" });
      }
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
});

// Proyectos - obtener uno por id
app.get("/proyectos/:id", authenticateToken, (req, res) => {
  const { id } = req.params;
  const query =
    "SELECT id_proyecto, nombre, fecha_proyecto FROM proyectos WHERE id_proyecto = ?";
  db.query(query, [id], (err, results) => {
    if (err) {
      console.error("Error consultando proyecto:", err);
      return res
        .status(500)
        .json({ success: false, message: "Error interno del servidor" });
    }
    if (!results || results.length === 0) {
      return res.status(404).json({ success: false, message: "No encontrado" });
    }
    res.json({ success: true, data: results[0] });
  });
});

// Pedidos - listar por proyecto
app.get("/proyectos/:id/pedidos", authenticateToken, requireRole("administrador"), (req, res) => {
  const { id } = req.params;
  const { familia } = req.query;
  let query =
    "SELECT id, id_proyecto, nombre_proyecto, pedido, clan, familia, proveedor, DATE_FORMAT(fecha_aprobacion, '%Y-%m-%d') AS fecha_aprobacion, concepto, situaciones_especiales, importe_total AS importe FROM pedidos WHERE id_proyecto = ?";
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
  db.query(query, params, (err, results) => {
    if (err) {
      console.error("Error consultando pedidos:", err);
      return res
        .status(500)
        .json({ success: false, message: "Error interno del servidor" });
    }
    res.json({ success: true, data: results || [] });
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

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function decimalOrNull(value) {
  return value === null || value === undefined ? null : Number(value);
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
  const m2Pedido = toFiniteNumber(detalle?.m2_pedido);
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

async function insertDetallesSegunFamilia(pedidoId, familia, detallesRaw) {
  if (!Array.isArray(detallesRaw) || detallesRaw.length === 0) return;
  const familiaVal = normalizeTextValue(familia).toUpperCase();
  if (familiaVal === "CR") {
    await insertCristalDetallesRows(pedidoId, detallesRaw);
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
      "INSERT INTO pedidos (id_proyecto, nombre_proyecto, pedido, clan, familia, proveedor, fecha_aprobacion, concepto, situaciones_especiales, importe_total, nombre_usuario) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

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

      let replacedExisting = false;
      try {
        const existingRows = await queryAsync(
          "SELECT id FROM pedidos WHERE id_proyecto = ? AND pedido = ? LIMIT 1",
          [proyectoId, pedidoNombre]
        );
        if (Array.isArray(existingRows) && existingRows.length) {
          const existingId = existingRows[0].id;
          await queryAsync("DELETE FROM pedidos WHERE id = ? AND id_proyecto = ?", [existingId, proyectoId]);
          replacedExisting = true;
        }
      } catch (lookupErr) {
        console.error("Error verificando pedido existente:", lookupErr);
        detailsLog.push({ index: idx + 1, pedido: pedidoNombre, ok: false, replaced: false, error: "No se pudo validar duplicados" });
        continue;
      }

      const importePedido = Number(p.importe);
      const importeValue = Number.isFinite(importePedido) ? importePedido : 0;
      const values = [
        proyectoId,
        normalizeTextValue(p.nombre_proyecto),
        pedidoNombre,
        normalizeTextValue(p.clan),
        normalizeTextValue(p.familia),
        normalizeTextValue(p.proveedor),
        fechaISO,
        normalizeTextValue(p.concepto),
        normalizeTextValue(p.situaciones_especiales) || null,
        importeValue,
        username,
      ];
      try {
        const result = await queryAsync(sql, values);
        const pedidoId = result.insertId;
        await insertDetallesSegunFamilia(pedidoId, p.familia, p.detalles);
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

// Cobranza - listar por proyecto (ambos roles pueden ver)
app.get("/proyectos/:id/cobranza", authenticateToken, (req, res) => {
  const { id } = req.params;
  const q = `SELECT id_cobranza,
                    id_proyecto,
                    contratado_a_fecha,
                    mano_obra,
                    cobrado_total,
                    por_cobrar_total,
                    fondo_garantia,
                    liquido_por_cobrar,
                    numero,
                    DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha,
                    numero_factura,
                    concepto,
                    importe_a_cobrar,
                    importe_cobrado,
                    saldo_por_cobrar,
                    DATE_FORMAT(fecha_pago, '%Y-%m-%d') AS fecha_pago,
                    periodo,
                    DATE_FORMAT(fecha_reporte, '%Y-%m-%d') AS fecha_reporte
             FROM cobranza
             WHERE id_proyecto = ?
             ORDER BY id_cobranza DESC`;
  db.query(q, [id], (err, rows) => {
    if (err) {
      console.error("Error consultando cobranza:", err);
      return res.status(500).json({ success: false, message: "Error interno del servidor" });
    }
    res.json({ success: true, data: rows || [] });
  });
});

// Cobranza - agregar (solo contador puede agregar)
app.post("/proyectos/:id/cobranza", authenticateToken, requireRole("contador"), (req, res) => {
  const { id } = req.params;
  const {
    contratado_a_fecha,
    mano_obra,
    cobrado_total,
    por_cobrar_total,
    fondo_garantia,
    liquido_por_cobrar,
    numero,
    fecha,
    numero_factura,
    concepto,
    importe_a_cobrar,
    importe_cobrado,
    saldo_por_cobrar,
    fecha_pago,
    periodo,
    fecha_reporte,
  } = req.body || {};

  const tieneNumero = numero !== undefined && numero !== null && String(numero).trim() !== "";
  const numeroVal = tieneNumero ? Number(numero) : NaN;
  if (!tieneNumero || !concepto || Number.isNaN(numeroVal)) {
    return res.status(400).json({ success: false, message: "Faltan datos de numero o concepto" });
  }
  const repISO = parseDateToISO(fecha_reporte) || new Date().toISOString().slice(0, 10);
  const fechaDetalleISO = parseDateToISO(fecha);
  const fechaPagoISO = parseDateToISO(fecha_pago);

  const q = `INSERT INTO cobranza
               (id_proyecto, contratado_a_fecha, mano_obra, cobrado_total, por_cobrar_total,
                fondo_garantia, liquido_por_cobrar, numero, fecha, numero_factura, concepto,
                importe_a_cobrar, importe_cobrado, saldo_por_cobrar, fecha_pago, periodo, fecha_reporte)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
  const vals = [
    Number(id),
    Number(contratado_a_fecha || 0),
    Number(mano_obra || 0),
    Number(cobrado_total || 0),
    Number(por_cobrar_total || 0),
    Number(fondo_garantia || 0),
    Number(liquido_por_cobrar || 0),
    numeroVal,
    fechaDetalleISO || null,
    numero_factura ? String(numero_factura) : null,
    String(concepto),
    Number(importe_a_cobrar || 0),
    Number(importe_cobrado || 0),
    Number(saldo_por_cobrar || 0),
    fechaPagoISO || null,
    periodo ? String(periodo) : null,
    repISO,
  ];
  db.query(q, vals, (err, result) => {
    if (err) {
      console.error("Error insertando cobranza:", err);
      return res.status(500).json({ success: false, message: "Error interno del servidor" });
    }
    res.status(201).json({ success: true, id_cobranza: result.insertId });
  });
});

// Cobranza - exportar mas reciente por proyecto (ambos roles)
app.get("/cobranza/export", authenticateToken, (req, res) => {
  const q = `
    SELECT c.id_proyecto,
           p.nombre AS proyecto,
           c.numero,
           c.numero_factura,
           c.concepto,
           c.periodo,
           DATE_FORMAT(c.fecha, '%Y-%m-%d') AS fecha,
           DATE_FORMAT(c.fecha_pago, '%Y-%m-%d') AS fecha_pago,
           DATE_FORMAT(c.fecha_reporte, '%Y-%m-%d') AS fecha_reporte,
           c.contratado_a_fecha,
           c.mano_obra,
           c.cobrado_total,
           c.por_cobrar_total,
           c.fondo_garantia,
           c.liquido_por_cobrar,
           c.importe_a_cobrar,
           c.importe_cobrado,
           c.saldo_por_cobrar
    FROM cobranza c
    JOIN (
      SELECT id_proyecto, MAX(fecha_reporte) AS max_rep
      FROM cobranza
      GROUP BY id_proyecto
    ) m ON m.id_proyecto = c.id_proyecto AND m.max_rep = c.fecha_reporte
    LEFT JOIN proyectos p ON p.id_proyecto = c.id_proyecto
    ORDER BY c.id_proyecto ASC, c.numero ASC`;

  db.query(q, async (err, rows) => {
    if (err) {
      console.error("Error consultando cobranza total:", err);
      return res.status(500).json({ success: false, message: "Error interno del servidor" });
    }
    try {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Cobranza");

      // Logo si existe
      try {
        const logoPath = path.join(__dirname, "assets", "heg_logo.jpg");
        const imgId = wb.addImage({ filename: logoPath, extension: "jpeg" });
        ws.addImage(imgId, { tl: { col: 0, row: 0 }, ext: { width: 220, height: 80 } });
      } catch (imgErr) {
        console.warn("No se pudo cargar el logo:", imgErr?.message || imgErr);
      }

      const now = new Date();
      const pad2 = (n) => String(n).padStart(2, "0");
      const fechaGeneracion = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
      const titleRow = ws.getRow(5);
      titleRow.getCell(1).value = `Cobranza mas reciente por proyecto - ${fechaGeneracion}`;
      titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: "FF333333" } };

      // Columnas
      const columns = [
        { key: "id_proyecto", width: 12 },
        { key: "proyecto", width: 28 },
        { key: "numero", width: 10 },
        { key: "numero_factura", width: 18 },
        { key: "concepto", width: 22 },
        { key: "periodo", width: 24 },
        { key: "fecha", width: 16 },
        { key: "fecha_pago", width: 16 },
        { key: "fecha_reporte", width: 16 },
        { key: "contratado_a_fecha", width: 18 },
        { key: "mano_obra", width: 16 },
        { key: "cobrado_total", width: 16 },
        { key: "por_cobrar_total", width: 16 },
        { key: "fondo_garantia", width: 16 },
        { key: "liquido_por_cobrar", width: 18 },
        { key: "importe_a_cobrar", width: 16 },
        { key: "importe_cobrado", width: 16 },
        { key: "saldo_por_cobrar", width: 16 },
      ];
      ws.columns = columns;
      ws.mergeCells(5, 1, 5, columns.length);

      const headerRowIndex = 7;
      const headerRow = ws.getRow(headerRowIndex);
      const headers = [
        "ID Proyecto", "Proyecto", "N°", "No. Factura", "Concepto", "Periodo",
        "Fecha Factura/Estimacion", "Fecha Pago", "Fecha Reporte",
        "Contratado a la Fecha", "Mano de Obra", "Cobrado Total", "Por Cobrar Total",
        "Fondo Garantia", "Liquido por Cobrar", "Importe a Cobrar", "Importe Cobrado",
        "Saldo por Cobrar",
      ];
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
      (rows || []).forEach((r, i) => {
        const row = ws.getRow(startDataRow + i);
        const numCols = [
          "contratado_a_fecha", "mano_obra", "cobrado_total", "por_cobrar_total",
          "fondo_garantia", "liquido_por_cobrar", "importe_a_cobrar",
          "importe_cobrado", "saldo_por_cobrar",
        ];
        const vals = {
          id_proyecto: r.id_proyecto,
          proyecto: r.proyecto,
          numero: r.numero,
          numero_factura: r.numero_factura || "",
          concepto: r.concepto || "",
          periodo: r.periodo || "",
          fecha: r.fecha || "",
          fecha_pago: r.fecha_pago || "",
          fecha_reporte: r.fecha_reporte || "",
          contratado_a_fecha: Number(r.contratado_a_fecha || 0),
          mano_obra: Number(r.mano_obra || 0),
          cobrado_total: Number(r.cobrado_total || 0),
          por_cobrar_total: Number(r.por_cobrar_total || 0),
          fondo_garantia: Number(r.fondo_garantia || 0),
          liquido_por_cobrar: Number(r.liquido_por_cobrar || 0),
          importe_a_cobrar: Number(r.importe_a_cobrar || 0),
          importe_cobrado: Number(r.importe_cobrado || 0),
          saldo_por_cobrar: Number(r.saldo_por_cobrar || 0),
        };
        ws.columns.forEach((c, idx) => {
          const key = c.key;
          row.getCell(idx + 1).value = vals[key];
          if (numCols.includes(String(key))) {
            row.getCell(idx + 1).numFmt = "#,##0.00";
            row.getCell(idx + 1).alignment = { horizontal: "right" };
          }
        });
      });
      ws.views = [{ state: "frozen", ySplit: headerRowIndex }];

      const filename = `cobranza_total_${fechaGeneracion}.xlsx`;
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
      await wb.xlsx.write(res);
      res.end();
    } catch (err2) {
      console.error("Error generando XLSX cobranza:", err2);
      res.status(500).json({ success: false, message: "Error generando archivo" });
    }
  });
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

app.listen(PORT, () => {
  console.log(` Servidor corriendo en http://localhost:${PORT}`);
});
