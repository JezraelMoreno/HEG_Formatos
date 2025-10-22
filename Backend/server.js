import express from "express";
import mysql from "mysql2";
import crypto from "crypto";
import cors from "cors";
import bodyParser from "body-parser";

const app = express();
const PORT = 3000;

// Middlewares
app.use(cors());
app.use(bodyParser.json());

// Conexión a MySQL
const db = mysql.createConnection({
  host: "localhost",
  user: "EderJezrael",      // cambia si usas otro usuario
  password: "Kioriu2101.!",      // pon tu contraseña
  database: "HEG_Sistema"
});

db.connect(err => {
  if (err) throw err;
  console.log("Conectado a la base de datos MySQL");
});

// Ruta de login
app.post("/login", (req, res) => {
  const { nombre_usuario, contraseña } = req.body;

  if (!nombre_usuario || !contraseña) {
    return res.status(400).json({ message: "Faltan datos" });
  }

  // Hasheamos la contraseña recibida
  const hash = crypto.createHash("sha256").update(contraseña).digest("hex");

  const query = "SELECT * FROM usuarios WHERE nombre_usuario = ? AND contraseña = ?";
  console.log("Usuario:", nombre_usuario);
  console.log("Contraseña (hash):", hash);
  db.query(query, [nombre_usuario, hash], (err, results) => {
  if (err) throw err;
  console.log("Resultados de MySQL:", results);

  if (results.length > 0) {
    res.json({ success: true, message: "Login exitoso ✅" });
  } else {
    res.status(401).json({ success: false, message: "Credenciales incorrectas ❌" });
  }
});


});

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
