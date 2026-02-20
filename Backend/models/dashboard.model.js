import { queryAsync } from "../config/db.js";

// ==================== GLOBAL DASHBOARDS ====================

/**
 * Dashboard Ejecutivo - KPIs, estados, tendencias
 */
export async function getEjecutivoKpis() {
  // KPIs principales
  const kpisQuery = `
      SELECT
        COUNT(*) as totalProyectos,
        SUM(CASE WHEN estado = 'en_progreso' THEN 1 ELSE 0 END) as proyectosActivos,
        COALESCE(SUM(COALESCE(p.presupuesto_total, p.presupuesto, 0)), 0) as presupuestoTotal,
        COALESCE(SUM(COALESCE(pe.total_pedidos, 0)), 0) as presupuestoEjecutado
      FROM proyectos p
      LEFT JOIN (
        SELECT id_proyecto, SUM(importe_total) as total_pedidos
        FROM pedidos
        GROUP BY id_proyecto
      ) pe ON p.id_proyecto = pe.id_proyecto
    `;
  const kpisResult = await queryAsync(kpisQuery);

  // Proyectos por estado
  const estadosQuery = `
      SELECT
        CASE
          WHEN estado = 'en_progreso' THEN 'En Progreso'
          WHEN estado = 'completado' THEN 'Completado'
          ELSE 'Desconocido'
        END as estado,
        COUNT(*) as cantidad
      FROM proyectos
      GROUP BY estado
    `;
  const proyectosPorEstado = await queryAsync(estadosQuery);

  // Tendencia de presupuesto mensual (ultimos 6 meses)
  const tendenciaQuery = `
      SELECT
        DATE_FORMAT(fecha_proyecto, '%Y-%m') as mes,
        SUM(COALESCE(presupuesto_total, presupuesto, 0)) as presupuesto
      FROM proyectos
      WHERE fecha_proyecto >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(fecha_proyecto, '%Y-%m')
      ORDER BY mes ASC
    `;
  const tendenciaPresupuesto = await queryAsync(tendenciaQuery);

  // Proyectos creados por mes
  const completadosQuery = `
      SELECT
        DATE_FORMAT(fecha_proyecto, '%Y-%m') as mes,
        COUNT(*) as cantidad
      FROM proyectos
      WHERE fecha_proyecto >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(fecha_proyecto, '%Y-%m')
      ORDER BY mes ASC
    `;
  const proyectosCompletados = await queryAsync(completadosQuery);

  return {
    kpisResult,
    proyectosPorEstado,
    tendenciaPresupuesto,
    proyectosCompletados,
  };
}

/**
 * Dashboard Presupuestos - KPIs, distribucion, variacion
 */
export async function getPresupuestosDashboard() {
  // KPIs de presupuestos
  const kpisQuery = `
      SELECT
        COALESCE(SUM(
          COALESCE(
            (SELECT presupuesto_total
             FROM proyectos_presupuestos_historial h
             WHERE h.id_proyecto = p.id_proyecto
             ORDER BY fecha_presupuesto ASC
             LIMIT 1),
            COALESCE(p.presupuesto_total, p.presupuesto, 0) + COALESCE(pe.total_pedidos, 0)
          )
        ), 0) as presupuestoTotal,
        COALESCE(SUM(COALESCE(pe.total_pedidos, 0)), 0) as presupuestoEjecutado
      FROM proyectos p
      LEFT JOIN (
        SELECT id_proyecto, SUM(importe_total) as total_pedidos
        FROM pedidos
        GROUP BY id_proyecto
      ) pe ON p.id_proyecto = pe.id_proyecto
    `;
  const kpisResult = await queryAsync(kpisQuery);

  // Distribucion por categoria
  const categoriaQuery = `
      SELECT
        'Cristal' as categoria,
        SUM(COALESCE(presupuesto_cristal, 0)) as monto
      FROM proyectos
      UNION ALL
      SELECT
        'Aluminio' as categoria,
        SUM(COALESCE(presupuesto_aluminio, 0)) as monto
      FROM proyectos
      UNION ALL
      SELECT
        'Misceláneos' as categoria,
        SUM(COALESCE(presupuesto_miscelaneos, 0)) as monto
      FROM proyectos
    `;
  const distribucionPorCategoria = await queryAsync(categoriaQuery);

  // Top proyectos por inversion
  const topProyectosQuery = `
      SELECT
        nombre,
        COALESCE(presupuesto_total, presupuesto, 0) as presupuesto
      FROM proyectos
      ORDER BY presupuesto DESC
      LIMIT 10
    `;
  const topProyectos = await queryAsync(topProyectosQuery);

  // Variacion presupuestal
  const variacionQuery = `
      SELECT
        p.nombre as proyecto,
        COALESCE(
          (SELECT presupuesto_total
           FROM proyectos_presupuestos_historial h
           WHERE h.id_proyecto = p.id_proyecto
           ORDER BY fecha_presupuesto ASC
           LIMIT 1),
          COALESCE(p.presupuesto_total, p.presupuesto, 0) + COALESCE(total_ejecutado.ejecutado, 0)
        ) as planeado,
        COALESCE(total_ejecutado.ejecutado, 0) as ejecutado
      FROM proyectos p
      LEFT JOIN (
        SELECT id_proyecto, SUM(importe_total) as ejecutado
        FROM pedidos
        GROUP BY id_proyecto
      ) total_ejecutado ON p.id_proyecto = total_ejecutado.id_proyecto
      GROUP BY p.id_proyecto, p.nombre, p.presupuesto_total, p.presupuesto
      ORDER BY planeado DESC
      LIMIT 10
    `;
  const variacionPresupuestal = await queryAsync(variacionQuery);

  return {
    kpisResult,
    distribucionPorCategoria,
    topProyectos,
    variacionPresupuestal,
  };
}

/**
 * Dashboard Proyectos - KPIs, estados, criticos, timeline
 */
export async function getProyectosDashboard() {
  // KPIs de proyectos
  const kpisQuery = `
      SELECT
        COUNT(*) as totalProyectos,
        SUM(CASE WHEN estado = 'en_progreso' THEN 1 ELSE 0 END) as proyectosEnProgreso,
        SUM(CASE WHEN estado = 'completado' THEN 1 ELSE 0 END) as proyectosCompletados,
        SUM(CASE WHEN estado = 'en_progreso' AND fecha_proyecto >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as proyectosPendientes
      FROM proyectos
    `;
  const kpisResult = await queryAsync(kpisQuery);

  // Proyectos por estado
  const estadosQuery = `
      SELECT
        CASE
          WHEN estado = 'en_progreso' THEN 'En Progreso'
          WHEN estado = 'completado' THEN 'Completado'
          ELSE 'Desconocido'
        END as estado,
        COUNT(*) as cantidad
      FROM proyectos
      GROUP BY estado
    `;
  const proyectosPorEstado = await queryAsync(estadosQuery);

  // Proyectos criticos (con presupuesto > 60% utilizado)
  const criticosQuery = `
      SELECT
        p.id_proyecto as id,
        p.nombre,
        CASE
          WHEN p.estado = 'en_progreso' THEN 'En Progreso'
          WHEN p.estado = 'completado' THEN 'Completado'
          ELSE 'Desconocido'
        END as estado,
        CASE
          WHEN COALESCE(p.presupuesto_total, p.presupuesto, 0) > 0
          THEN (COALESCE(SUM(pe.importe_total), 0) / COALESCE(p.presupuesto_total, p.presupuesto, 1)) * 100
          ELSE 0
        END as presupuestoUtilizado,
        GREATEST(0, DATEDIFF(DATE_ADD(p.fecha_proyecto, INTERVAL 90 DAY), NOW())) as diasRestantes
      FROM proyectos p
      LEFT JOIN pedidos pe ON p.id_proyecto = pe.id_proyecto
      GROUP BY p.id_proyecto, p.nombre, p.presupuesto_total, p.presupuesto, p.fecha_proyecto
      HAVING presupuestoUtilizado > 60 OR diasRestantes < 30
      ORDER BY presupuestoUtilizado DESC, diasRestantes ASC
      LIMIT 10
    `;
  const proyectosCriticos = await queryAsync(criticosQuery);

  // Timeline de proyectos (ultimos 6 meses)
  const timelineQuery = `
      SELECT
        DATE_FORMAT(fecha_proyecto, '%Y-%m') as mes,
        COUNT(*) as iniciados,
        SUM(CASE WHEN fecha_proyecto < DATE_SUB(NOW(), INTERVAL 90 DAY) THEN 1 ELSE 0 END) as completados
      FROM proyectos
      WHERE fecha_proyecto >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(fecha_proyecto, '%Y-%m')
      ORDER BY mes ASC
    `;
  const timelineProyectos = await queryAsync(timelineQuery);

  return {
    kpisResult,
    proyectosPorEstado,
    proyectosCriticos,
    timelineProyectos,
  };
}

/**
 * Dashboard Materiales - KPIs, materiales, costos, proveedores, proyeccion
 */
export async function getMaterialesDashboard() {
  // KPIs de materiales
  const kpisQuery = `
      SELECT
        COUNT(DISTINCT concepto) as totalMateriales,
        COALESCE(SUM(importe_total), 0) as valorTotalInventario
      FROM pedidos
    `;
  const kpisResult = await queryAsync(kpisQuery);

  // Materiales mas usados
  const materialesQuery = `
      SELECT
        descripcion as material,
        SUM(cantidad) as cantidad,
        'unidad' as unidad
      FROM pedidos_detalles_miscelaneos
      GROUP BY descripcion
      ORDER BY cantidad DESC
      LIMIT 15
    `;
  const materialesMasUsados = await queryAsync(materialesQuery);

  // Costo por categoria
  const costoCategoriaQuery = `
      SELECT
        'Mano de Obra' as categoria,
        COALESCE(SUM(importe_total), 0) as costo
      FROM pedidos
      WHERE LOWER(concepto) LIKE '%mano%' OR LOWER(concepto) LIKE '%trabajo%'
      UNION ALL
      SELECT
        'Materiales' as categoria,
        COALESCE(SUM(importe_total), 0) as costo
      FROM pedidos
      WHERE LOWER(concepto) LIKE '%material%' OR LOWER(concepto) LIKE '%aluminio%' OR LOWER(concepto) LIKE '%cristal%'
      UNION ALL
      SELECT
        'Otros' as categoria,
        COALESCE(SUM(importe_total), 0) as costo
      FROM pedidos
      WHERE NOT (
        LOWER(concepto) LIKE '%mano%' OR
        LOWER(concepto) LIKE '%trabajo%' OR
        LOWER(concepto) LIKE '%material%' OR
        LOWER(concepto) LIKE '%aluminio%' OR
        LOWER(concepto) LIKE '%cristal%'
      )
    `;
  const costoPorCategoria = await queryAsync(costoCategoriaQuery);

  // Proveedores principales
  const proveedoresQuery = `
      SELECT
        proveedor,
        COUNT(*) as volumen
      FROM pedidos
      WHERE proveedor IS NOT NULL AND proveedor != ''
      GROUP BY proveedor
      ORDER BY volumen DESC
      LIMIT 10
    `;
  const proveedoresPrincipales = await queryAsync(proveedoresQuery);

  // Proyeccion de compras
  const proyeccionQuery = `
      SELECT
        ei.familia as material,
        SUM(ei.presupuesto_asignado) as cantidadRequerida,
        0 as cantidadDisponible,
        SUM(ei.presupuesto_asignado) as deficit,
        SUM(ei.presupuesto_asignado) as costoEstimado
      FROM explosion_insumos ei
      INNER JOIN proyectos p ON ei.id_proyecto = p.id_proyecto
      WHERE p.estado = 'en_progreso'
      GROUP BY ei.familia
      ORDER BY deficit DESC
      LIMIT 15
    `;
  const proyeccionCompras = await queryAsync(proyeccionQuery);

  // Tendencia de costos mensual
  const tendenciaCostosQuery = `
      SELECT
        DATE_FORMAT(fecha_aprobacion, '%Y-%m') as mes,
        SUM(importe_total) as costo
      FROM pedidos
      WHERE fecha_aprobacion >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(fecha_aprobacion, '%Y-%m')
      ORDER BY mes ASC
    `;
  const tendenciaCostos = await queryAsync(tendenciaCostosQuery);

  return {
    kpisResult,
    materialesMasUsados,
    costoPorCategoria,
    proveedoresPrincipales,
    proyeccionCompras,
    tendenciaCostos,
  };
}

// ==================== PER-PROJECT DASHBOARDS ====================

/**
 * Dashboard Ejecutivo por Proyecto
 */
export async function getProyectoEjecutivo(id) {
  // Info del proyecto
  const proyectoQuery = `
      SELECT
        p.id_proyecto,
        p.nombre,
        p.estado,
        p.fecha_proyecto,
        COALESCE(p.presupuesto_total, p.presupuesto, 0) as presupuestoTotal,
        COALESCE(p.presupuesto_cristal, 0) as presupuestoCristal,
        COALESCE(p.presupuesto_aluminio, 0) as presupuestoAluminio,
        COALESCE(p.presupuesto_miscelaneos, 0) as presupuestoMiscelaneos,
        COALESCE(pe.total_pedidos, 0) as presupuestoEjecutado
      FROM proyectos p
      LEFT JOIN (
        SELECT id_proyecto, SUM(importe_total) as total_pedidos
        FROM pedidos
        GROUP BY id_proyecto
      ) pe ON p.id_proyecto = pe.id_proyecto
      WHERE p.id_proyecto = ?
    `;
  const proyectoResult = await queryAsync(proyectoQuery, [id]);

  // Gastos por mes del proyecto
  const gastosMensualesQuery = `
      SELECT
        DATE_FORMAT(fecha_aprobacion, '%Y-%m') as mes,
        SUM(importe_total) as gasto
      FROM pedidos
      WHERE id_proyecto = ? AND fecha_aprobacion IS NOT NULL
      GROUP BY DATE_FORMAT(fecha_aprobacion, '%Y-%m')
      ORDER BY mes ASC
      LIMIT 12
    `;
  const gastosMensuales = await queryAsync(gastosMensualesQuery, [id]);

  // Pedidos por concepto
  const pedidosConceptoQuery = `
      SELECT
        concepto,
        COUNT(*) as cantidad,
        SUM(importe_total) as total
      FROM pedidos
      WHERE id_proyecto = ?
      GROUP BY concepto
      ORDER BY total DESC
      LIMIT 10
    `;
  const pedidosPorConcepto = await queryAsync(pedidosConceptoQuery, [id]);

  return {
    proyectoResult,
    gastosMensuales,
    pedidosPorConcepto,
  };
}

/**
 * Dashboard Materiales por Proyecto
 */
export async function getProyectoMateriales(id) {
  // Verificar proyecto existe
  const proyectoQuery = `SELECT id_proyecto, nombre FROM proyectos WHERE id_proyecto = ?`;
  const proyectoResult = await queryAsync(proyectoQuery, [id]);

  // Materiales usados en miscelaneos (tabla puede no existir)
  let materialesUsados = [];
  try {
    const materialesQuery = `
        SELECT
          pdm.descripcion as material,
          SUM(pdm.cantidad) as cantidad,
          SUM(pdm.importe) as costoTotal
        FROM pedidos_detalles_miscelaneos pdm
        INNER JOIN pedidos p ON pdm.id_pedido = p.id_pedido
        WHERE p.id_proyecto = ?
        GROUP BY pdm.descripcion
        ORDER BY costoTotal DESC
        LIMIT 15
      `;
    materialesUsados = await queryAsync(materialesQuery, [id]);
  } catch (matErr) {
    console.log("Tabla pedidos_detalles_miscelaneos no disponible");
  }

  // Explosion de insumos del proyecto (tabla puede no existir)
  let explosionInsumos = [];
  try {
    const explosionQuery = `
        SELECT
          familia,
          clan,
          presupuesto_asignado
        FROM explosion_insumos
        WHERE id_proyecto = ?
        ORDER BY presupuesto_asignado DESC
      `;
    explosionInsumos = await queryAsync(explosionQuery, [id]);
  } catch (expErr) {
    console.log("Tabla explosion_insumos no disponible");
  }

  // Costo por tipo de pedido
  const costoTipoQuery = `
      SELECT
        concepto as tipo,
        COUNT(*) as cantidad,
        SUM(importe_total) as costoTotal
      FROM pedidos
      WHERE id_proyecto = ?
      GROUP BY concepto
      ORDER BY costoTotal DESC
    `;
  const costoPorTipo = await queryAsync(costoTipoQuery, [id]);

  // Proveedores del proyecto
  const proveedoresQuery = `
      SELECT
        proveedor,
        COUNT(*) as cantidadPedidos,
        SUM(importe_total) as totalCompras
      FROM pedidos
      WHERE id_proyecto = ? AND proveedor IS NOT NULL AND proveedor != ''
      GROUP BY proveedor
      ORDER BY totalCompras DESC
      LIMIT 10
    `;
  const proveedores = await queryAsync(proveedoresQuery, [id]);

  // KPIs
  const kpisQuery = `
      SELECT
        COUNT(DISTINCT concepto) as totalConceptos,
        COALESCE(SUM(importe_total), 0) as totalGastado,
        COUNT(*) as totalPedidos
      FROM pedidos
      WHERE id_proyecto = ?
    `;
  const kpisResult = await queryAsync(kpisQuery, [id]);

  return {
    proyectoResult,
    materialesUsados,
    explosionInsumos,
    costoPorTipo,
    proveedores,
    kpisResult,
  };
}

/**
 * Dashboard Presupuestos por Proyecto
 */
export async function getProyectoPresupuestos(id) {
  // Obtener informacion del proyecto
  const proyectoRows = await queryAsync(
    `SELECT id_proyecto, nombre, presupuesto_total, presupuesto_cristal, presupuesto_aluminio, presupuesto_miscelaneos
     FROM proyectos WHERE id_proyecto = ?`,
    [id]
  );

  // Obtener total gastado por familia
  const gastadoPorFamilia = await queryAsync(
    `SELECT familia, SUM(importe_total) as total
     FROM pedidos
     WHERE id_proyecto = ?
     GROUP BY familia`,
    [id]
  );

  // Historial de presupuestos
  const historialRows = await queryAsync(
    `SELECT fecha_presupuesto as fecha, presupuesto_total as presupuesto, 'Actualización de presupuesto' as motivo
     FROM proyectos_presupuestos_historial
     WHERE id_proyecto = ?
     ORDER BY fecha_presupuesto DESC
     LIMIT 10`,
    [id]
  );

  // Pedidos mas costosos
  const pedidosCostosos = await queryAsync(
    `SELECT id, concepto, proveedor, importe_total as importe, fecha_aprobacion as fecha
     FROM pedidos
     WHERE id_proyecto = ?
     ORDER BY importe_total DESC
     LIMIT 10`,
    [id]
  );

  return {
    proyectoRows,
    gastadoPorFamilia,
    historialRows,
    pedidosCostosos,
  };
}

/**
 * Dashboard General por Proyecto
 */
export async function getProyectoGeneral(id) {
  // Obtener informacion del proyecto
  const proyectoRows = await queryAsync(
    `SELECT id_proyecto, nombre, estado, fecha_proyecto, presupuesto_total
     FROM proyectos WHERE id_proyecto = ?`,
    [id]
  );

  // Obtener total gastado
  const totalGastadoRows = await queryAsync(
    `SELECT SUM(importe_total) as total FROM pedidos WHERE id_proyecto = ?`,
    [id]
  );

  // Cantidad de pedidos y proveedores
  const estadisticasRows = await queryAsync(
    `SELECT COUNT(DISTINCT id) as cantidadPedidos, COUNT(DISTINCT proveedor) as cantidadProveedores
     FROM pedidos WHERE id_proyecto = ?`,
    [id]
  );

  // Proveedores con mas compras
  const proveedoresRows = await queryAsync(
    `SELECT proveedor, COUNT(*) as cantidadPedidos, SUM(importe_total) as totalCompras
     FROM pedidos
     WHERE id_proyecto = ?
     GROUP BY proveedor
     ORDER BY totalCompras DESC
     LIMIT 5`,
    [id]
  );

  // Timeline de pedidos por mes
  const timelineRows = await queryAsync(
    `SELECT
       DATE_FORMAT(fecha_aprobacion, '%Y-%m') as mes,
       COUNT(*) as cantidadPedidos,
       SUM(importe_total) as totalMes
     FROM pedidos
     WHERE id_proyecto = ?
     GROUP BY DATE_FORMAT(fecha_aprobacion, '%Y-%m')
     ORDER BY mes ASC`,
    [id]
  );

  // Ultimos pedidos
  const ultimosPedidosRows = await queryAsync(
    `SELECT id, concepto, proveedor, importe_total as importe, fecha_aprobacion as fecha, 'pendiente' as estatusPago
     FROM pedidos
     WHERE id_proyecto = ?
     ORDER BY fecha_aprobacion DESC
     LIMIT 10`,
    [id]
  );

  return {
    proyectoRows,
    totalGastadoRows,
    estadisticasRows,
    proveedoresRows,
    timelineRows,
    ultimosPedidosRows,
  };
}
