import { Router } from "express";
import PDFDocument from "pdfkit";
import { authenticateToken, requireRole } from "../middleware/auth.js";

// Endpoint de humo temporal (TASKS.md 2.0.3): confirma que pdfkit genera PDFs correctamente
// dentro de este Express + empaquetado Electron antes de construir el PDF real de pedido en
// semana 4 (GET /pedidos/:id/pdf). Se elimina cuando ese endpoint quede listo.
const router = Router();

router.get("/pdf-test", authenticateToken, requireRole("Superadmin"), (req, res) => {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "inline; filename=pdf-test.pdf");

  const doc = new PDFDocument({ size: "A4", margin: 50 });
  doc.pipe(res);

  doc.fontSize(20).text("HEG Formatos — prueba de PDFKit", { align: "center" });
  doc.moveDown();
  doc.fontSize(12).text(`Generado: ${new Date().toISOString()}`);
  doc.text(`Usuario: ${req.user?.username || "desconocido"}`);
  doc.end();
});

export default router;
