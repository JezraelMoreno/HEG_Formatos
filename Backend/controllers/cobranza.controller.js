import * as CobranzaModel from "../models/cobranza.model.js";
import ExcelJS from "exceljs";
import path from "path";
import { ASSETS_DIR } from "../helpers/excel.js";
import { pad2, parseDateToISO } from "../helpers/utils.js";

// ─── GET /cobranza/export ──────────────────────────────────────────────
// Excel export: "COBRANZA TOTAL" (obras en proceso, con indirectos)
export async function exportCobranza(req, res) {
  try {
    const rows = await CobranzaModel.getCobranzaExportData();

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("COBRANZA TOTAL");

    // Logo
    try {
      const logoPath = path.join(ASSETS_DIR, "heg_logo.jpg");
      const imgId = wb.addImage({ filename: logoPath, extension: "jpeg" });
      ws.addImage(imgId, { tl: { col: 0, row: 0 }, ext: { width: 180, height: 60 } });
    } catch (imgErr) {
      console.warn("No se pudo cargar el logo:", imgErr?.message || imgErr);
    }

    // Fecha formateada
    const now = new Date();
    const meses = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
    const fechaTitulo = `${now.getDate()} DE ${meses[now.getMonth()]} DEL ${now.getFullYear()}`;
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
      { col: 16, text: "COBRADO VS APLICADO", width: 20 },
    ];

    const headerRow = ws.getRow(headerRowIndex);
    headers.forEach((h) => {
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
    const totales = {
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
      indirecto_cobrado_vs_aplicado: 0,
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
      [4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16].forEach((col) => {
        dataRow.getCell(col).numFmt = '"$"#,##0.00';
      });

      // Formato porcentaje para factor
      dataRow.getCell(12).numFmt = "0%";

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
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF000000" } };
      cell.border = borderThin;
      cell.alignment = { vertical: "middle", horizontal: col === 2 ? "left" : (col === 1 || col === 3 ? "center" : "right") };
    }

    // Formato moneda en totales
    [4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16].forEach((col) => {
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
}

// ─── GET /cobranza-general/export ──────────────────────────────────────
// Excel export: "Cobranza General" (todos los proyectos)
export async function exportCobranzaGeneral(req, res) {
  try {
    const rows = await CobranzaModel.getCobranzaGeneralExportData();

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Cobranza General");

    // Logo
    try {
      const logoPath = path.join(ASSETS_DIR, "heg_logo.jpg");
      const imgId = wb.addImage({ filename: logoPath, extension: "jpeg" });
      ws.addImage(imgId, { tl: { col: 0, row: 0 }, ext: { width: 220, height: 80 } });
    } catch (imgErr) {
      console.warn("No se pudo cargar el logo:", imgErr?.message || imgErr);
    }

    // Título
    const now = new Date();
    const fechaGeneracion = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;

    ws.getCell("B2").value = "HEG DISEÑO E INSTALACION SA DE CV";
    ws.getCell("B2").font = { bold: true, size: 14 };
    ws.getCell("B3").value = "TABLA DE COBRANZA A CLIENTES";
    ws.getCell("B3").font = { bold: true, size: 12 };
    ws.getCell("B4").value = fechaGeneracion;

    // Encabezados
    const headerRowIndex = 6;
    const headersArr = [
      "N°", "PROYECTO", "CONTROL", "IMPORTE CONTRATADO", "IMPORTE COBRADO",
      "IMPORTE A COBRAR", "FONDO DE GARANTÍA", "LÍQUIDO POR COBRAR",
      "FACTURAS POR COBRAR", "APLICADO", "COBRADO VS APLICADO", "ESTADO",
    ];

    const headerRow = ws.getRow(headerRowIndex);
    headersArr.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
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
    const totalesExport = {
      importe_contratado: 0,
      importe_cobrado: 0,
      importe_a_cobrar: 0,
      fondo_garantia: 0,
      liquido_por_cobrar: 0,
      facturas_por_cobrar: 0,
      aplicado: 0,
      cobrado_vs_aplicado: 0,
    };

    // Estilos reutilizables
    const borderThin = {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
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
      [4, 5, 6, 7, 8, 9, 10, 11].forEach((col) => {
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
    [4, 5, 6, 7, 8, 9, 10, 11].forEach((col) => {
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
}

// ─── GET /cobranza-general ─────────────────────────────────────────────
// JSON: resumen de cobranza de TODOS los proyectos (con indirectos)
export async function getCobranzaGeneral(req, res) {
  try {
    const results = await CobranzaModel.getCobranzaGeneral();

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
      indirectos_cobrado_vs_aplicado: 0,
    };

    results.forEach((row) => {
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
      proyectos_en_rojo: results.filter((r) => parseFloat(r.cobrado_vs_aplicado) < 0).length,
      proyectos_indirectos_rojo: results.filter((r) => r.indirectos_cobrado_vs_aplicado < 0).length,
    });
  } catch (err) {
    console.error("Error consultando cobranza general:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}

// ─── GET /proyectos/:id/cobranza-resumen ───────────────────────────────
export async function getCobranzaResumen(req, res) {
  try {
    const proyectoId = Number(req.params.id);
    if (!Number.isInteger(proyectoId) || proyectoId <= 0) {
      return res.status(400).json({ success: false, message: "Proyecto inválido" });
    }

    const results = await CobranzaModel.getCobranzaResumen(proyectoId);

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
}

// ─── PUT /proyectos/:id/cobranza-resumen ───────────────────────────────
export async function updateCobranzaResumen(req, res) {
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

    await CobranzaModel.updateCobranzaResumen(proyectoId, {
      codigo_control,
      fondo_garantia: fondo_garantia !== undefined ? fondoGarantiaVal : null,
      factor_indirectos: factor_indirectos !== undefined ? factorIndirectosVal : null,
      indirectos_aplicados: indirectos_aplicados !== undefined ? indirectosAplicadosVal : null,
      username,
    });

    res.json({ success: true, message: "Cobranza actualizada correctamente" });
  } catch (err) {
    console.error("Error actualizando cobranza del proyecto:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}

// ─── GET /proyectos/:id/cobranza-facturas ──────────────────────────────
export async function getFacturas(req, res) {
  try {
    const proyectoId = Number(req.params.id);
    if (!Number.isInteger(proyectoId) || proyectoId <= 0) {
      return res.status(400).json({ success: false, message: "Proyecto inválido" });
    }

    const results = await CobranzaModel.getFacturas(proyectoId);
    res.json({ success: true, data: results || [] });
  } catch (err) {
    console.error("Error consultando facturas de cobranza:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}

// ─── POST /proyectos/:id/cobranza-facturas ─────────────────────────────
export async function createFactura(req, res) {
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
      periodo,
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

    const result = await CobranzaModel.createFactura(proyectoId, {
      numero: numero ? Number(numero) : null,
      fecha: parseDateToISO(fecha) || null,
      numero_factura: numero_factura || null,
      concepto: concepto.trim(),
      importe_a_cobrar: importeACobrarVal,
      importe_cobrado: importeCobradoVal,
      saldo_por_cobrar: saldoPorCobrar,
      fecha_pago: parseDateToISO(fecha_pago) || null,
      periodo: periodo || null,
      username,
    });

    res.status(201).json({ success: true, id_factura: result.insertId });
  } catch (err) {
    console.error("Error insertando factura de cobranza:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}

// ─── PUT /proyectos/:id/cobranza-facturas/:idFactura ───────────────────
export async function updateFactura(req, res) {
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
      periodo,
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

    const result = await CobranzaModel.updateFactura(idFactura, proyectoId, {
      numero: numero ? Number(numero) : null,
      fecha: parseDateToISO(fecha) || null,
      numero_factura: numero_factura || null,
      concepto: concepto || null,
      importe_a_cobrar: importeACobrarVal,
      importe_cobrado: importeCobradoVal,
      saldo_por_cobrar: saldoPorCobrar,
      fecha_pago: parseDateToISO(fecha_pago) || null,
      periodo: periodo || null,
      username,
    });

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Factura no encontrada" });
    }

    res.json({ success: true, message: "Factura actualizada correctamente" });
  } catch (err) {
    console.error("Error actualizando factura de cobranza:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}

// ─── DELETE /proyectos/:id/cobranza-facturas/:idFactura ────────────────
export async function deleteFactura(req, res) {
  try {
    const proyectoId = Number(req.params.id);
    const idFactura = Number(req.params.idFactura);

    if (!Number.isInteger(proyectoId) || proyectoId <= 0) {
      return res.status(400).json({ success: false, message: "Proyecto inválido" });
    }
    if (!Number.isInteger(idFactura) || idFactura <= 0) {
      return res.status(400).json({ success: false, message: "Factura inválida" });
    }

    const result = await CobranzaModel.deleteFactura(idFactura, proyectoId);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Factura no encontrada" });
    }

    res.json({ success: true, message: "Factura eliminada correctamente" });
  } catch (err) {
    console.error("Error eliminando factura de cobranza:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}
