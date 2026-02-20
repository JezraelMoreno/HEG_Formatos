import * as RemisionModel from "../models/remision.model.js";
import ExcelJS from "exceljs";
import path from "path";
import { ASSETS_DIR } from "../helpers/excel.js";
import { pad2 } from "../helpers/utils.js";

// ---------------------------------------------------------------------------
// Helpers compartidos para generar Excel de remisiones
// ---------------------------------------------------------------------------

const EXCEL_HEADERS = [
  "NO.", "PROYECTO", "PEDIDO", "SUBPEDIDO", "PERFIL", "DESCRIPCION",
  "MEDIDA", "PESO", "TOTAL KG", "ACABADO",
  "PEDIDO", "RECIBIDO", "SALDO", "EXTRUIDO", "PINTADO",
  "FECHA LIBERACION", "FECHA ENTREGA", "%", "PRIORIDAD",
  "OBS. PROVEEDOR", "OBS. HEG", "KG SALDO",
];

const COL_WIDTHS = [5, 15, 10, 10, 12, 35, 8, 8, 12, 25, 8, 8, 8, 8, 8, 15, 15, 8, 8, 30, 30, 12];

function applyHeaderRow(ws, rowIdx) {
  const hRow = ws.getRow(rowIdx);
  EXCEL_HEADERS.forEach((h, i) => {
    const cell = hRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    };
  });
}

function addDataRows(ws, rows, nombreProyecto) {
  let totalKg = 0;
  let totalKgSaldo = 0;

  rows.forEach((r, idx) => {
    const row = ws.addRow([
      idx + 1,
      nombreProyecto || r.nombre_proyecto,
      r.numero_pedido,
      r.subpedido,
      r.numero_perfil,
      r.descripcion,
      r.medida_tramo,
      r.peso_kg_ml,
      r.total_kg,
      r.acabado,
      r.cantidad_pedida,
      r.cantidad_recibida,
      r.cantidad_saldo,
      r.cantidad_extruido,
      r.cantidad_pintado,
      r.fecha_liberacion ? new Date(r.fecha_liberacion).toLocaleDateString("es-MX") : "",
      r.fecha_entrega ? new Date(r.fecha_entrega).toLocaleDateString("es-MX") : "",
      r.porcentaje_avance ? (r.porcentaje_avance * 100).toFixed(1) + "%" : "0%",
      r.prioridad,
      r.observaciones_proveedor || "",
      r.observaciones_heg || "",
      r.kg_saldo,
    ]);

    // Formato de celdas numericas
    row.getCell(7).numFmt = "0.000";
    row.getCell(8).numFmt = "0.0000";
    row.getCell(9).numFmt = "#,##0.000";
    row.getCell(22).numFmt = "#,##0.000";

    // Color por prioridad
    let bgColor = "FFFFFFFF";
    if (r.prioridad === "A") bgColor = "FFFFCCCC";
    else if (r.prioridad === "B") bgColor = "FFFFFFCC";
    else if (r.prioridad === "C") bgColor = "FFCCFFCC";

    row.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
      cell.border = {
        top: { style: "thin", color: { argb: "FFDDDDDD" } },
        bottom: { style: "thin", color: { argb: "FFDDDDDD" } },
        left: { style: "thin", color: { argb: "FFDDDDDD" } },
        right: { style: "thin", color: { argb: "FFDDDDDD" } },
      };
    });

    totalKg += Number(r.total_kg) || 0;
    totalKgSaldo += Number(r.kg_saldo) || 0;
  });

  return { totalKg, totalKgSaldo };
}

function applyColumnWidths(ws) {
  ws.columns.forEach((col, i) => {
    col.width = COL_WIDTHS[i] || 10;
  });
}

// ---------------------------------------------------------------------------
// GET /proyectos/:id/remisiones
// ---------------------------------------------------------------------------
export async function listarPorProyecto(req, res) {
  try {
    const { id } = req.params;
    const { prioridad, proveedor, search, tipo } = req.query;
    const rows = await RemisionModel.findByProyecto(id, { prioridad, proveedor, search, tipo });
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("Error obteniendo remisiones:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}

// ---------------------------------------------------------------------------
// GET /remisiones
// ---------------------------------------------------------------------------
export async function listarTodas(req, res) {
  try {
    const { prioridad, id_proyecto, search, tipo } = req.query;
    const rows = await RemisionModel.findAll({ prioridad, id_proyecto, search, tipo });
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("Error obteniendo remisiones:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}

// ---------------------------------------------------------------------------
// GET /remisiones/resumen
// ---------------------------------------------------------------------------
export async function resumen(req, res) {
  try {
    const { rowsAluminio, rowsCristal } = await RemisionModel.getResumen();

    // Combinar resultados por prioridad
    const resumenMap = {};
    for (const r of rowsAluminio) {
      if (!resumenMap[r.prioridad]) {
        resumenMap[r.prioridad] = { prioridad: r.prioridad, total_items: 0, total_pedido: 0, total_recibido: 0, total_saldo: 0, total_kg: 0, kg_saldo: 0 };
      }
      resumenMap[r.prioridad].total_items += Number(r.total_items) || 0;
      resumenMap[r.prioridad].total_pedido += Number(r.total_pedido) || 0;
      resumenMap[r.prioridad].total_recibido += Number(r.total_recibido) || 0;
      resumenMap[r.prioridad].total_saldo += Number(r.total_saldo) || 0;
      resumenMap[r.prioridad].total_kg += Number(r.total_kg) || 0;
      resumenMap[r.prioridad].kg_saldo += Number(r.kg_saldo) || 0;
    }
    for (const r of rowsCristal) {
      if (!resumenMap[r.prioridad]) {
        resumenMap[r.prioridad] = { prioridad: r.prioridad, total_items: 0, total_pedido: 0, total_recibido: 0, total_saldo: 0, total_kg: 0, kg_saldo: 0 };
      }
      resumenMap[r.prioridad].total_items += Number(r.total_items) || 0;
      resumenMap[r.prioridad].total_pedido += Number(r.total_pedido) || 0;
      resumenMap[r.prioridad].total_recibido += Number(r.total_recibido) || 0;
      resumenMap[r.prioridad].total_saldo += Number(r.total_saldo) || 0;
      resumenMap[r.prioridad].total_kg += Number(r.total_kg) || 0;
      resumenMap[r.prioridad].kg_saldo += Number(r.kg_saldo) || 0;
    }

    // Calcular porcentaje promedio
    const rows = Object.values(resumenMap).map((r) => ({
      ...r,
      porcentaje_promedio: r.total_pedido > 0 ? Math.round((r.total_recibido / r.total_pedido) * 100 * 100) / 100 : 0,
    }));

    rows.sort((a, b) => a.prioridad.localeCompare(b.prioridad));

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("Error obteniendo resumen de remisiones:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}

// ---------------------------------------------------------------------------
// PUT /remisiones/:id
// ---------------------------------------------------------------------------
export async function actualizarControl(req, res) {
  try {
    const { id } = req.params;
    const { tipo_material } = req.body;

    if (!tipo_material || !["aluminio", "cristal", "miscelaneo"].includes(tipo_material)) {
      return res.status(400).json({ success: false, message: "tipo_material requerido (aluminio, cristal o miscelaneo)" });
    }

    await RemisionModel.upsertControl(id, req.body);

    res.json({ success: true, message: "Registro actualizado exitosamente" });
  } catch (err) {
    console.error("Error actualizando control de entregas:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}

// ---------------------------------------------------------------------------
// GET /proyectos/:id/remisiones/export
// ---------------------------------------------------------------------------
export async function exportarPorProyecto(req, res) {
  try {
    const { id } = req.params;
    const { prioridad, tipo } = req.query;

    const result = await RemisionModel.findForExportByProyecto(id, { prioridad, tipo });
    if (!result) {
      return res.status(404).json({ success: false, message: "Proyecto no encontrado" });
    }

    const { proyecto, rows } = result;

    // Crear workbook
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Programacion de Entregas");

    // Encabezados
    const headerRow1 = ws.addRow(["PROYECTO:", proyecto.nombre]);
    headerRow1.font = { bold: true };
    const fechaGen = new Date().toLocaleDateString("es-MX");
    ws.addRow(["FECHA:", fechaGen]);
    ws.addRow(["CONCEPTO:", "PROGRAMA DE ENTREGAS - CONTROL DE REMISIONES"]);
    ws.addRow([]);

    // Headers de columnas (fila 6 en el worksheet porque addRow es secuencial despues de la 4 vacias)
    const headerRowIdx = 6;
    applyHeaderRow(ws, headerRowIdx);

    // Datos
    const { totalKg, totalKgSaldo } = addDataRows(ws, rows, proyecto.nombre);

    // Fila de totales
    const totalRow = ws.addRow([
      "", "", "", "", "", "TOTALES", "", "", totalKg, "", "", "", "", "", "",
      "", "", "", "", "", "", totalKgSaldo,
    ]);
    totalRow.font = { bold: true };
    totalRow.getCell(9).numFmt = "#,##0.000";
    totalRow.getCell(22).numFmt = "#,##0.000";

    // Ajustar anchos de columna
    applyColumnWidths(ws);

    // Congelar filas
    ws.views = [{ state: "frozen", ySplit: headerRowIdx }];

    // Enviar archivo
    const filename = `remisiones_${proyecto.nombre.replace(/\s+/g, "_")}_${fechaGen.replace(/\//g, "-")}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Error exportando remisiones:", err);
    res.status(500).json({ success: false, message: "Error generando archivo" });
  }
}

// ---------------------------------------------------------------------------
// GET /remisiones/export
// ---------------------------------------------------------------------------
export async function exportarGeneral(req, res) {
  try {
    const { prioridad, tipo } = req.query;

    const rows = await RemisionModel.findForExportAll({ prioridad, tipo });

    // Crear workbook
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Tabla Resumen");

    const fechaGen = new Date().toLocaleDateString("es-MX");
    ws.addRow(["PROYECTO:", "GENERAL"]);
    ws.addRow(["FECHA:", fechaGen]);
    ws.addRow(["CONCEPTO:", "PROGRAMA DE ENTREGAS - TABLA RESUMEN"]);
    ws.addRow([]);

    // Headers
    const headerRowIdx = 5;
    applyHeaderRow(ws, headerRowIdx);

    // Datos
    const { totalKg, totalKgSaldo } = addDataRows(ws, rows, null);

    const totalRow = ws.addRow(["", "", "", "", "", "TOTALES", "", "", totalKg, "", "", "", "", "", "", "", "", "", "", "", "", totalKgSaldo]);
    totalRow.font = { bold: true };

    applyColumnWidths(ws);

    ws.views = [{ state: "frozen", ySplit: headerRowIdx }];

    const filename = `remisiones_general_${fechaGen.replace(/\//g, "-")}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Error exportando remisiones:", err);
    res.status(500).json({ success: false, message: "Error generando archivo" });
  }
}

// ---------------------------------------------------------------------------
// GET /remisiones/buscar-pedidos
// ---------------------------------------------------------------------------
export async function buscarPedidos(req, res) {
  try {
    const { tipo, search } = req.query;
    console.log(`[DEBUG] Buscando pedidos - Tipo: ${tipo}, Search: ${search}`);

    if (!tipo || !["aluminio", "cristal", "miscelaneo"].includes(tipo)) {
      return res.status(400).json({ success: false, message: "Tipo de material requerido (aluminio, cristal o miscelaneo)" });
    }

    const rows = await RemisionModel.buscarPedidos(tipo, search);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("Error buscando pedidos:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}

// ---------------------------------------------------------------------------
// GET /remisiones/detalles-pedido/:pedidoId
// ---------------------------------------------------------------------------
export async function detallesPedido(req, res) {
  try {
    const { pedidoId } = req.params;
    const { tipo } = req.query;

    if (!tipo || !["aluminio", "cristal", "miscelaneo"].includes(tipo)) {
      return res.status(400).json({ success: false, message: "Tipo de material requerido" });
    }

    const rows = await RemisionModel.getDetallesPedido(pedidoId, tipo);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("Error obteniendo detalles de pedido:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}

// ---------------------------------------------------------------------------
// POST /remisiones/registrar-entrega
// ---------------------------------------------------------------------------
export async function registrarEntrega(req, res) {
  try {
    const { id_pedido, tipo_material, entregas, observaciones } = req.body;
    const usuario = req.user?.username || "sistema";

    if (!id_pedido || !tipo_material || !entregas || !Array.isArray(entregas) || entregas.length === 0) {
      return res.status(400).json({ success: false, message: "Datos incompletos" });
    }

    // Obtener datos del pedido
    const pedido = await RemisionModel.getPedidoParaEntrega(id_pedido);
    if (!pedido) {
      return res.status(404).json({ success: false, message: "Pedido no encontrado" });
    }

    // Registrar historial de entrega
    const historialResult = await RemisionModel.insertHistorialEntrega({
      id_pedido,
      numero_pedido: pedido.pedido,
      nombre_proyecto: pedido.nombre_proyecto,
      tipo_material,
      total_items: entregas.length,
      total_piezas: entregas.reduce((acc, e) => acc + e.cantidad_entrega, 0),
      observaciones: observaciones || null,
      usuario,
    });

    const id_entrega = historialResult.insertId;

    // Actualizar cantidades en remisiones_control usando UPSERT
    for (const entrega of entregas) {
      if (entrega.cantidad_entrega > 0) {
        // Verificar/crear el registro en remisiones_control
        await RemisionModel.upsertControlEntrega(
          entrega.id_detalle,
          tipo_material,
          entrega.cantidad_pedida,
          entrega.cantidad_entrega
        );

        // Registrar detalle de la entrega
        await RemisionModel.insertHistorialEntregaDetalle(
          id_entrega,
          entrega.id_detalle,
          entrega.cantidad_entrega,
          entrega.descripcion || ""
        );
      }
    }

    res.json({
      success: true,
      message: "Entrega registrada exitosamente",
      id_entrega,
    });
  } catch (err) {
    console.error("Error registrando entrega:", err);
    res.status(500).json({ success: false, message: "Error al registrar entrega" });
  }
}

// ---------------------------------------------------------------------------
// GET /remisiones/historial-entregas
// ---------------------------------------------------------------------------
export async function historialEntregas(req, res) {
  try {
    const { id_proyecto, limit } = req.query;
    const rows = await RemisionModel.getHistorialEntregas({ id_proyecto, limit });
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("Error obteniendo historial de entregas:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}

// ---------------------------------------------------------------------------
// GET /remisiones/historial-entregas/:id
// ---------------------------------------------------------------------------
export async function detalleEntrega(req, res) {
  try {
    const { id } = req.params;

    const data = await RemisionModel.getHistorialEntregaById(id);
    if (!data) {
      return res.status(404).json({ success: false, message: "Entrega no encontrada" });
    }

    res.json({ success: true, data });
  } catch (err) {
    console.error("Error obteniendo detalle de entrega:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}
