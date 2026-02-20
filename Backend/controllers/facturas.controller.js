import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as FacturaModel from "../models/factura.model.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, "..", "uploads");

function removeFile(relPath) {
  if (!relPath) return;
  try {
    const full = path.join(UPLOADS_DIR, relPath);
    if (fs.existsSync(full)) fs.unlinkSync(full);
  } catch {
    // Ignorar errores de archivo ya eliminado
  }
}

// GET /facturas?id_proyecto=X
export async function listar(req, res) {
  try {
    const { id_proyecto } = req.query;
    if (!id_proyecto) {
      return res.status(400).json({ success: false, message: "id_proyecto requerido" });
    }
    const rows = await FacturaModel.findByProyecto(id_proyecto);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("Error listando facturas:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}

// POST /facturas  (multipart/form-data)
export async function crear(req, res) {
  const pdfFile = req.files?.["pdf"]?.[0];
  const xmlFile = req.files?.["xml"]?.[0];

  if (!pdfFile) {
    if (xmlFile) removeFile(`facturas/${xmlFile.filename}`);
    return res.status(400).json({ success: false, message: "El PDF es requerido" });
  }

  try {
    const { id_proyecto, proveedor, concepto, categoria, total, fecha_factura, estatus, fecha_pago, metodo_pago } = req.body;

    if (!id_proyecto || !proveedor || !concepto || !categoria || !total || !fecha_factura) {
      removeFile(`facturas/${pdfFile.filename}`);
      if (xmlFile) removeFile(`facturas/${xmlFile.filename}`);
      return res.status(400).json({ success: false, message: "Faltan campos requeridos" });
    }

    const result = await FacturaModel.insert({
      id_proyecto,
      proveedor,
      concepto,
      categoria,
      total: parseFloat(total),
      fecha_factura,
      estatus: estatus || "pendiente",
      fecha_pago: fecha_pago || null,
      metodo_pago: metodo_pago || null,
      ruta_pdf: `facturas/${pdfFile.filename}`,
      ruta_xml: xmlFile ? `facturas/${xmlFile.filename}` : null,
      nombre_usuario: req.user?.username || null,
    });

    res.status(201).json({ success: true, id_factura: result.insertId });
  } catch (err) {
    console.error("Error creando factura:", err);
    removeFile(`facturas/${pdfFile.filename}`);
    if (xmlFile) removeFile(`facturas/${xmlFile.filename}`);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}

// PUT /facturas/:id
export async function actualizar(req, res) {
  try {
    const { id } = req.params;
    const { estatus, fecha_pago, metodo_pago } = req.body;

    if (!estatus) {
      return res.status(400).json({ success: false, message: "El campo estatus es requerido" });
    }

    await FacturaModel.update(id, { estatus, fecha_pago, metodo_pago });
    res.json({ success: true, message: "Factura actualizada" });
  } catch (err) {
    console.error("Error actualizando factura:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}

// DELETE /facturas/:id
export async function eliminar(req, res) {
  try {
    const { id } = req.params;
    const factura = await FacturaModel.findById(id);
    if (!factura) {
      return res.status(404).json({ success: false, message: "Factura no encontrada" });
    }

    // Eliminar archivos del disco
    removeFile(factura.ruta_pdf);
    removeFile(factura.ruta_xml);

    await FacturaModel.deleteById(id);
    res.json({ success: true, message: "Factura eliminada" });
  } catch (err) {
    console.error("Error eliminando factura:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}
