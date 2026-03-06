import * as ProyectoModel from "../models/proyecto.model.js";
import * as ExplosionModel from "../models/explosionInsumo.model.js";
import { calcularImporteDesdeDetalles } from "../models/pedido.model.js";
import { parseBudgetValue } from "../helpers/utils.js";

export async function listar(req, res) {
  try {
    const results = await ProyectoModel.findAll();
    res.json({ success: true, data: results });
  } catch (err) {
    console.error("Error consultando proyectos:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}

export async function crear(req, res) {
  try {
    const {
      nombre,
      fecha_proyecto,
      presupuesto_cristal,
      presupuesto_aluminio,
      presupuesto_miscelaneos,
      miscel_familias,
      presupuesto,
    } = req.body || {};

    const parseBudget = (raw) => {
      if (raw === undefined || raw === null || String(raw).trim() === "") return null;
      const num = Number(raw);
      if (!Number.isFinite(num) || num < 0) return null;
      return Number(num.toFixed(2));
    };

    let presupuestoCristal = parseBudget(presupuesto_cristal);
    let presupuestoAluminio = parseBudget(presupuesto_aluminio);

    // Calcular presupuestoMiscelaneos desde miscel_familias si se proporcionan
    const familiaRows = Array.isArray(miscel_familias) ? miscel_familias : [];
    let presupuestoMiscelaneos;
    if (familiaRows.length > 0) {
      presupuestoMiscelaneos = Number(
        familiaRows.reduce((sum, f) => {
          const n = Number(f.presupuesto);
          return Number.isFinite(n) && n >= 0 ? sum + n : sum;
        }, 0).toFixed(2)
      );
    } else {
      presupuestoMiscelaneos = parseBudget(presupuesto_miscelaneos);
    }

    const algunPresupuesto =
      presupuestoCristal !== null || presupuestoAluminio !== null || presupuestoMiscelaneos !== null;

    if (!algunPresupuesto) {
      const legado = parseBudget(presupuesto);
      if (legado !== null) {
        presupuestoMiscelaneos = legado;
      }
    }

    presupuestoCristal = presupuestoCristal ?? 0;
    presupuestoAluminio = presupuestoAluminio ?? 0;
    presupuestoMiscelaneos = presupuestoMiscelaneos ?? 0;

    const presupuestoTotal = Number((presupuestoCristal + presupuestoAluminio + presupuestoMiscelaneos).toFixed(2));
    if (!nombre || !fecha_proyecto || !Number.isFinite(presupuestoTotal) || presupuestoTotal < 0) {
      return res.status(400).json({ success: false, message: "Faltan datos o presupuestos inválidos" });
    }

    const result = await ProyectoModel.create({
      nombre,
      fecha_proyecto,
      presupuestoCristal,
      presupuestoAluminio,
      presupuestoMiscelaneos,
      presupuestoTotal,
    });

    // Crear registros de explosion_insumos para las familias de misceláneos
    for (const f of familiaRows) {
      const familia = String(f.familia || "").trim().toUpperCase();
      const pres = Number(f.presupuesto);
      if (familia && Number.isFinite(pres) && pres >= 0) {
        try {
          await ExplosionModel.create(result.insertId, "", familia, pres);
        } catch (explErr) {
          console.error(`No se pudo crear explosion_insumos para familia ${familia}:`, explErr);
        }
      }
    }

    try {
      await ProyectoModel.registrarHistorialPresupuesto(result.insertId, {
        fecha: fecha_proyecto,
        presupuesto_cristal: presupuestoCristal,
        presupuesto_aluminio: presupuestoAluminio,
        presupuesto_miscelaneos: presupuestoMiscelaneos,
        presupuesto_total: presupuestoTotal,
      });
    } catch (histErr) {
      console.error("No se pudo registrar historial inicial de presupuesto:", histErr);
    }
    res.status(201).json({
      success: true,
      data: {
        id_proyecto: result.insertId,
        nombre,
        fecha_proyecto,
        presupuesto: presupuestoTotal,
        presupuesto_total: presupuestoTotal,
        presupuesto_cristal: presupuestoCristal,
        presupuesto_aluminio: presupuestoAluminio,
        presupuesto_miscelaneos: presupuestoMiscelaneos,
      },
    });
  } catch (err) {
    console.error("Error creando proyecto:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}

export async function actualizarEstado(req, res) {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    if (!estado || !['en_progreso', 'completado'].includes(estado)) {
      return res.status(400).json({
        success: false,
        message: "Estado inválido. Debe ser 'en_progreso' o 'completado'"
      });
    }

    const result = await ProyectoModel.updateEstado(id, estado);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Proyecto no encontrado" });
    }

    res.json({ success: true, message: `Estado actualizado a '${estado}'`, estado });
  } catch (err) {
    console.error("Error actualizando estado del proyecto:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}

export async function eliminar(req, res) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: "Proyecto no especificado" });
    }
    const result = await ProyectoModel.deleteById(id);
    if (!result || result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Proyecto no encontrado" });
    }
    return res.json({ success: true, message: "Proyecto eliminado correctamente" });
  } catch (err) {
    console.error("Error eliminando proyecto:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}

export async function obtenerPorId(req, res) {
  try {
    const { id } = req.params;
    const proyecto = await ProyectoModel.findById(id);
    if (!proyecto) {
      return res.status(404).json({ success: false, message: "No encontrado" });
    }
    const presupuestoCristal = Number(proyecto.presupuesto_cristal || 0);
    const presupuestoAluminio = Number(proyecto.presupuesto_aluminio || 0);
    const presupuestoMiscelaneos = Number(proyecto.presupuesto_miscelaneos || 0);
    let presupuestoTotal = Number(proyecto.presupuesto_total || 0);
    if (!Number.isFinite(presupuestoTotal) || presupuestoTotal === 0) {
      presupuestoTotal = Number((presupuestoCristal + presupuestoAluminio + presupuestoMiscelaneos).toFixed(2));
    }
    const baseProyecto = {
      ...proyecto,
      presupuesto_cristal: presupuestoCristal,
      presupuesto_aluminio: presupuestoAluminio,
      presupuesto_miscelaneos: presupuestoMiscelaneos,
      presupuesto_total: presupuestoTotal,
      presupuesto: Number(proyecto.presupuesto ?? presupuestoTotal ?? 0),
      presupuesto_disponible: presupuestoTotal,
    };
    try {
      const { getPedidosForRecalc } = await import("../models/pedido.model.js");
      const pedidosRows = await getPedidosForRecalc(id);
      let totalRecalc = 0;
      for (const row of pedidosRows || []) {
        const importe = await calcularImporteDesdeDetalles(row, { includeSubtotal: false });
        totalRecalc += Number(importe || 0);
      }
      const totalFix = Number(totalRecalc.toFixed(2));
      res.json({
        success: true,
        data: {
          ...baseProyecto,
          total_pedidos: totalFix,
        },
      });
    } catch (calcErr) {
      console.error("Error recalculando totales del proyecto:", calcErr);
      res.json({ success: true, data: baseProyecto });
    }
  } catch (err) {
    console.error("Error consultando proyecto:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}

export async function actualizarPresupuesto(req, res) {
  try {
    const { id } = req.params;
    const proyectoId = Number(id);
    if (!Number.isInteger(proyectoId) || proyectoId <= 0) {
      return res.status(400).json({ success: false, message: "Proyecto inválido" });
    }
    const { presupuesto_cristal, presupuesto_aluminio, presupuesto_miscelaneos, fecha_presupuesto } = req.body || {};
    const actuales = await ProyectoModel.getBudgets(proyectoId);
    if (!actuales) {
      return res.status(404).json({ success: false, message: "Proyecto no encontrado" });
    }
    // Los valores del usuario representan el NUEVO TOTAL de presupuesto (no el restante)
    const cristalInput = parseBudgetValue(presupuesto_cristal);
    const aluminioInput = parseBudgetValue(presupuesto_aluminio);
    const miscelaneosInput = parseBudgetValue(presupuesto_miscelaneos);
    const inputsProvided = [cristalInput, aluminioInput, miscelaneosInput];
    if (inputsProvided.some((v) => v !== null && (!Number.isFinite(v) || v < 0))) {
      return res.status(400).json({ success: false, message: "Presupuestos inválidos" });
    }
    // Obtener lo ya gastado en pedidos para calcular el nuevo saldo restante
    const { gastadoCristal, gastadoAluminio, gastadoMiscelaneos } =
      await ProyectoModel.getGastadoPorCategoria(proyectoId);
    // Nuevo saldo restante = nuevo total ingresado - ya gastado
    // Si no se provee un valor, se conserva el saldo actual sin cambio
    const cristal = cristalInput !== null
      ? Number((cristalInput - gastadoCristal).toFixed(2))
      : Number(actuales.presupuesto_cristal || 0);
    const aluminio = aluminioInput !== null
      ? Number((aluminioInput - gastadoAluminio).toFixed(2))
      : Number(actuales.presupuesto_aluminio || 0);
    const miscelaneos = miscelaneosInput !== null
      ? Number((miscelaneosInput - gastadoMiscelaneos).toFixed(2))
      : Number(actuales.presupuesto_miscelaneos || 0);
    const total = Number((cristal + aluminio + miscelaneos).toFixed(2));
    await ProyectoModel.updateBudgets(proyectoId, { cristal, aluminio, miscelaneos, total });
    // Historial guarda el total presupuestado (lo que el usuario ingresó), no el restante
    const cristalHist = cristalInput !== null ? cristalInput : Number((actuales.presupuesto_cristal || 0) + gastadoCristal);
    const aluminioHist = aluminioInput !== null ? aluminioInput : Number((actuales.presupuesto_aluminio || 0) + gastadoAluminio);
    const miscelaneosHist = miscelaneosInput !== null ? miscelaneosInput : Number((actuales.presupuesto_miscelaneos || 0) + gastadoMiscelaneos);
    try {
      await ProyectoModel.registrarHistorialPresupuesto(proyectoId, {
        fecha: fecha_presupuesto,
        presupuesto_cristal: cristalHist,
        presupuesto_aluminio: aluminioHist,
        presupuesto_miscelaneos: miscelaneosHist,
        presupuesto_total: Number((cristalHist + aluminioHist + miscelaneosHist).toFixed(2)),
      });
    } catch (histErr) {
      console.error("No se pudo registrar historial de cambio de presupuesto:", histErr);
    }
    return res.json({
      success: true,
      data: {
        id_proyecto: proyectoId,
        presupuesto_cristal: cristal,
        presupuesto_aluminio: aluminio,
        presupuesto_miscelaneos: miscelaneos,
        presupuesto_total: total,
        presupuesto: total,
      },
    });
  } catch (err) {
    console.error("Error actualizando presupuesto del proyecto:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}

export async function historialPresupuestos(req, res) {
  try {
    const { id } = req.params;
    const proyectoId = Number(id);
    if (!Number.isInteger(proyectoId) || proyectoId <= 0) {
      return res.status(400).json({ success: false, message: "Proyecto inválido" });
    }
    const rows = await ProyectoModel.getBudgetHistory(proyectoId);
    res.json({ success: true, data: rows || [] });
  } catch (err) {
    console.error("Error consultando historial de presupuestos:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}
