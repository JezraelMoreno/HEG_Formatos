import dotenv from "dotenv";
dotenv.config();

import express from "express";
import mysql from "mysql2";
import crypto from "crypto";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

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

app.listen(PORT, () => {
  console.log(` Servidor corriendo en http://localhost:${PORT}`);
});
