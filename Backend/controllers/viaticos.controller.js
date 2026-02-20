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

    const validFamilias = ['Mano de Obra', 'Viáticos', 'Fletes'];
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

    const validFamilias = ['Mano de Obra', 'Viáticos', 'Fletes'];
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

    // Sheet 2: Desglose de Presupuestos
    const sheetPresupuestos = workbook.addWorksheet("Desglose de Presupuestos");
    sheetPresupuestos.mergeCells("A1:J1");
    const titleCell2 = sheetPresupuestos.getCell("A1");
    titleCell2.value = `DESGLOSE DE PRESUPUESTOS - ${nombreProyecto}`;
    titleCell2.font = { bold: true, size: 14 };
    titleCell2.alignment = { horizontal: "center", vertical: "middle" };

    const presupuestoHeaders = [
      "N°", "PROYECTO",
      "MANO DE OBRA", "", "",
      "VIATICOS", "", "",
      "FLETES", "", "",
      "TOTAL POR EROGAR"
    ];
    const presupuestoSubheaders = [
      "", "",
      "PRESUPUESTO", "EROGADO", "POR EROGAR",
      "PRESUPUESTO", "EROGADO", "POR EROGAR",
      "PRESUPUESTO", "EROGADO", "POR EROGAR",
      ""
    ];
    sheetPresupuestos.getRow(2).values = presupuestoHeaders;
    sheetPresupuestos.getRow(3).values = presupuestoSubheaders;

    sheetPresupuestos.mergeCells("A2:A3");
    sheetPresupuestos.mergeCells("B2:B3");
    sheetPresupuestos.mergeCells("C2:E2");
    sheetPresupuestos.mergeCells("F2:H2");
    sheetPresupuestos.mergeCells("I2:K2");
    sheetPresupuestos.mergeCells("L2:L3");

    ["A2", "B2", "C2", "F2", "I2", "L2"].forEach(cell => {
      const c = sheetPresupuestos.getCell(cell);
      c.font = { bold: true };
      c.alignment = { horizontal: "center", vertical: "middle" };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } };
      c.border = { top: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" }, bottom: { style: "thin" } };
    });
    ["C3", "D3", "E3", "F3", "G3", "H3", "I3", "J3", "K3"].forEach(cell => {
      const c = sheetPresupuestos.getCell(cell);
      c.font = { bold: true };
      c.alignment = { horizontal: "center", vertical: "middle" };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } };
      c.border = { top: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" }, bottom: { style: "thin" } };
    });

    const budgetByFamily = {
      "Mano de Obra": { presupuesto: 0, erogado: 0, porErogar: 0 },
      "Viáticos": { presupuesto: 0, erogado: 0, porErogar: 0 },
      "Fletes": { presupuesto: 0, erogado: 0, porErogar: 0 }
    };
    presupuestos.forEach(p => {
      if (budgetByFamily[p.familia]) {
        budgetByFamily[p.familia].presupuesto = p.presupuesto_asignado;
        budgetByFamily[p.familia].erogado = p.gastado;
        budgetByFamily[p.familia].porErogar = p.restante;
      }
    });

    const totalPorErogar =
      budgetByFamily["Mano de Obra"].porErogar +
      budgetByFamily["Viáticos"].porErogar +
      budgetByFamily["Fletes"].porErogar;

    const dataRow = sheetPresupuestos.addRow([
      1, nombreProyecto,
      budgetByFamily["Mano de Obra"].presupuesto,
      budgetByFamily["Mano de Obra"].erogado,
      budgetByFamily["Mano de Obra"].porErogar,
      budgetByFamily["Viáticos"].presupuesto,
      budgetByFamily["Viáticos"].erogado,
      budgetByFamily["Viáticos"].porErogar,
      budgetByFamily["Fletes"].presupuesto,
      budgetByFamily["Fletes"].erogado,
      budgetByFamily["Fletes"].porErogar,
      totalPorErogar
    ]);

    for (let i = 3; i <= 12; i++) {
      dataRow.getCell(i).numFmt = "$#,##0.00";
    }
    for (let i = 3; i <= 12; i++) {
      if (dataRow.getCell(i).value < 0) {
        dataRow.getCell(i).font = { color: { argb: "FFFF0000" } };
      }
    }
    for (let i = 1; i <= 12; i++) {
      dataRow.getCell(i).border = { top: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" }, bottom: { style: "thin" } };
    }

    sheetPresupuestos.getColumn(1).width = 8;
    sheetPresupuestos.getColumn(2).width = 30;
    for (let i = 3; i <= 12; i++) {
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
