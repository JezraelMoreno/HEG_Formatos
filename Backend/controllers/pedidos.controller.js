import ExcelJS from "exceljs";
import * as PedidoModel from "../models/pedido.model.js";
import {
  normalizeTextValue,
  parseDateToISO,
  pad2,
  toFiniteNumber,
  normalizePct,
  isSalidaTlatilco,
  calcularSubtotalDetalles,
  parseSituacionEspecialInfo,
} from "../helpers/utils.js";
import { ASSETS_DIR } from "../helpers/excel.js";
import path from "path";

export async function listarPorProyecto(req, res) {
  try {
    const { id } = req.params;
    const { familia, clan, proveedor, concepto, fecha } = req.query;
    const results = await PedidoModel.findByProyecto(id, { familia, clan, proveedor, concepto, fecha });
    const rows = Array.isArray(results) ? results : [];
    const data = await Promise.all(
      rows.map(async (row) => {
        let importe = Number(row.importe || 0);
        try {
          const calc = await PedidoModel.calcularImporteDesdeDetalles(row, { includeSubtotal: true });
          if (
            !Number.isFinite(importe) ||
            importe <= 0 ||
            (calc.subtotal > 0 && importe < calc.subtotal * 1.15)
          ) {
            importe = calc.total;
          }
        } catch (calcErr) {
          console.error("Error recalculando importe de pedido:", calcErr);
        }
        return { ...row, importe };
      })
    );
    res.json({ success: true, data });
  } catch (err) {
    console.error("Error consultando pedidos:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}

export async function resumen(req, res) {
  try {
    const rawFecha = typeof req.query.fecha === "string" ? req.query.fecha.trim() : "";
    const rawUsuario = typeof req.query.usuario === "string" ? req.query.usuario.trim() : "";
    const today = new Date();
    const todayIso = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
    const fechaFiltro = parseDateToISO(rawFecha) || todayIso;
    const result = await PedidoModel.getResumen(fechaFiltro, rawUsuario);
    res.json({
      success: true,
      data: result.rows,
      usuarios: result.usuarios,
      fechaFiltro,
    });
  } catch (err) {
    console.error("Error consultando resumen de pedidos:", err);
    res.status(500).json({ success: false, message: "Error interno al cargar pedidos" });
  }
}

export async function conteoPendientes(req, res) {
  try {
    const esSupervisor = String(req.user?.role || "").toLowerCase() === "supervisor";
    const total = await PedidoModel.getConteoPendientes(esSupervisor ? req.user.sub : null);
    return res.json({ success: true, data: { total } });
  } catch (err) {
    console.error("Error consultando conteo de pedidos pendientes:", err);
    return res.status(500).json({ success: false, message: "Error al consultar pedidos pendientes" });
  }
}

export async function obtenerDetalles(req, res) {
  try {
    const pedidoId = Number(req.params.pedidoId);
    if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
      return res.status(400).json({ success: false, message: "Pedido inválido" });
    }
    const data = await PedidoModel.getDetallesMiscelaneos(pedidoId);
    return res.json({ success: true, data });
  } catch (err) {
    console.error("Error consultando detalles:", err);
    return res.status(500).json({ success: false, message: "Error consultando detalles del pedido" });
  }
}

export async function obtenerDetallesCristal(req, res) {
  try {
    const pedidoId = Number(req.params.pedidoId);
    if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
      return res.status(400).json({ success: false, message: "Pedido inválido" });
    }
    const data = await PedidoModel.getDetallesCristal(pedidoId);
    return res.json({ success: true, data });
  } catch (err) {
    console.error("Error consultando detalles de cristal:", err);
    return res.status(500).json({ success: false, message: "Error consultando detalles de cristal" });
  }
}

export async function guardarDetallesCristal(req, res) {
  try {
    const pedidoId = Number(req.params.pedidoId);
    if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
      return res.status(400).json({ success: false, message: "Pedido inválido" });
    }
    const { detalles, reemplazar = true } = req.body || {};
    if (!Array.isArray(detalles) || detalles.length === 0) {
      return res.status(400).json({ success: false, message: "No hay detalles de cristal para registrar" });
    }
    if (!(await PedidoModel.pedidoExists(pedidoId))) {
      return res.status(404).json({ success: false, message: "Pedido no encontrado" });
    }
    if (reemplazar !== false) {
      await PedidoModel.deleteDetallesCristal(pedidoId);
    }
    const inserted = await PedidoModel.insertCristalDetallesRows(pedidoId, detalles);
    return res.json({
      success: inserted > 0,
      inserted,
      message: `Detalles de cristal registrados: ${inserted}`,
    });
  } catch (err) {
    console.error("Error guardando detalles de cristal:", err);
    return res.status(500).json({ success: false, message: "Error guardando detalles de cristal" });
  }
}

export async function obtenerDetallesAluminio(req, res) {
  try {
    const pedidoId = Number(req.params.pedidoId);
    if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
      return res.status(400).json({ success: false, message: "Pedido inválido" });
    }
    const data = await PedidoModel.getDetallesAluminio(pedidoId);
    return res.json({ success: true, data });
  } catch (err) {
    console.error("Error consultando detalles de aluminio:", err);
    return res.status(500).json({ success: false, message: "Error consultando detalles de aluminio" });
  }
}

export async function guardarDetallesAluminio(req, res) {
  try {
    const pedidoId = Number(req.params.pedidoId);
    if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
      return res.status(400).json({ success: false, message: "Pedido inválido" });
    }
    const { detalles, reemplazar = true } = req.body || {};
    if (!Array.isArray(detalles) || detalles.length === 0) {
      return res.status(400).json({ success: false, message: "No hay detalles de aluminio para registrar" });
    }
    if (!(await PedidoModel.pedidoExists(pedidoId))) {
      return res.status(404).json({ success: false, message: "Pedido no encontrado" });
    }
    if (reemplazar !== false) {
      await PedidoModel.deleteDetallesAluminio(pedidoId);
    }
    const inserted = await PedidoModel.insertAluminioDetallesRows(pedidoId, detalles);
    return res.json({
      success: inserted > 0,
      inserted,
      message: `Detalles de aluminio registrados: ${inserted}`,
    });
  } catch (err) {
    console.error("Error guardando detalles de aluminio:", err);
    return res.status(500).json({ success: false, message: "Error guardando detalles de aluminio" });
  }
}

export async function crearDirecto(req, res) {
  try {
    const proyectoId = Number(req.params.id);
    if (!Number.isInteger(proyectoId) || proyectoId <= 0) {
      return res.status(400).json({ success: false, message: "Proyecto inválido" });
    }
    const body = req.body || {};
    const pedidoNombre = normalizeTextValue(body.pedido);
    const clan = normalizeTextValue(body.clan);
    const familia = normalizeTextValue(body.familia);
    const proveedor = normalizeTextValue(body.proveedor);
    const fechaISO = parseDateToISO(body.fecha_aprobacion);
    const concepto = normalizeTextValue(body.concepto);
    if (!pedidoNombre || !clan || !familia || !proveedor || !fechaISO || !concepto) {
      return res.status(400).json({ success: false, message: "Faltan datos requeridos del pedido" });
    }
    if (!(await PedidoModel.proyectoExists(proyectoId))) {
      return res.status(404).json({ success: false, message: "Proyecto no encontrado" });
    }
    const situacionesEspeciales = normalizeTextValue(body.situaciones_especiales) || null;
    const { dbPct: porcentajeDescuentoDb } = normalizePct(toFiniteNumber(body.porcentaje_descuento));
    const username = normalizeTextValue(req.user?.username);
    if (!username) {
      return res.status(400).json({ success: false, message: "Usuario inválido" });
    }
    const nombreProyecto = await PedidoModel.getProyectoNombre(proyectoId);

    const values = [
      proyectoId,
      nombreProyecto,
      pedidoNombre,
      clan,
      familia,
      proveedor,
      fechaISO,
      concepto,
      situacionesEspeciales,
      porcentajeDescuentoDb,
      0,
      username,
    ];
    let result;
    try {
      result = await PedidoModel.insertPedidoDirecto(values);
    } catch (err) {
      if (err.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ success: false, message: "Ya existe un pedido con ese número en este proyecto" });
      }
      throw err;
    }
    const pedidoId = result.insertId;
    const idUsuario = req.user?.sub;
    await PedidoModel.insertHistorialEstado(pedidoId, null, "levantado", idUsuario, null);

    const detalles = Array.isArray(body.detalles) ? body.detalles : [];
    if (detalles.length > 0) {
      await PedidoModel.insertDetallesSegunFamilia(pedidoId, familia, detalles);
    }
    let importeFinal = 0;
    try {
      const calc = await PedidoModel.calcularImporteDesdeDetalles(
        { id: pedidoId, familia, situaciones_especiales: situacionesEspeciales, porcentaje_descuento: porcentajeDescuentoDb },
        { includeSubtotal: false }
      );
      if (Number.isFinite(calc)) importeFinal = Number(calc);
    } catch (calcErr) {
      console.error("No se pudo calcular el importe del pedido nuevo:", calcErr);
    }
    await PedidoModel.updateImporteTotal(pedidoId, importeFinal);

    const pedido = await PedidoModel.getPedidoById(pedidoId);
    return res.status(201).json({ success: true, data: pedido });
  } catch (err) {
    console.error("Error creando pedido:", err);
    return res.status(500).json({ success: false, message: "Error interno al crear el pedido" });
  }
}

export async function obtenerUno(req, res) {
  try {
    const pedidoId = Number(req.params.pedidoId);
    if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
      return res.status(400).json({ success: false, message: "Pedido inválido" });
    }
    const pedido = await PedidoModel.getPedidoById(pedidoId);
    if (!pedido) {
      return res.status(404).json({ success: false, message: "Pedido no encontrado" });
    }
    const detalles = await PedidoModel.getDetallesSegunFamilia(pedidoId, pedido.familia);
    return res.json({ success: true, data: { ...pedido, detalles } });
  } catch (err) {
    console.error("Error consultando pedido:", err);
    return res.status(500).json({ success: false, message: "Error consultando el pedido" });
  }
}

export async function actualizar(req, res) {
  try {
    const pedidoId = Number(req.params.pedidoId);
    if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
      return res.status(400).json({ success: false, message: "Pedido inválido" });
    }
    const existing = await PedidoModel.getPedidoById(pedidoId);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Pedido no encontrado" });
    }
    if (existing.estado === "rechazado") {
      return res.status(409).json({ success: false, message: "No se puede editar un pedido rechazado" });
    }
    const body = req.body || {};
    const pedidoNombre = normalizeTextValue(body.pedido) || existing.pedido;
    const clan = normalizeTextValue(body.clan) || existing.clan;
    const familia = normalizeTextValue(body.familia) || existing.familia;
    const proveedor = normalizeTextValue(body.proveedor) || existing.proveedor;
    const fechaISO = parseDateToISO(body.fecha_aprobacion) || existing.fecha_aprobacion;
    const concepto = normalizeTextValue(body.concepto) || existing.concepto;
    const situacionesEspeciales = body.situaciones_especiales !== undefined
      ? (normalizeTextValue(body.situaciones_especiales) || null)
      : existing.situaciones_especiales;
    const porcentajeDescuentoDb = body.porcentaje_descuento !== undefined
      ? normalizePct(toFiniteNumber(body.porcentaje_descuento)).dbPct
      : existing.porcentaje_descuento;

    try {
      await PedidoModel.updatePedidoMetadata(pedidoId, {
        pedido: pedidoNombre,
        clan,
        familia,
        proveedor,
        fecha_aprobacion: fechaISO,
        concepto,
        situaciones_especiales: situacionesEspeciales,
        porcentaje_descuento: porcentajeDescuentoDb,
      });
    } catch (err) {
      if (err.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ success: false, message: "Ya existe un pedido con ese número en este proyecto" });
      }
      throw err;
    }

    const { detalles, reemplazar = true } = body;
    if (Array.isArray(detalles) && detalles.length > 0) {
      if (reemplazar !== false) {
        // Se borra la familia ANTERIOR (no la nueva) para no dejar filas huérfanas si el
        // pedido cambió de familia (p.ej. Cristal -> Aluminio) en esta misma edición.
        await PedidoModel.deleteDetallesSegunFamilia(pedidoId, existing.familia);
      }
      await PedidoModel.insertDetallesSegunFamilia(pedidoId, familia, detalles);
    }

    let importeFinal = Number(existing.importe) || 0;
    try {
      const calc = await PedidoModel.calcularImporteDesdeDetalles(
        { id: pedidoId, familia, situaciones_especiales: situacionesEspeciales, porcentaje_descuento: porcentajeDescuentoDb },
        { includeSubtotal: false }
      );
      if (Number.isFinite(calc)) importeFinal = Number(calc);
    } catch (calcErr) {
      console.error("No se pudo recalcular el importe del pedido editado:", calcErr);
    }
    await PedidoModel.updateImporteTotal(pedidoId, importeFinal);

    const pedidoActualizado = await PedidoModel.getPedidoById(pedidoId);
    const detallesActuales = await PedidoModel.getDetallesSegunFamilia(pedidoId, familia);
    return res.json({ success: true, data: { ...pedidoActualizado, detalles: detallesActuales } });
  } catch (err) {
    console.error("Error actualizando pedido:", err);
    return res.status(500).json({ success: false, message: "Error interno al actualizar el pedido" });
  }
}

const ESTADOS_DESTINO_VALIDOS = new Set(["aprobado", "rechazado"]);

export async function cambiarEstado(req, res) {
  try {
    const pedidoId = Number(req.params.pedidoId);
    if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
      return res.status(400).json({ success: false, message: "Pedido inválido" });
    }
    const estadoNuevo = normalizeTextValue(req.body?.estado).toLowerCase();
    if (!ESTADOS_DESTINO_VALIDOS.has(estadoNuevo)) {
      return res.status(400).json({ success: false, message: "Estado inválido. Usa 'aprobado' o 'rechazado'." });
    }
    const comentario = normalizeTextValue(req.body?.comentario) || null;
    if (estadoNuevo === "rechazado" && !comentario) {
      return res.status(400).json({ success: false, message: "El comentario es obligatorio al rechazar un pedido" });
    }
    const pedido = await PedidoModel.getPedidoById(pedidoId);
    if (!pedido) {
      return res.status(404).json({ success: false, message: "Pedido no encontrado" });
    }
    if (pedido.estado === "rechazado") {
      return res.status(409).json({ success: false, message: "El pedido ya está rechazado" });
    }
    if (pedido.estado === estadoNuevo) {
      return res.status(409).json({ success: false, message: `El pedido ya está en estado '${estadoNuevo}'` });
    }
    const idUsuario = req.user?.sub;
    await PedidoModel.updateEstado(pedidoId, estadoNuevo, idUsuario);
    await PedidoModel.insertHistorialEstado(pedidoId, pedido.estado, estadoNuevo, idUsuario, comentario);
    const pedidoActualizado = await PedidoModel.getPedidoById(pedidoId);
    return res.json({ success: true, data: pedidoActualizado });
  } catch (err) {
    console.error("Error cambiando estado del pedido:", err);
    return res.status(500).json({ success: false, message: "Error interno al cambiar el estado" });
  }
}

export async function historial(req, res) {
  try {
    const pedidoId = Number(req.params.pedidoId);
    if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
      return res.status(400).json({ success: false, message: "Pedido inválido" });
    }
    if (!(await PedidoModel.pedidoExists(pedidoId))) {
      return res.status(404).json({ success: false, message: "Pedido no encontrado" });
    }
    const data = await PedidoModel.getHistorialByPedido(pedidoId);
    return res.json({ success: true, data });
  } catch (err) {
    console.error("Error consultando historial del pedido:", err);
    return res.status(500).json({ success: false, message: "Error consultando el historial" });
  }
}

export async function eliminar(req, res) {
  try {
    const pedidoId = Number(req.params.pedidoId);
    if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
      return res.status(400).json({ success: false, message: "Pedido inválido" });
    }
    const pedido = await PedidoModel.getPedidoById(pedidoId);
    if (!pedido) {
      return res.status(404).json({ success: false, message: "Pedido no encontrado" });
    }
    await PedidoModel.deletePedidoById(pedidoId, pedido.id_proyecto);
    return res.json({ success: true, message: "Pedido eliminado" });
  } catch (err) {
    console.error("Error eliminando pedido:", err);
    return res.status(500).json({ success: false, message: "Error interno al eliminar el pedido" });
  }
}

export async function cargaMasiva(req, res) {
  try {
    const { id } = req.params;
    const proyectoId = Number(id);
    const { pedidos } = req.body || {};
    if (!Number.isInteger(proyectoId) || proyectoId <= 0) {
      return res.status(400).json({ success: false, message: "Proyecto inválido" });
    }
    if (!Array.isArray(pedidos) || pedidos.length === 0) {
      return res.status(400).json({ success: false, message: "No hay pedidos a insertar" });
    }
    const username = normalizeTextValue(req.user?.username);
    if (!username) {
      return res.status(400).json({ success: false, message: "Usuario inválido" });
    }

    const detailsLog = [];
    let okCount = 0;
    for (let idx = 0; idx < pedidos.length; idx += 1) {
      const p = pedidos[idx] || {};
      const fechaISO = parseDateToISO(p.fecha_aprobacion);
      if (!fechaISO) {
        detailsLog.push({ index: idx + 1, pedido: p.pedido || null, ok: false, replaced: false, error: "Fecha inválida" });
        continue;
      }
      const pedidoNombre = normalizeTextValue(p.pedido);
      if (!pedidoNombre) {
        detailsLog.push({ index: idx + 1, pedido: null, ok: false, replaced: false, error: "Pedido sin nombre" });
        continue;
      }
      const situacionesEspeciales = normalizeTextValue(p.situaciones_especiales) || null;
      const familiaValor = normalizeTextValue(p.familia);

      const parsePct = (raw) => {
        const num = toFiniteNumber(raw);
        if (num === null) return null;
        return normalizePct(num);
      };
      let porcentajeDescuento = null;
      let porcentajeDescuentoDb = null;
      const posiblesDescuentos = [
        p?.porcentaje_descuento,
        p?.porcentaje,
        p?.porcentaje_situacion_especial,
        p?.["% situacion especial"],
      ];
      for (const candidato of posiblesDescuentos) {
        const pct = parsePct(candidato);
        if (pct !== null) {
          porcentajeDescuento = pct.mathPct;
          porcentajeDescuentoDb = pct.dbPct;
          break;
        }
      }
      if (porcentajeDescuento === null) {
        const { porcentaje } = parseSituacionEspecialInfo(p.situaciones_especiales);
        if (porcentaje > 0) {
          const norm = normalizePct(porcentaje);
          porcentajeDescuento = norm.mathPct;
          porcentajeDescuentoDb = norm.dbPct;
        }
      }
      if (porcentajeDescuento !== null && porcentajeDescuentoDb === null) {
        const norm = normalizePct(porcentajeDescuento);
        porcentajeDescuento = norm.mathPct;
        porcentajeDescuentoDb = norm.dbPct;
      }
      const tieneSalidaTlatilco = isSalidaTlatilco(p.situaciones_especiales);
      const subtotalDetalles = calcularSubtotalDetalles(p.detalles);
      const importePedido = toFiniteNumber(p.importe);
      const baseSinIva =
        subtotalDetalles > 0
          ? subtotalDetalles
          : importePedido !== null && importePedido !== 0
            ? importePedido
            : 0;
      const subtotalBase = Number(baseSinIva.toFixed(2));
      const descuentoMonto = subtotalBase * ((porcentajeDescuento || 0) / 100);
      const subtotalConDesc = subtotalBase - descuentoMonto;
      const ivaMonto = subtotalConDesc * 0.16;
      const importeTotal = tieneSalidaTlatilco ? 0 : Number(Math.max(0, subtotalConDesc + ivaMonto).toFixed(2));

      let replacedExisting = false;
      try {
        const existingRow = await PedidoModel.findExistingPedido(proyectoId, pedidoNombre);
        if (existingRow) {
          let importePrevio = toFiniteNumber(existingRow.importe_total) || 0;
          try {
            const importeCalc = await PedidoModel.calcularImporteDesdeDetalles(existingRow, { includeSubtotal: false });
            if (Number.isFinite(importeCalc) && importeCalc !== null) {
              importePrevio = Number(importeCalc);
            }
          } catch (calcErr) {
            console.error("Error recalculando importe previo del pedido:", calcErr);
          }
          await PedidoModel.deletePedidoById(existingRow.id, proyectoId);
          replacedExisting = true;
        }
      } catch (lookupErr) {
        console.error("Error verificando pedido existente:", lookupErr);
        detailsLog.push({ index: idx + 1, pedido: pedidoNombre, ok: false, replaced: false, error: "No se pudo validar duplicados" });
        continue;
      }

      const values = [
        proyectoId,
        normalizeTextValue(p.nombre_proyecto),
        pedidoNombre,
        normalizeTextValue(p.clan),
        familiaValor,
        normalizeTextValue(p.proveedor),
        fechaISO,
        normalizeTextValue(p.concepto),
        situacionesEspeciales,
        porcentajeDescuentoDb,
        importeTotal,
        username,
      ];
      try {
        const result = await PedidoModel.insertPedido(values);
        const pedidoId = result.insertId;
        await PedidoModel.insertDetallesSegunFamilia(pedidoId, p.familia, p.detalles);
        let importeFinal = importeTotal;
        try {
          const calc = await PedidoModel.calcularImporteDesdeDetalles(
            {
              id: pedidoId,
              familia: familiaValor,
              situaciones_especiales: situacionesEspeciales,
              porcentaje_descuento: porcentajeDescuentoDb,
            },
            { includeSubtotal: true }
          );
          if (calc && calc.subtotal > 0 && Number.isFinite(calc.total)) {
            importeFinal = Number(calc.total);
          }
        } catch (calcErr) {
          console.error("No se pudo recalcular el importe del pedido insertado:", calcErr);
        }
        const importeFinalSeguro = Number(
          Number.isFinite(importeFinal) ? importeFinal.toFixed(2) : Number(importeTotal.toFixed(2))
        );
        try {
          await PedidoModel.updateImporteTotal(pedidoId, importeFinalSeguro);
        } catch (updErr) {
          console.error("No se pudo actualizar el importe_total del pedido:", updErr);
        }
        okCount += 1;
        detailsLog.push({ index: idx + 1, pedido: pedidoNombre, ok: true, replaced: replacedExisting, error: null });
      } catch (err) {
        console.error("Error insertando pedido:", err);
        detailsLog.push({ index: idx + 1, pedido: pedidoNombre, ok: false, replaced: replacedExisting, error: String(err?.message || err) });
      }
    }

    const failCount = detailsLog.length - okCount;
    return res.json({
      success: okCount > 0,
      inserted: okCount,
      failed: failCount,
      message: `Pedidos insertados: ${okCount}${failCount ? ", fallidos: " + failCount : ""}`,
      details: detailsLog,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}

export async function exportarPedidos(req, res) {
  try {
    const { id } = req.params;
    const { familia, clan, proveedor, concepto, fecha } = req.query;
    const nombreProyecto = await PedidoModel.getProyectoNombre(id);
    const pedidos = await PedidoModel.getPedidosForExport(id, { familia, clan, proveedor, concepto, fecha });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Explosión");

    try {
      const logoPath = path.join(ASSETS_DIR, "heg_logo.jpg");
      const imgId = wb.addImage({ filename: logoPath, extension: "jpeg" });
      ws.addImage(imgId, {
        tl: { col: 0, row: 0 },
        ext: { width: 220, height: 80 },
      });
    } catch (imgErr) {
      console.warn("No se pudo cargar el logo:", imgErr?.message || imgErr);
    }

    const now = new Date();
    const fechaGeneracion = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
    const titleRow = ws.getRow(5);
    const filtroText = familia && String(familia).trim() !== "" ? ` - Familia: ${familia}` : "";
    titleRow.getCell(1).value = `Explosión de insumos - ${nombreProyecto}${filtroText} - ${fechaGeneracion}`;
    titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: "FF333333" } };
    ws.mergeCells(5, 1, 5, 11);

    const headerRowIndex = 7;
    const columns = [
      { key: "id", width: 8 },
      { key: "nombre_proyecto", width: 30 },
      { key: "pedido", width: 12 },
      { key: "clan", width: 12 },
      { key: "familia", width: 10 },
      { key: "proveedor", width: 18 },
      { key: "fecha_aprobacion", width: 16 },
      { key: "concepto", width: 18 },
      { key: "situaciones_especiales", width: 18 },
      { key: "importe", width: 14 },
    ];
    ws.columns = columns;
    const headerRow = ws.getRow(headerRowIndex);
    const headers = [
      "ID", "Nombre Proyecto", "Pedido", "Clan", "Familia",
      "Proveedor", "Fecha Aprobación", "Concepto", "Situaciones", "Importe",
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
    let totalImporte = 0;
    pedidos.forEach((p, i) => {
      const r = ws.getRow(startDataRow + i);
      r.getCell(1).value = p.id;
      r.getCell(2).value = p.nombre_proyecto;
      r.getCell(3).value = p.pedido;
      r.getCell(4).value = p.clan;
      r.getCell(5).value = p.familia;
      r.getCell(6).value = p.proveedor;
      r.getCell(7).value = p.fecha_aprobacion;
      r.getCell(8).value = p.concepto;
      r.getCell(9).value = p.situaciones_especiales || "";
      const importe = Number(p.importe || 0);
      r.getCell(10).value = importe;
      r.getCell(10).numFmt = "#,##0.00";
      r.getCell(10).alignment = { horizontal: "right" };
      totalImporte += importe;
    });

    const totalRowIndex = startDataRow + pedidos.length;
    const totalRow = ws.getRow(totalRowIndex);
    totalRow.getCell(9).value = "Total";
    totalRow.getCell(9).font = { bold: true };
    totalRow.getCell(9).alignment = { horizontal: "right" };
    totalRow.getCell(10).value = totalImporte;
    totalRow.getCell(10).numFmt = "#,##0.00";
    totalRow.getCell(10).font = { bold: true };
    totalRow.getCell(10).alignment = { horizontal: "right" };
    totalRow.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFDDDDDD" } },
        left: { style: "thin", color: { argb: "FFDDDDDD" } },
        bottom: { style: "thin", color: { argb: "FFDDDDDD" } },
        right: { style: "thin", color: { argb: "FFDDDDDD" } },
      };
    });

    ws.views = [{ state: "frozen", ySplit: headerRowIndex }];

    const filename = `explosion_insumos_proyecto_${id}${(familia && String(familia).trim() !== "") ? `_${String(familia).replace(/[^A-Za-z0-9_-]+/g, "-")}` : ""}_${fechaGeneracion}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Error generando XLSX:", err);
    res.status(500).json({ success: false, message: "Error generando archivo" });
  }
}
