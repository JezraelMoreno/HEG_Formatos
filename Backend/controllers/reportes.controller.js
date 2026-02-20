import * as ReporteModel from "../models/reporte.model.js";
import ExcelJS from "exceljs";
import path from "path";
import { ASSETS_DIR } from "../helpers/excel.js";
import { pad2 } from "../helpers/utils.js";

// ─── Reporte Cristal ──────────────────────────────────────────────────
export async function reporteCristal(req, res) {
  try {
    const proyectoId = Number(req.params.id);
    if (!Number.isInteger(proyectoId) || proyectoId <= 0) {
      return res.status(400).json({ success: false, message: "Proyecto inválido" });
    }

    // Obtener filtros disponibles
    const filtrosRows = await ReporteModel.getFiltrosCristal(proyectoId);
    const filtros_disponibles = {
      proveedores: [...new Set((filtrosRows || []).map((r) => r.proveedor).filter(Boolean))].sort(),
      clanes: [...new Set((filtrosRows || []).map((r) => r.clan).filter(Boolean))].sort(),
      conceptos: [...new Set((filtrosRows || []).map((r) => r.concepto).filter(Boolean))].sort(),
      pedidos: [...new Set((filtrosRows || []).map((r) => r.pedido).filter(Boolean))].sort((a, b) => {
        const na = parseInt(a) || 0;
        const nb = parseInt(b) || 0;
        return na - nb;
      }),
    };

    const rows = await ReporteModel.getReporteCristal(proyectoId, req.query);
    const data = (rows || []).map((r) => ({
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
}

// ─── Reporte Aluminio ─────────────────────────────────────────────────
export async function reporteAluminio(req, res) {
  try {
    const proyectoId = Number(req.params.id);
    if (!Number.isInteger(proyectoId) || proyectoId <= 0) {
      return res.status(400).json({ success: false, message: "Proyecto inválido" });
    }

    // Obtener filtros disponibles (incluye acabados)
    const filtrosRows = await ReporteModel.getFiltrosAluminio(proyectoId);
    const filtros_disponibles = {
      proveedores: [...new Set((filtrosRows || []).map((r) => r.proveedor).filter(Boolean))].sort(),
      clanes: [...new Set((filtrosRows || []).map((r) => r.clan).filter(Boolean))].sort(),
      conceptos: [...new Set((filtrosRows || []).map((r) => r.concepto).filter(Boolean))].sort(),
      pedidos: [...new Set((filtrosRows || []).map((r) => r.pedido).filter(Boolean))].sort((a, b) => {
        const na = parseInt(a) || 0;
        const nb = parseInt(b) || 0;
        return na - nb;
      }),
      acabados: [...new Set((filtrosRows || []).map((r) => r.acabado).filter(Boolean))].sort(),
    };

    const rows = await ReporteModel.getReporteAluminio(proyectoId, req.query);
    const data = (rows || []).map((r) => ({
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
}

// ─── Exportar Reporte Cristal a Excel ─────────────────────────────────
export async function exportCristal(req, res) {
  try {
    const proyectoId = Number(req.params.id);
    if (!Number.isInteger(proyectoId) || proyectoId <= 0) {
      return res.status(400).json({ success: false, message: "Proyecto inválido" });
    }

    const nombreProyecto = await ReporteModel.getNombreProyecto(proyectoId);
    const rows = await ReporteModel.getExportCristal(proyectoId, req.query);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Reporte Cristal");

    try {
      const logoPath = path.join(ASSETS_DIR, "heg_logo.jpg");
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
    const headers = [
      "NO.", "PEDIDO", "PROVEEDOR", "CLAN", "CONCEPTO", "FECHA",
      "CLAVE/MODELO", "DESCRIPCION", "ANCHO", "LARGO", "M2 CORTE",
      "PIEZAS", "M2 PEDIDO", "P. UNITARIO", "IMPORTE",
    ];
    headers.forEach((text, idx) => {
      headerRow.getCell(idx + 1).value = text;
    });
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
    let totalPiezas = 0,
      totalM2Pedido = 0,
      totalImporte = 0;
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
      r.getCell(9).value = ancho;
      if (ancho != null) r.getCell(9).numFmt = "0.000";
      r.getCell(10).value = largo;
      if (largo != null) r.getCell(10).numFmt = "0.000";
      r.getCell(11).value = m2Corte;
      if (m2Corte != null) r.getCell(11).numFmt = "0.000";
      r.getCell(12).value = piezas;
      r.getCell(13).value = m2Pedido;
      if (m2Pedido != null) r.getCell(13).numFmt = "0.000";
      r.getCell(14).value = pu;
      r.getCell(14).numFmt = "#,##0.00";
      r.getCell(15).value = imp;
      r.getCell(15).numFmt = "#,##0.00";
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
}

// ─── Exportar Reporte Aluminio a Excel ────────────────────────────────
export async function exportAluminio(req, res) {
  try {
    const proyectoId = Number(req.params.id);
    if (!Number.isInteger(proyectoId) || proyectoId <= 0) {
      return res.status(400).json({ success: false, message: "Proyecto inválido" });
    }

    const nombreProyecto = await ReporteModel.getNombreProyecto(proyectoId);
    const rows = await ReporteModel.getExportAluminio(proyectoId, req.query);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Reporte Aluminio");

    try {
      const logoPath = path.join(ASSETS_DIR, "heg_logo.jpg");
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
    const headers = [
      "NO.", "PEDIDO", "PROVEEDOR", "CLAN", "CONCEPTO", "FECHA",
      "DESCRIPCION", "N° PERFIL", "MEDIDA(TRAMO)", "UNIDAD",
      "PESO(KG/ML)", "PERIM(M2/ML)", "ACABADO", "TOTAL TRAMOS",
      "ML", "KG", "M2", "IMPORTE",
    ];
    headers.forEach((text, idx) => {
      headerRow.getCell(idx + 1).value = text;
    });
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
    let totalTramos = 0,
      totalMl = 0,
      totalKg = 0,
      totalM2 = 0,
      totalImporte = 0;
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
      r.getCell(9).value = medTramo;
      if (medTramo != null) r.getCell(9).numFmt = "0.000";
      r.getCell(10).value = p.unidad || "";
      const pesoKg = p.peso_kg_ml != null ? Number(p.peso_kg_ml) : null;
      r.getCell(11).value = pesoKg;
      if (pesoKg != null) r.getCell(11).numFmt = "0.000";
      const perim = p.perimetro_m2_ml != null ? Number(p.perimetro_m2_ml) : null;
      r.getCell(12).value = perim;
      if (perim != null) r.getCell(12).numFmt = "0.000";
      r.getCell(13).value = p.acabado || "";
      const tramos = p.total_tramos != null ? Number(p.total_tramos) : null;
      r.getCell(14).value = tramos;
      const ml = p.ml != null ? Number(p.ml) : null;
      r.getCell(15).value = ml;
      if (ml != null) r.getCell(15).numFmt = "0.000";
      const kg = p.kg != null ? Number(p.kg) : null;
      r.getCell(16).value = kg;
      if (kg != null) r.getCell(16).numFmt = "0.000";
      const m2 = p.m2 != null ? Number(p.m2) : null;
      r.getCell(17).value = m2;
      if (m2 != null) r.getCell(17).numFmt = "0.000";
      const imp = Number(p.importe || 0);
      r.getCell(18).value = imp;
      r.getCell(18).numFmt = "#,##0.00";
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
    tRow.getCell(14).value = totalTramos;
    tRow.getCell(14).font = { bold: true };
    tRow.getCell(15).value = Number(totalMl.toFixed(3));
    tRow.getCell(15).numFmt = "0.000";
    tRow.getCell(15).font = { bold: true };
    tRow.getCell(16).value = Number(totalKg.toFixed(3));
    tRow.getCell(16).numFmt = "0.000";
    tRow.getCell(16).font = { bold: true };
    tRow.getCell(17).value = Number(totalM2.toFixed(3));
    tRow.getCell(17).numFmt = "0.000";
    tRow.getCell(17).font = { bold: true };
    tRow.getCell(18).value = Number(totalImporte.toFixed(2));
    tRow.getCell(18).numFmt = "#,##0.00";
    tRow.getCell(18).font = { bold: true };
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
}
