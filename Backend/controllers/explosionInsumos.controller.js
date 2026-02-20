import * as ExplosionModel from "../models/explosionInsumo.model.js";
import {
  normalizeTextValue,
  parseBudgetValue,
  redondearMoneda,
  claveExplosion,
} from "../helpers/utils.js";

export async function listar(req, res) {
  try {
    const proyectoId = Number(req.params.id);
    if (!Number.isInteger(proyectoId) || proyectoId <= 0) {
      return res.status(400).json({ success: false, message: "Proyecto inválido" });
    }
    const ctx = await ExplosionModel.obtenerContextoExplosion(proyectoId);
    const rows = await ExplosionModel.findByProyecto(proyectoId);
    const data = (rows || []).map((row) => {
      const key = claveExplosion(row?.clan, row?.familia);
      const gastado = redondearMoneda(ctx.gastoPorClave.get(key) || 0);
      const presupuestoAsignado = redondearMoneda(row?.presupuesto_asignado);
      const restante = redondearMoneda(presupuestoAsignado - gastado);
      return {
        id: row.id,
        clan: normalizeTextValue(row?.clan),
        familia: normalizeTextValue(row?.familia),
        presupuesto_asignado: presupuestoAsignado,
        gastado,
        presupuesto_restante: restante,
        presupuesto_usado: restante,
      };
    });
    res.json({
      success: true,
      data,
      total_asignado: ctx.totalAsignado,
      presupuesto_miscelaneos_base: ctx.baseMiscelaneos,
      presupuesto_miscelaneos_disponible: redondearMoneda(ctx.baseMiscelaneos - ctx.totalAsignado),
    });
  } catch (err) {
    if ((err?.message || "").includes("Proyecto no encontrado")) {
      return res.status(404).json({ success: false, message: "Proyecto no encontrado" });
    }
    console.error("Error consultando explosión de insumos:", err);
    res.status(500).json({ success: false, message: "Error interno al cargar explosión" });
  }
}

export async function crear(req, res) {
  try {
    const proyectoId = Number(req.params.id);
    if (!Number.isInteger(proyectoId) || proyectoId <= 0) {
      return res.status(400).json({ success: false, message: "Proyecto inválido" });
    }
    const { clan, familia, presupuesto_asignado } = req.body || {};
    const familiaVal = normalizeTextValue(familia);
    const clanVal = normalizeTextValue(clan);
    const familiaDb = familiaVal.toUpperCase();
    const clanDb = clanVal ? clanVal.toUpperCase() : "";
    const presupuestoNum = parseBudgetValue(presupuesto_asignado, { allowNull: false });
    if (!familiaDb) {
      return res.status(400).json({ success: false, message: "Familia requerida" });
    }
    if (!Number.isFinite(presupuestoNum) || presupuestoNum < 0) {
      return res.status(400).json({ success: false, message: "Presupuesto inválido" });
    }
    const ctx = await ExplosionModel.obtenerContextoExplosion(proyectoId);
    const nuevoTotal = redondearMoneda(ctx.totalAsignado + presupuestoNum);
    if (nuevoTotal - ctx.baseMiscelaneos > 0.01) {
      return res.status(400).json({
        success: false,
        message: "El presupuesto asignado supera el presupuesto total de misceláneos del proyecto",
      });
    }
    if (await ExplosionModel.findExisting(proyectoId, clanDb, familiaDb)) {
      return res.status(409).json({ success: false, message: "Ya existe una asignación para ese clan y familia" });
    }
    await ExplosionModel.create(proyectoId, clanDb, familiaDb, presupuestoNum);
    res.status(201).json({ success: true, message: "Presupuesto asignado guardado" });
  } catch (err) {
    if ((err?.message || "").includes("Proyecto no encontrado")) {
      return res.status(404).json({ success: false, message: "Proyecto no encontrado" });
    }
    console.error("Error creando explosión de insumos:", err);
    res.status(500).json({ success: false, message: "Error interno al guardar asignación" });
  }
}

export async function actualizar(req, res) {
  try {
    const proyectoId = Number(req.params.id);
    const explosionId = Number(req.params.explosionId);
    if (!Number.isInteger(proyectoId) || proyectoId <= 0 || !Number.isInteger(explosionId) || explosionId <= 0) {
      return res.status(400).json({ success: false, message: "Identificadores inválidos" });
    }
    const { clan, familia, presupuesto_asignado } = req.body || {};
    const familiaVal = normalizeTextValue(familia);
    const clanVal = normalizeTextValue(clan);
    const familiaDb = familiaVal.toUpperCase();
    const clanDb = clanVal ? clanVal.toUpperCase() : "";
    const presupuestoNum = parseBudgetValue(presupuesto_asignado, { allowNull: false });
    if (!familiaDb) {
      return res.status(400).json({ success: false, message: "Familia requerida" });
    }
    if (!Number.isFinite(presupuestoNum) || presupuestoNum < 0) {
      return res.status(400).json({ success: false, message: "Presupuesto inválido" });
    }
    const actual = await ExplosionModel.findById(explosionId, proyectoId);
    if (!actual) {
      return res.status(404).json({ success: false, message: "Asignación no encontrada" });
    }
    const ctx = await ExplosionModel.obtenerContextoExplosion(proyectoId);
    const nuevoTotal = redondearMoneda(ctx.totalAsignado - redondearMoneda(actual.presupuesto_asignado) + presupuestoNum);
    if (nuevoTotal - ctx.baseMiscelaneos > 0.01) {
      return res.status(400).json({
        success: false,
        message: "El presupuesto asignado supera el presupuesto total de misceláneos del proyecto",
      });
    }
    if (await ExplosionModel.findDuplicate(proyectoId, clanDb, familiaDb, explosionId)) {
      return res.status(409).json({ success: false, message: "Ya existe otra asignación con ese clan y familia" });
    }
    await ExplosionModel.update(explosionId, proyectoId, { clan: clanDb, familia: familiaDb, presupuesto: presupuestoNum });
    res.json({ success: true, message: "Asignación actualizada" });
  } catch (err) {
    if ((err?.message || "").includes("Proyecto no encontrado")) {
      return res.status(404).json({ success: false, message: "Proyecto no encontrado" });
    }
    console.error("Error actualizando explosión de insumos:", err);
    res.status(500).json({ success: false, message: "Error interno al actualizar asignación" });
  }
}

export async function eliminar(req, res) {
  try {
    const proyectoId = Number(req.params.id);
    const explosionId = Number(req.params.explosionId);
    if (!Number.isInteger(proyectoId) || proyectoId <= 0 || !Number.isInteger(explosionId) || explosionId <= 0) {
      return res.status(400).json({ success: false, message: "Identificadores inválidos" });
    }
    const result = await ExplosionModel.deleteById(explosionId, proyectoId);
    if (result?.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Asignación no encontrada" });
    }
    res.json({ success: true, message: "Asignación eliminada" });
  } catch (err) {
    console.error("Error eliminando explosión de insumos:", err);
    res.status(500).json({ success: false, message: "Error interno al eliminar asignación" });
  }
}
