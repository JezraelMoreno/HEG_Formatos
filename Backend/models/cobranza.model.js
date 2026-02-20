import { queryAsync } from "../config/db.js";

// ─── Cobranza Export (COBRANZA TOTAL — obras en proceso) ───────────────
export async function getCobranzaExportData() {
  const query = `
    SELECT
      p.id_proyecto,
      p.nombre AS proyecto,
      COALESCE(cp.codigo_control, '') AS codigo_control,
      COALESCE(p.presupuesto_total, p.presupuesto, 0) AS importe_contratado,
      COALESCE(facturas.total_cobrado, 0) AS importe_cobrado,
      (COALESCE(p.presupuesto_total, p.presupuesto, 0) - COALESCE(facturas.total_cobrado, 0)) AS importe_a_cobrar,
      COALESCE(cp.fondo_garantia, 0) AS fondo_garantia,
      (COALESCE(p.presupuesto_total, p.presupuesto, 0) - COALESCE(facturas.total_cobrado, 0) - COALESCE(cp.fondo_garantia, 0)) AS liquido_por_cobrar,
      COALESCE(facturas.saldo_pendiente, 0) AS facturas_por_cobrar,
      COALESCE(gastos_directos.total_pedidos, 0) AS total_pedidos,
      COALESCE(gastos_viaticos.total_viaticos, 0) AS total_viaticos,
      p.estado,
      COALESCE(cp.factor_indirectos, 0.20) AS factor_indirectos,
      COALESCE(cp.indirectos_aplicados, 0) AS indirectos_aplicados
    FROM proyectos p
    LEFT JOIN cobranza_proyecto cp ON cp.id_proyecto = p.id_proyecto
    LEFT JOIN (
      SELECT
        id_proyecto,
        SUM(importe_cobrado) AS total_cobrado,
        SUM(saldo_por_cobrar) AS saldo_pendiente
      FROM cobranza_facturas
      GROUP BY id_proyecto
    ) facturas ON facturas.id_proyecto = p.id_proyecto
    LEFT JOIN (
      SELECT id_proyecto, SUM(importe_total) AS total_pedidos
      FROM pedidos
      GROUP BY id_proyecto
    ) gastos_directos ON gastos_directos.id_proyecto = p.id_proyecto
    LEFT JOIN (
      SELECT id_proyecto, SUM(gastado) AS total_viaticos
      FROM viaticos_presupuestos
      GROUP BY id_proyecto
    ) gastos_viaticos ON gastos_viaticos.id_proyecto = p.id_proyecto
    WHERE p.estado = 'en_progreso'
    ORDER BY p.nombre ASC
  `;
  return queryAsync(query);
}

// ─── Cobranza General Export ───────────────────────────────────────────
export async function getCobranzaGeneralExportData() {
  const query = `
    SELECT
      p.id_proyecto,
      p.nombre AS proyecto,
      COALESCE(cp.codigo_control, '') AS codigo_control,
      COALESCE(p.presupuesto_total, p.presupuesto, 0) AS importe_contratado,
      COALESCE(facturas.total_cobrado, 0) AS importe_cobrado,
      (COALESCE(p.presupuesto_total, p.presupuesto, 0) - COALESCE(facturas.total_cobrado, 0)) AS importe_a_cobrar,
      COALESCE(cp.fondo_garantia, 0) AS fondo_garantia,
      (COALESCE(p.presupuesto_total, p.presupuesto, 0) - COALESCE(facturas.total_cobrado, 0) - COALESCE(cp.fondo_garantia, 0)) AS liquido_por_cobrar,
      COALESCE(facturas.saldo_pendiente, 0) AS facturas_por_cobrar,
      COALESCE(gastos.total_aplicado, 0) AS aplicado,
      (COALESCE(facturas.total_cobrado, 0) - COALESCE(gastos.total_aplicado, 0)) AS cobrado_vs_aplicado,
      p.estado
    FROM proyectos p
    LEFT JOIN cobranza_proyecto cp ON cp.id_proyecto = p.id_proyecto
    LEFT JOIN (
      SELECT
        id_proyecto,
        SUM(importe_cobrado) AS total_cobrado,
        SUM(saldo_por_cobrar) AS saldo_pendiente
      FROM cobranza_facturas
      GROUP BY id_proyecto
    ) facturas ON facturas.id_proyecto = p.id_proyecto
    LEFT JOIN (
      SELECT
        ped.id_proyecto,
        COALESCE(SUM(ped.importe_total), 0) + COALESCE(MAX(viat.total_viaticos), 0) AS total_aplicado
      FROM pedidos ped
      LEFT JOIN (
        SELECT id_proyecto, SUM(gastado) AS total_viaticos
        FROM viaticos_presupuestos
        GROUP BY id_proyecto
      ) viat ON viat.id_proyecto = ped.id_proyecto
      GROUP BY ped.id_proyecto
    ) gastos ON gastos.id_proyecto = p.id_proyecto
    ORDER BY p.nombre ASC
  `;
  return queryAsync(query);
}

// ─── Cobranza General (todos los proyectos con indirectos) ─────────────
export async function getCobranzaGeneral() {
  const query = `
    SELECT
      p.id_proyecto,
      p.nombre AS proyecto,
      COALESCE(cp.codigo_control, '') AS codigo_control,
      COALESCE(p.presupuesto_total, p.presupuesto, 0) AS importe_contratado,
      COALESCE(facturas.total_cobrado, 0) AS importe_cobrado,
      (COALESCE(p.presupuesto_total, p.presupuesto, 0) - COALESCE(facturas.total_cobrado, 0)) AS importe_a_cobrar,
      COALESCE(cp.fondo_garantia, 0) AS fondo_garantia,
      (COALESCE(p.presupuesto_total, p.presupuesto, 0) - COALESCE(facturas.total_cobrado, 0) - COALESCE(cp.fondo_garantia, 0)) AS liquido_por_cobrar,
      COALESCE(facturas.saldo_pendiente, 0) AS facturas_por_cobrar,
      COALESCE(gastos.total_aplicado, 0) AS aplicado,
      (COALESCE(facturas.total_cobrado, 0) - COALESCE(gastos.total_aplicado, 0)) AS cobrado_vs_aplicado,
      p.estado,
      COALESCE(cp.factor_indirectos, 0.20) AS factor_indirectos,
      COALESCE(cp.indirectos_aplicados, 0) AS indirectos_aplicados
    FROM proyectos p
    LEFT JOIN cobranza_proyecto cp ON cp.id_proyecto = p.id_proyecto
    LEFT JOIN (
      SELECT
        id_proyecto,
        SUM(importe_cobrado) AS total_cobrado,
        SUM(saldo_por_cobrar) AS saldo_pendiente
      FROM cobranza_facturas
      GROUP BY id_proyecto
    ) facturas ON facturas.id_proyecto = p.id_proyecto
    LEFT JOIN (
      SELECT
        p2.id_proyecto,
        COALESCE(SUM(ped.importe_total), 0) + COALESCE(viat.total_viaticos, 0) AS total_aplicado
      FROM proyectos p2
      LEFT JOIN pedidos ped ON ped.id_proyecto = p2.id_proyecto
      LEFT JOIN (
        SELECT id_proyecto, SUM(gastado) AS total_viaticos
        FROM viaticos_presupuestos
        GROUP BY id_proyecto
      ) viat ON viat.id_proyecto = p2.id_proyecto
      GROUP BY p2.id_proyecto, viat.total_viaticos
    ) gastos ON gastos.id_proyecto = p.id_proyecto
    ORDER BY p.nombre ASC
  `;
  return queryAsync(query);
}

// ─── Cobranza Resumen de un proyecto específico ────────────────────────
export async function getCobranzaResumen(proyectoId) {
  const query = `
    SELECT
      p.id_proyecto,
      p.nombre AS proyecto,
      COALESCE(cp.codigo_control, '') AS codigo_control,
      COALESCE(p.presupuesto_total, p.presupuesto, 0) AS importe_contratado,
      COALESCE(facturas.total_cobrado, 0) AS importe_cobrado,
      (COALESCE(p.presupuesto_total, p.presupuesto, 0) - COALESCE(facturas.total_cobrado, 0)) AS importe_a_cobrar,
      COALESCE(cp.fondo_garantia, 0) AS fondo_garantia,
      (COALESCE(p.presupuesto_total, p.presupuesto, 0) - COALESCE(facturas.total_cobrado, 0) - COALESCE(cp.fondo_garantia, 0)) AS liquido_por_cobrar,
      COALESCE(facturas.saldo_pendiente, 0) AS facturas_por_cobrar,
      COALESCE(gastos.total_pedidos, 0) AS total_pedidos,
      COALESCE(gastos.total_viaticos, 0) AS total_viaticos,
      (COALESCE(gastos.total_pedidos, 0) + COALESCE(gastos.total_viaticos, 0)) AS aplicado,
      (COALESCE(facturas.total_cobrado, 0) - COALESCE(gastos.total_pedidos, 0) - COALESCE(gastos.total_viaticos, 0)) AS cobrado_vs_aplicado,
      p.estado,
      COALESCE(cp.factor_indirectos, 0.20) AS factor_indirectos,
      COALESCE(cp.indirectos_aplicados, 0) AS indirectos_aplicados
    FROM proyectos p
    LEFT JOIN cobranza_proyecto cp ON cp.id_proyecto = p.id_proyecto
    LEFT JOIN (
      SELECT
        id_proyecto,
        SUM(importe_cobrado) AS total_cobrado,
        SUM(saldo_por_cobrar) AS saldo_pendiente
      FROM cobranza_facturas
      GROUP BY id_proyecto
    ) facturas ON facturas.id_proyecto = p.id_proyecto
    LEFT JOIN (
      SELECT
        p2.id_proyecto,
        COALESCE(SUM(ped.importe_total), 0) AS total_pedidos,
        COALESCE(viat.total_viaticos, 0) AS total_viaticos
      FROM proyectos p2
      LEFT JOIN pedidos ped ON ped.id_proyecto = p2.id_proyecto
      LEFT JOIN (
        SELECT id_proyecto, SUM(gastado) AS total_viaticos
        FROM viaticos_presupuestos
        GROUP BY id_proyecto
      ) viat ON viat.id_proyecto = p2.id_proyecto
      GROUP BY p2.id_proyecto, viat.total_viaticos
    ) gastos ON gastos.id_proyecto = p.id_proyecto
    WHERE p.id_proyecto = ?
  `;
  return queryAsync(query, [proyectoId]);
}

// ─── Upsert cobranza_proyecto (código control, fondo garantía, indirectos) ──
export async function updateCobranzaResumen(proyectoId, { codigo_control, fondo_garantia, factor_indirectos, indirectos_aplicados, username }) {
  const query = `
    INSERT INTO cobranza_proyecto (id_proyecto, codigo_control, fondo_garantia, factor_indirectos, indirectos_aplicados, nombre_usuario)
    VALUES (?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      codigo_control = COALESCE(VALUES(codigo_control), codigo_control),
      fondo_garantia = COALESCE(VALUES(fondo_garantia), fondo_garantia),
      factor_indirectos = COALESCE(VALUES(factor_indirectos), factor_indirectos),
      indirectos_aplicados = COALESCE(VALUES(indirectos_aplicados), indirectos_aplicados),
      nombre_usuario = VALUES(nombre_usuario)
  `;
  return queryAsync(query, [
    proyectoId,
    codigo_control || null,
    fondo_garantia,
    factor_indirectos,
    indirectos_aplicados,
    username,
  ]);
}

// ─── Facturas de cobranza de un proyecto ───────────────────────────────
export async function getFacturas(proyectoId) {
  const query = `
    SELECT
      id_factura,
      numero,
      DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha,
      numero_factura,
      concepto,
      importe_a_cobrar,
      importe_cobrado,
      saldo_por_cobrar,
      DATE_FORMAT(fecha_pago, '%Y-%m-%d') AS fecha_pago,
      periodo,
      nombre_usuario
    FROM cobranza_facturas
    WHERE id_proyecto = ?
    ORDER BY numero ASC, fecha_registro DESC
  `;
  return queryAsync(query, [proyectoId]);
}

// ─── Crear factura de cobranza ─────────────────────────────────────────
export async function createFactura(proyectoId, { numero, fecha, numero_factura, concepto, importe_a_cobrar, importe_cobrado, saldo_por_cobrar, fecha_pago, periodo, username }) {
  const query = `
    INSERT INTO cobranza_facturas
      (id_proyecto, numero, fecha, numero_factura, concepto, importe_a_cobrar, importe_cobrado, saldo_por_cobrar, fecha_pago, periodo, nombre_usuario)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  return queryAsync(query, [
    proyectoId,
    numero,
    fecha,
    numero_factura,
    concepto,
    importe_a_cobrar,
    importe_cobrado,
    saldo_por_cobrar,
    fecha_pago,
    periodo,
    username,
  ]);
}

// ─── Actualizar factura de cobranza ────────────────────────────────────
export async function updateFactura(idFactura, proyectoId, { numero, fecha, numero_factura, concepto, importe_a_cobrar, importe_cobrado, saldo_por_cobrar, fecha_pago, periodo, username }) {
  const query = `
    UPDATE cobranza_facturas SET
      numero = ?,
      fecha = ?,
      numero_factura = ?,
      concepto = ?,
      importe_a_cobrar = ?,
      importe_cobrado = ?,
      saldo_por_cobrar = ?,
      fecha_pago = ?,
      periodo = ?,
      nombre_usuario = ?
    WHERE id_factura = ? AND id_proyecto = ?
  `;
  return queryAsync(query, [
    numero,
    fecha,
    numero_factura,
    concepto,
    importe_a_cobrar,
    importe_cobrado,
    saldo_por_cobrar,
    fecha_pago,
    periodo,
    username,
    idFactura,
    proyectoId,
  ]);
}

// ─── Eliminar factura de cobranza ──────────────────────────────────────
export async function deleteFactura(idFactura, proyectoId) {
  return queryAsync(
    "DELETE FROM cobranza_facturas WHERE id_factura = ? AND id_proyecto = ?",
    [idFactura, proyectoId]
  );
}
