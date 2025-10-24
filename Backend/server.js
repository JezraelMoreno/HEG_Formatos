import dotenv from "dotenv";
dotenv.config();

import express from "express";
import mysql from "mysql2";
import crypto from "crypto";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import ExcelJS from "exceljs";

const app = express();
const PORT = process.env.PORT || 3000;

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
      return res.json({ success: true, message: "Login exitoso" });
    }
    return res
      .status(401)
      .json({ success: false, message: "Credenciales incorrectas" });
  });
});

// Proyectos - listar
app.get("/proyectos", (req, res) => {
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
app.post("/proyectos", (req, res) => {
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

// Proyectos - obtener uno por id
app.get("/proyectos/:id", (req, res) => {
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
app.get("/proyectos/:id/pedidos", (req, res) => {
  const { id } = req.params;
  const { familia } = req.query;
  let query =
    "SELECT id, id_proyecto, nombre_proyecto, pedido, clan, familia, proveedor, DATE_FORMAT(fecha_aprobacion, '%Y-%m-%d') AS fecha_aprobacion, concepto, situaciones_especiales, importe FROM pedidos WHERE id_proyecto = ?";
  const params = [id];
  if (familia && String(familia).trim() !== "") {
    query += " AND familia = ?";
    params.push(String(familia));
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
    

// Pedidos - exportar a XLSX con logo y estilos
app.get("/proyectos/:id/pedidos/export", (req, res) => {
  const { id } = req.params;
  const { familia } = req.query;
  const qProyecto = "SELECT nombre FROM proyectos WHERE id_proyecto = ?";
  let qPedidos =
    "SELECT id, id_proyecto, nombre_proyecto, pedido, clan, familia, proveedor, DATE_FORMAT(fecha_aprobacion, '%Y-%m-%d') AS fecha_aprobacion, concepto, situaciones_especiales, importe FROM pedidos WHERE id_proyecto = ?";
  const pedidosParams = [id];
  if (familia && String(familia).trim() !== "") {
    qPedidos += " AND familia = ?";
    pedidosParams.push(String(familia));
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
          { key: "id_proyecto", width: 12 },
          { key: "nombre_proyecto", width: 22 },
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
          "ID Proyecto",
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
        pedidos.forEach((p, i) => {
          const r = ws.getRow(startDataRow + i);
          r.getCell(1).value = p.id;
          r.getCell(2).value = p.id_proyecto;
          r.getCell(3).value = p.nombre_proyecto;
          r.getCell(4).value = p.pedido;
          r.getCell(5).value = p.clan;
          r.getCell(6).value = p.familia;
          r.getCell(7).value = p.proveedor;
          r.getCell(8).value = p.fecha_aprobacion;
          r.getCell(9).value = p.concepto;
          r.getCell(10).value = p.situaciones_especiales || "";
          r.getCell(11).value = Number(p.importe || 0);
          r.getCell(11).numFmt = "#,##0.00";
          r.getCell(11).alignment = { horizontal: "right" };
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

// Pedidos - carga masiva desde CSV (parseado en el frontend)
app.post("/proyectos/:id/pedidos", (req, res) => {
  const { id } = req.params;
  const { pedidos } = req.body || {};

  if (!Array.isArray(pedidos) || pedidos.length === 0) {
    return res
      .status(400)
      .json({ success: false, message: "No hay pedidos a insertar" });
  }

  const sql =
    "INSERT INTO pedidos (id_proyecto, nombre_proyecto, pedido, clan, familia, proveedor, fecha_aprobacion, concepto, situaciones_especiales, importe) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

  const tasks = pedidos.map((p, idx) => {
    const fechaISO = parseDateToISO(p.fecha_aprobacion);
    if (!fechaISO) {
      return Promise.resolve({ ok: false, err: new Error(`Fecha inválida en fila ${idx + 1}`) });
    }
    const values = [
      Number(id),
      p.nombre_proyecto || "",
      p.pedido || "",
      p.clan || "",
      p.familia || "",
      p.proveedor || "",
      fechaISO,
      p.concepto || "",
      p.situaciones_especiales || null,
      Number(p.importe || 0),
    ];
    return new Promise((resolve) => {
      db.query(sql, values, (err) => {
        if (err) {
          console.error("Error insertando pedido:", err);
          return resolve({ ok: false, err });
        }
        resolve({ ok: true });
      });
    });
  });

  Promise.all(tasks)
    .then((results) => {
      const details = results.map((r, i) => ({ index: i + 1, ok: r.ok, error: r.err ? String(r.err.message || r.err) : null }));
      const okCount = results.filter((r) => r.ok).length;
      const failCount = results.length - okCount;
      // Responder 200 siempre para evitar "internal server error" por datos inválidos
      return res.json({
        success: okCount > 0,
        inserted: okCount,
        failed: failCount,
        message: `Pedidos insertados: ${okCount}${failCount ? ", fallidos: " + failCount : ""}`,
        details,
      });
    })
    .catch((e) => {
      console.error(e);
      res.status(500).json({ success: false, message: "Error interno del servidor" });
    });
});

app.listen(PORT, () => {
  console.log(` Servidor corriendo en http://localhost:${PORT}`);
});


