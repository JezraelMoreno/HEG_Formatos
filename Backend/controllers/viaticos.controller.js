import ExcelJS from "exceljs";
import * as ViaticoModel from "../models/viatico.model.js";

export async function listarPresupuestos(req, res) {
  try {
    const proyectoId = Number(req.params.id);
    if (!Number.isInteger(proyectoId) || proyectoId <= 0) {
      return res.status(400).json({ success: false, message: "Proyecto inválido" });
    }
    const results = await ViaticoModel.getPresupuestos(proyectoId);
    res.json({ success: true, data: results || [] });
  } catch (err) {
    console.error("Error consultando presupuestos de viáticos:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}

export async function crearPresupuesto(req, res) {
  try {
    const proyectoId = Number(req.params.id);
    const { familia, presupuesto_asignado } = req.body || {};
    const username = req.user?.username || "unknown";

    const validFamilias = ['Mano de Obra', 'Viáticos', 'Fletes', 'F.H.', 'Rentas Casa'];
    if (!validFamilias.includes(familia)) {
      return res.status(400).json({ success: false, message: "Familia inválida" });
    }

    const presupuesto = Number(presupuesto_asignado);
    if (!Number.isFinite(presupuesto) || presupuesto < 0) {
      return res.status(400).json({ success: false, message: "Presupuesto inválido" });
    }

    await ViaticoModel.upsertPresupuesto(proyectoId, familia, presupuesto, username);
    res.status(201).json({ success: true, message: "Presupuesto actualizado correctamente" });
  } catch (err) {
    console.error("Error actualizando presupuesto de viáticos:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}

export async function listarMovimientos(req, res) {
  try {
    const proyectoId = Number(req.params.id);
    const { familia, fecha_desde, fecha_hasta } = req.query;
    const results = await ViaticoModel.getMovimientos(proyectoId, { familia, fecha_desde, fecha_hasta });
    res.json({ success: true, data: results || [] });
  } catch (err) {
    console.error("Error consultando movimientos de viáticos:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}

export async function crearMovimiento(req, res) {
  try {
    const proyectoId = Number(req.params.id);
    const { familia, persona, concepto, clave_referencia, fecha, ingreso, egreso } = req.body || {};
    const username = req.user?.username || "unknown";

    const validFamilias = ['Mano de Obra', 'Viáticos', 'Fletes', 'F.H.', 'Rentas Casa'];
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

    const result = await ViaticoModel.createMovimiento(proyectoId, {
      familia, persona, concepto, clave_referencia, fecha,
      ingreso: ingresoVal, egreso: egresoVal, username
    });
    await ViaticoModel.recalcularSaldos(proyectoId, familia);
    res.status(201).json({
      success: true,
      message: "Movimiento registrado correctamente",
      data: { id_movimiento: result.insertId }
    });
  } catch (err) {
    console.error("Error creando movimiento de viáticos:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}

export async function eliminarMovimiento(req, res) {
  try {
    const proyectoId = Number(req.params.id);
    const movimientoId = Number(req.params.movimientoId);

    const mov = await ViaticoModel.getMovimientoFamilia(movimientoId, proyectoId);
    if (!mov) {
      return res.status(404).json({ success: false, message: "Movimiento no encontrado" });
    }
    const familia = mov.familia;
    await ViaticoModel.deleteMovimiento(movimientoId, proyectoId);
    await ViaticoModel.recalcularSaldos(proyectoId, familia);
    res.json({ success: true, message: "Movimiento eliminado correctamente" });
  } catch (err) {
    console.error("Error eliminando movimiento:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}

export async function exportarMovimientos(req, res) {
  const { id } = req.params;
  const { familia, fecha_desde, fecha_hasta } = req.query;

  try {
    const nombreProyecto = await ViaticoModel.getProyectoNombre(id);
    const movimientos = await ViaticoModel.getMovimientos(id, { familia, fecha_desde, fecha_hasta });
    const presupuestos = await ViaticoModel.getPresupuestos(id);

    const workbook = new ExcelJS.Workbook();

    // Sheet 1: Pagos en Efectivo
    const sheetMovimientos = workbook.addWorksheet("Pagos en Efectivo");
    sheetMovimientos.mergeCells("A1:I1");
    const titleCell = sheetMovimientos.getCell("A1");
    titleCell.value = `PAGOS EN EFECTIVO - ${nombreProyecto}`;
    titleCell.font = { bold: true, size: 14 };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };

    const headers = ["N°", "NOMBRE", "CONCEPTO", "FAMILIA", "CLAVE", "PROYECTO", "FECHA", "BALANCE", "", "", "OBSERVACIONES"];
    const subheaders = ["", "", "", "", "", "", "", "INGRESO", "EGRESO", "SALDO", ""];
    sheetMovimientos.getRow(2).values = headers;
    sheetMovimientos.getRow(3).values = subheaders;

    sheetMovimientos.mergeCells("A2:A3");
    sheetMovimientos.mergeCells("B2:B3");
    sheetMovimientos.mergeCells("C2:C3");
    sheetMovimientos.mergeCells("D2:D3");
    sheetMovimientos.mergeCells("E2:E3");
    sheetMovimientos.mergeCells("F2:F3");
    sheetMovimientos.mergeCells("G2:G3");
    sheetMovimientos.mergeCells("H2:J2");
    sheetMovimientos.mergeCells("K2:K3");

    ["A2", "B2", "C2", "D2", "E2", "F2", "G2", "H2", "K2"].forEach(cell => {
      const c = sheetMovimientos.getCell(cell);
      c.font = { bold: true };
      c.alignment = { horizontal: "center", vertical: "middle" };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } };
      c.border = { top: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" }, bottom: { style: "thin" } };
    });
    ["H3", "I3", "J3"].forEach(cell => {
      const c = sheetMovimientos.getCell(cell);
      c.font = { bold: true };
      c.alignment = { horizontal: "center", vertical: "middle" };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } };
      c.border = { top: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" }, bottom: { style: "thin" } };
    });

    movimientos.forEach((mov, idx) => {
      const row = sheetMovimientos.addRow([
        idx + 1, mov.persona, mov.concepto, mov.familia,
        mov.clave_referencia || "", nombreProyecto, mov.fecha,
        mov.ingreso, mov.egreso, mov.saldo, ""
      ]);
      row.getCell(8).numFmt = "$#,##0.00";
      row.getCell(9).numFmt = "$#,##0.00";
      row.getCell(10).numFmt = "$#,##0.00";
      if (mov.saldo < 0) {
        row.getCell(10).font = { color: { argb: "FFFF0000" } };
      }
      for (let i = 1; i <= 11; i++) {
        row.getCell(i).border = { top: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" }, bottom: { style: "thin" } };
      }
    });

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

    // Sheet 2: Desglose de Presupuestos (dynamic — supports any number of families)
    const sheetPresupuestos = workbook.addWorksheet("Desglose de Presupuestos");

    // Build family list from presupuestos in canonical order
    const canonicalOrder = ['Mano de Obra', 'Viáticos', 'Fletes', 'F.H.', 'Rentas Casa'];
    const familyKeys = [
      ...canonicalOrder.filter(f => presupuestos.some(p => p.familia === f)),
      ...presupuestos.map(p => p.familia).filter(f => !canonicalOrder.includes(f))
    ];

    const budgetByFamily = {};
    familyKeys.forEach(f => { budgetByFamily[f] = { presupuesto: 0, erogado: 0, porErogar: 0 }; });
    presupuestos.forEach(p => {
      if (budgetByFamily[p.familia]) {
        budgetByFamily[p.familia].presupuesto = p.presupuesto_asignado;
        budgetByFamily[p.familia].erogado = p.gastado;
        budgetByFamily[p.familia].porErogar = p.restante;
      }
    });

    // Columns: N°(1), PROYECTO(2), then 3 cols per family, then TOTAL(last)
    const totalCols = 2 + familyKeys.length * 3 + 1;
    const lastCol = totalCols;
    const colLetter = (n) => {
      let s = "";
      while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
      return s;
    };

    // Title
    sheetPresupuestos.mergeCells(`A1:${colLetter(lastCol)}1`);
    const titleCell2 = sheetPresupuestos.getCell("A1");
    titleCell2.value = `DESGLOSE DE PRESUPUESTOS - ${nombreProyecto}`;
    titleCell2.font = { bold: true, size: 14 };
    titleCell2.alignment = { horizontal: "center", vertical: "middle" };

    // Header row 2
    const headerRow2 = ["N°", "PROYECTO"];
    familyKeys.forEach(f => { headerRow2.push(f.toUpperCase(), "", ""); });
    headerRow2.push("TOTAL POR EROGAR");
    sheetPresupuestos.getRow(2).values = headerRow2;

    // Subheader row 3
    const headerRow3 = ["", ""];
    familyKeys.forEach(() => { headerRow3.push("PRESUPUESTO", "EROGADO", "POR EROGAR"); });
    headerRow3.push("");
    sheetPresupuestos.getRow(3).values = headerRow3;

    // Merge N°, PROYECTO, and TOTAL vertically
    sheetPresupuestos.mergeCells("A2:A3");
    sheetPresupuestos.mergeCells("B2:B3");
    sheetPresupuestos.mergeCells(`${colLetter(lastCol)}2:${colLetter(lastCol)}3`);

    // Merge each family group horizontally in row 2
    familyKeys.forEach((_, i) => {
      const startCol = 3 + i * 3;
      sheetPresupuestos.mergeCells(`${colLetter(startCol)}2:${colLetter(startCol + 2)}2`);
    });

    const headerStyle = { font: { bold: true }, alignment: { horizontal: "center", vertical: "middle" }, fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } }, border: { top: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" }, bottom: { style: "thin" } } };
    ["A2", "B2", `${colLetter(lastCol)}2`].forEach(addr => Object.assign(sheetPresupuestos.getCell(addr), headerStyle));
    familyKeys.forEach((_, i) => {
      const startCol = 3 + i * 3;
      Object.assign(sheetPresupuestos.getCell(`${colLetter(startCol)}2`), headerStyle);
      [startCol, startCol + 1, startCol + 2].forEach(c => Object.assign(sheetPresupuestos.getCell(`${colLetter(c)}3`), headerStyle));
    });

    const totalPorErogar = familyKeys.reduce((sum, f) => sum + (budgetByFamily[f]?.porErogar || 0), 0);

    const dataValues = [1, nombreProyecto];
    familyKeys.forEach(f => {
      dataValues.push(budgetByFamily[f].presupuesto, budgetByFamily[f].erogado, budgetByFamily[f].porErogar);
    });
    dataValues.push(totalPorErogar);

    const dataRow = sheetPresupuestos.addRow(dataValues);
    for (let i = 3; i <= lastCol; i++) {
      dataRow.getCell(i).numFmt = "$#,##0.00";
      if (dataRow.getCell(i).value < 0) dataRow.getCell(i).font = { color: { argb: "FFFF0000" } };
    }
    for (let i = 1; i <= lastCol; i++) {
      dataRow.getCell(i).border = { top: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" }, bottom: { style: "thin" } };
    }

    sheetPresupuestos.getColumn(1).width = 8;
    sheetPresupuestos.getColumn(2).width = 30;
    for (let i = 3; i <= lastCol; i++) {
      sheetPresupuestos.getColumn(i).width = 15;
    }

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=Pagos_Efectivo_${nombreProyecto.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Error exportando movimientos:", err);
    res.status(500).json({ success: false, message: "Error al exportar" });
  }
}
