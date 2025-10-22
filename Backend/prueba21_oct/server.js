const express = require("express");
const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");
const mysql = require("mysql2");

const app = express();
const port = 3000;

// Configuración de multer (para subir archivos)
const upload = multer({ dest: "uploads/" });

// Conexión a MySQL
const db = mysql.createConnection({
  host: "localhost",
  user: "EderJezrael", // cámbialo si tu usuario es distinto
  password: "Kioriu2101.!", // agrega tu contraseña si aplica
  database: "proyectosdb",
});

db.connect((err) => {
  if (err) {
    console.error("Error al conectar con MySQL:", err);
    return;
  }
  console.log("Conectado a la base de datos correctamente");
});

app.use(express.static(__dirname));
app.use(express.json());

// Procesar archivos CSV 
app.post("/upload", upload.array("files"), async (req, res) => {
  try {
    for (const file of req.files) {
      const results = [];

      await new Promise((resolve, reject) => {
        fs.createReadStream(file.path)
          .pipe(csv({ separator: "," }))
          .on("data", (data) => results.push(data))
          .on("end", () => {
            const sql = `
              INSERT INTO proyectos (
                proyecto, proveedor, pedido, familia, num_perfil, fecha_aprobacion,
                descripcion, partida, dibujo, medida_tramo, unidad, peso_kg_ml,
                perim_m2_ml, acabado, total_tramos, ml, kg, m2, importe
              ) VALUES ?
            `;

            const values = results.map((r) => [
              r["PROYECTO"] || null,
              r["PROVEEDOR"] || null,
              r["PEDIDO"] || null,
              r["FAMILIA"] || null,
              r["N° PERFIL"] || null,
              r["FECHA DE APROBACION"]
                ? new Date(r["FECHA DE APROBACION"].split("-").reverse().join("-"))
                : null,
              r["DESCRIPCION"] || null,
              r["PARTIDA"] || null,
              r["DIBUJO"] || null,
              r["MEDIDA (TRAMO)"] || null,
              r["UNIDAD"] || null,
              parseFloat(r["PESO (KG/ML)"]) || 0,
              parseFloat(r["PERÍM (M2/ML)"]) || 0,
              r["ACABADO"] || null,
              parseInt(r["TOTAL TRAMOS"]) || 0,
              parseFloat(r["M.L."]) || 0,
              parseFloat(r["KG"]) || 0,
              parseFloat(r["M2"]) || 0,
              parseFloat(r["IMPORTE"]) || 0,
            ]);

            db.query(sql, [values], (err) => {
              fs.unlinkSync(file.path); 
              if (err) return reject(err);
              resolve();
            });
          })
          .on("error", reject);
      });
    }

    console.log("Todos los archivos CSV se procesaron correctamente");
    res.redirect("/proyectos.html");
  } catch (err) {
    console.error("Error al procesar los archivos:", err);
    res.status(500).send("Error al procesar los archivos CSV.");
  }
});

// Ruta para obtener los registros de la base de datos
app.get("/registros", (req, res) => {
  const query = "SELECT * FROM proyectos";

  db.query(query, (err, results) => {
    if (err) {
      console.error("Error al obtener registros:", err);
      return res.status(500).json({ error: "Error al obtener registros de la base de datos" });
    }

    res.json(results); // Enviar los datos como JSON al frontend
  });
});

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
