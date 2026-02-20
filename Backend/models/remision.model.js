import { queryAsync } from "../config/db.js";

// ---------------------------------------------------------------------------
// SQL base queries (aluminio / cristal) reutilizadas por varios endpoints
// ---------------------------------------------------------------------------

const BASE_ALUMINIO_PROJECT = `
  SELECT
    da.id_detalle as id_programacion,
    ped.id_proyecto,
    pr.nombre AS nombre_proyecto,
    ped.pedido as numero_pedido,
    '-' as subpedido,
    da.numero_perfil,
    da.descripcion,
    da.medida_tramo,
    da.peso_kg_ml,
    da.acabado,
    COALESCE(rc.cantidad_pedida, da.total_tramos, 0) as cantidad_pedida,
    COALESCE(rc.cantidad_recibida, 0) as cantidad_recibida,
    COALESCE(rc.cantidad_pedida, da.total_tramos, 0) - COALESCE(rc.cantidad_recibida, 0) as cantidad_saldo,
    COALESCE(rc.cantidad_extruido, 0) as cantidad_extruido,
    COALESCE(rc.cantidad_pintado, 0) as cantidad_pintado,
    COALESCE(da.kg, 0) as total_kg,
    (COALESCE(rc.cantidad_pedida, da.total_tramos, 0) - COALESCE(rc.cantidad_recibida, 0)) * COALESCE(da.medida_tramo, 0) * COALESCE(da.peso_kg_ml, 0) as kg_saldo,
    0 as kg_por_pintar,
    0 as kg_entrega,
    CASE WHEN COALESCE(rc.cantidad_pedida, da.total_tramos, 0) > 0
      THEN COALESCE(rc.cantidad_recibida, 0) / COALESCE(rc.cantidad_pedida, da.total_tramos, 1)
      ELSE 0 END as porcentaje_avance,
    ped.proveedor,
    COALESCE(rc.fecha_liberacion, ped.fecha_aprobacion) as fecha_liberacion,
    rc.fecha_entrega,
    NULL as fecha_entrega_desfazada,
    NULL as fecha_ultima_recepcion,
    COALESCE(rc.prioridad, 'C') as prioridad,
    rc.observaciones_proveedor,
    rc.observaciones_heg,
    'aluminio' as tipo_material
  FROM pedidos_detalles_aluminio da
  JOIN pedidos ped ON ped.id = da.id_pedido
  JOIN proyectos pr ON pr.id_proyecto = ped.id_proyecto
  LEFT JOIN remisiones_control rc ON rc.id_detalle = da.id_detalle AND rc.tipo_material = 'aluminio'
  WHERE ped.id_proyecto = ?
    AND LOWER(da.descripcion) NOT LIKE '%traspaso%'
`;

const BASE_CRISTAL_PROJECT = `
  SELECT
    dc.id_detalle as id_programacion,
    ped.id_proyecto,
    pr.nombre AS nombre_proyecto,
    ped.pedido as numero_pedido,
    '-' as subpedido,
    dc.clave_modelo as numero_perfil,
    dc.descripcion,
    NULL as medida_tramo,
    NULL as peso_kg_ml,
    NULL as acabado,
    COALESCE(rc.cantidad_pedida, dc.piezas, 0) as cantidad_pedida,
    COALESCE(rc.cantidad_recibida, 0) as cantidad_recibida,
    COALESCE(rc.cantidad_pedida, dc.piezas, 0) - COALESCE(rc.cantidad_recibida, 0) as cantidad_saldo,
    0 as cantidad_extruido,
    0 as cantidad_pintado,
    COALESCE(dc.m2_pedido, 0) as total_kg,
    (COALESCE(rc.cantidad_pedida, dc.piezas, 0) - COALESCE(rc.cantidad_recibida, 0)) as kg_saldo,
    0 as kg_por_pintar,
    0 as kg_entrega,
    CASE WHEN COALESCE(rc.cantidad_pedida, dc.piezas, 0) > 0
      THEN COALESCE(rc.cantidad_recibida, 0) / COALESCE(rc.cantidad_pedida, dc.piezas, 1)
      ELSE 0 END as porcentaje_avance,
    ped.proveedor,
    COALESCE(rc.fecha_liberacion, ped.fecha_aprobacion) as fecha_liberacion,
    rc.fecha_entrega,
    rc.fecha_entrega_desfazada,
    NULL as fecha_ultima_recepcion,
    COALESCE(rc.prioridad, 'C') as prioridad,
    rc.observaciones_proveedor,
    rc.observaciones_heg,
    'cristal' as tipo_material
  FROM pedidos_detalles_cristal dc
  JOIN pedidos ped ON ped.id = dc.id_pedido
  JOIN proyectos pr ON pr.id_proyecto = ped.id_proyecto
  LEFT JOIN remisiones_control rc ON rc.id_detalle = dc.id_detalle AND rc.tipo_material = 'cristal'
  WHERE ped.id_proyecto = ?
    AND LOWER(dc.descripcion) NOT LIKE '%traspaso%'
`;

const BASE_MISCELANEO_PROJECT = `
  SELECT
    dm.id_detalle as id_programacion,
    ped.id_proyecto,
    pr.nombre AS nombre_proyecto,
    ped.pedido as numero_pedido,
    '-' as subpedido,
    COALESCE(dm.clave, '') as numero_perfil,
    dm.descripcion,
    dm.ml as medida_tramo,
    dm.precio_x_kg as peso_kg_ml,
    dm.acabado,
    COALESCE(rc.cantidad_pedida, dm.cantidad, 0) as cantidad_pedida,
    COALESCE(rc.cantidad_recibida, 0) as cantidad_recibida,
    COALESCE(rc.cantidad_pedida, dm.cantidad, 0) - COALESCE(rc.cantidad_recibida, 0) as cantidad_saldo,
    0 as cantidad_extruido,
    0 as cantidad_pintado,
    COALESCE(dm.kg, 0) as total_kg,
    (COALESCE(rc.cantidad_pedida, dm.cantidad, 0) - COALESCE(rc.cantidad_recibida, 0)) as kg_saldo,
    0 as kg_por_pintar,
    0 as kg_entrega,
    CASE WHEN COALESCE(rc.cantidad_pedida, dm.cantidad, 0) > 0
      THEN COALESCE(rc.cantidad_recibida, 0) / COALESCE(rc.cantidad_pedida, dm.cantidad, 1)
      ELSE 0 END as porcentaje_avance,
    ped.proveedor,
    COALESCE(rc.fecha_liberacion, ped.fecha_aprobacion) as fecha_liberacion,
    rc.fecha_entrega,
    rc.fecha_entrega_desfazada,
    NULL as fecha_ultima_recepcion,
    COALESCE(rc.prioridad, 'C') as prioridad,
    rc.observaciones_proveedor,
    rc.observaciones_heg,
    'miscelaneo' as tipo_material
  FROM pedidos_detalles_miscelaneos dm
  JOIN pedidos ped ON ped.id = dm.id_pedido
  JOIN proyectos pr ON pr.id_proyecto = ped.id_proyecto
  LEFT JOIN remisiones_control rc ON rc.id_detalle = dm.id_detalle AND rc.tipo_material = 'miscelaneo'
  WHERE ped.id_proyecto = ?
    AND LOWER(dm.descripcion) NOT LIKE '%traspaso%'
    AND UPPER(ped.familia) NOT IN ('AL', 'MQAL', 'CR')
`;

// ---------------------------------------------------------------------------
// GET /proyectos/:id/remisiones
// ---------------------------------------------------------------------------
export async function findByProyecto(id, { prioridad, proveedor, search, tipo } = {}) {
  const params = [id];
  let rows = [];

  if (!tipo || tipo === "aluminio" || tipo === "todos") {
    let qAlu = BASE_ALUMINIO_PROJECT;
    const pAlu = [...params];

    if (prioridad && prioridad !== "TODAS") {
      qAlu += ` AND COALESCE(rc.prioridad, 'C') = ?`;
      pAlu.push(prioridad);
    }
    if (proveedor) {
      qAlu += ` AND ped.proveedor LIKE ?`;
      pAlu.push(`%${proveedor}%`);
    }
    if (search) {
      qAlu += ` AND (da.numero_perfil LIKE ? OR da.descripcion LIKE ? OR ped.pedido LIKE ?)`;
      pAlu.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const rowsAluminio = await queryAsync(qAlu, pAlu);
    rows = rows.concat(rowsAluminio);
  }

  if (!tipo || tipo === "cristal" || tipo === "todos") {
    let qCri = BASE_CRISTAL_PROJECT;
    const pCri = [...params];

    if (prioridad && prioridad !== "TODAS") {
      qCri += ` AND COALESCE(rc.prioridad, 'C') = ?`;
      pCri.push(prioridad);
    }
    if (proveedor) {
      qCri += ` AND ped.proveedor LIKE ?`;
      pCri.push(`%${proveedor}%`);
    }
    if (search) {
      qCri += ` AND (dc.clave_modelo LIKE ? OR dc.descripcion LIKE ? OR ped.pedido LIKE ?)`;
      pCri.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const rowsCristal = await queryAsync(qCri, pCri);
    rows = rows.concat(rowsCristal);
  }

  if (!tipo || tipo === "miscelaneo" || tipo === "todos") {
    let qMisc = BASE_MISCELANEO_PROJECT;
    const pMisc = [...params];

    if (prioridad && prioridad !== "TODAS") {
      qMisc += ` AND COALESCE(rc.prioridad, 'C') = ?`;
      pMisc.push(prioridad);
    }
    if (proveedor) {
      qMisc += ` AND ped.proveedor LIKE ?`;
      pMisc.push(`%${proveedor}%`);
    }
    if (search) {
      qMisc += ` AND (dm.clave LIKE ? OR dm.descripcion LIKE ? OR ped.pedido LIKE ?)`;
      pMisc.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const rowsMisc = await queryAsync(qMisc, pMisc);
    rows = rows.concat(rowsMisc);
  }

  rows.sort((a, b) => {
    if (a.prioridad !== b.prioridad) return a.prioridad.localeCompare(b.prioridad);
    return String(a.numero_pedido).localeCompare(String(b.numero_pedido));
  });

  return rows;
}

// ---------------------------------------------------------------------------
// GET /remisiones  (vista general, todos los proyectos)
// ---------------------------------------------------------------------------
export async function findAll({ prioridad, id_proyecto, search, tipo } = {}) {
  const ALUMINIO_ALL = `
    SELECT
      da.id_detalle as id_programacion,
      ped.id_proyecto,
      pr.nombre AS nombre_proyecto,
      ped.pedido as numero_pedido,
      '-' as subpedido,
      da.numero_perfil,
      da.descripcion,
      da.medida_tramo,
      da.peso_kg_ml,
      da.acabado,
      COALESCE(rc.cantidad_pedida, da.total_tramos, 0) as cantidad_pedida,
      COALESCE(rc.cantidad_recibida, 0) as cantidad_recibida,
      COALESCE(rc.cantidad_pedida, da.total_tramos, 0) - COALESCE(rc.cantidad_recibida, 0) as cantidad_saldo,
      COALESCE(rc.cantidad_extruido, 0) as cantidad_extruido,
      COALESCE(rc.cantidad_pintado, 0) as cantidad_pintado,
      COALESCE(da.kg, 0) as total_kg,
      (COALESCE(rc.cantidad_pedida, da.total_tramos, 0) - COALESCE(rc.cantidad_recibida, 0)) * COALESCE(da.medida_tramo, 0) * COALESCE(da.peso_kg_ml, 0) as kg_saldo,
      CASE WHEN COALESCE(rc.cantidad_pedida, da.total_tramos, 0) > 0
        THEN COALESCE(rc.cantidad_recibida, 0) / COALESCE(rc.cantidad_pedida, da.total_tramos, 1)
        ELSE 0 END as porcentaje_avance,
      ped.proveedor,
      COALESCE(rc.fecha_liberacion, ped.fecha_aprobacion) as fecha_liberacion,
      rc.fecha_entrega,
      COALESCE(rc.prioridad, 'C') as prioridad,
      'aluminio' as tipo_material
    FROM pedidos_detalles_aluminio da
    JOIN pedidos ped ON ped.id = da.id_pedido
    JOIN proyectos pr ON pr.id_proyecto = ped.id_proyecto
    LEFT JOIN remisiones_control rc ON rc.id_detalle = da.id_detalle AND rc.tipo_material = 'aluminio'
    WHERE 1=1
      AND LOWER(da.descripcion) NOT LIKE '%traspaso%'
  `;

  const CRISTAL_ALL = `
    SELECT
      dc.id_detalle as id_programacion,
      ped.id_proyecto,
      pr.nombre AS nombre_proyecto,
      ped.pedido as numero_pedido,
      '-' as subpedido,
      dc.clave_modelo as numero_perfil,
      dc.descripcion,
      NULL as medida_tramo,
      NULL as peso_kg_ml,
      NULL as acabado,
      COALESCE(rc.cantidad_pedida, dc.piezas, 0) as cantidad_pedida,
      COALESCE(rc.cantidad_recibida, 0) as cantidad_recibida,
      COALESCE(rc.cantidad_pedida, dc.piezas, 0) - COALESCE(rc.cantidad_recibida, 0) as cantidad_saldo,
      0 as cantidad_extruido,
      0 as cantidad_pintado,
      COALESCE(dc.m2_pedido, 0) as total_kg,
      (COALESCE(rc.cantidad_pedida, dc.piezas, 0) - COALESCE(rc.cantidad_recibida, 0)) as kg_saldo,
      CASE WHEN COALESCE(rc.cantidad_pedida, dc.piezas, 0) > 0
        THEN COALESCE(rc.cantidad_recibida, 0) / COALESCE(rc.cantidad_pedida, dc.piezas, 1)
        ELSE 0 END as porcentaje_avance,
      ped.proveedor,
      COALESCE(rc.fecha_liberacion, ped.fecha_aprobacion) as fecha_liberacion,
      rc.fecha_entrega,
      COALESCE(rc.prioridad, 'C') as prioridad,
      'cristal' as tipo_material
    FROM pedidos_detalles_cristal dc
    JOIN pedidos ped ON ped.id = dc.id_pedido
    JOIN proyectos pr ON pr.id_proyecto = ped.id_proyecto
    LEFT JOIN remisiones_control rc ON rc.id_detalle = dc.id_detalle AND rc.tipo_material = 'cristal'
    WHERE 1=1
      AND LOWER(dc.descripcion) NOT LIKE '%traspaso%'
  `;

  const MISCELANEO_ALL = `
    SELECT
      dm.id_detalle as id_programacion,
      ped.id_proyecto,
      pr.nombre AS nombre_proyecto,
      ped.pedido as numero_pedido,
      '-' as subpedido,
      COALESCE(dm.clave, '') as numero_perfil,
      dm.descripcion,
      dm.ml as medida_tramo,
      dm.precio_x_kg as peso_kg_ml,
      dm.acabado,
      COALESCE(rc.cantidad_pedida, dm.cantidad, 0) as cantidad_pedida,
      COALESCE(rc.cantidad_recibida, 0) as cantidad_recibida,
      COALESCE(rc.cantidad_pedida, dm.cantidad, 0) - COALESCE(rc.cantidad_recibida, 0) as cantidad_saldo,
      0 as cantidad_extruido,
      0 as cantidad_pintado,
      COALESCE(dm.kg, 0) as total_kg,
      (COALESCE(rc.cantidad_pedida, dm.cantidad, 0) - COALESCE(rc.cantidad_recibida, 0)) as kg_saldo,
      CASE WHEN COALESCE(rc.cantidad_pedida, dm.cantidad, 0) > 0
        THEN COALESCE(rc.cantidad_recibida, 0) / COALESCE(rc.cantidad_pedida, dm.cantidad, 1)
        ELSE 0 END as porcentaje_avance,
      ped.proveedor,
      COALESCE(rc.fecha_liberacion, ped.fecha_aprobacion) as fecha_liberacion,
      rc.fecha_entrega,
      COALESCE(rc.prioridad, 'C') as prioridad,
      'miscelaneo' as tipo_material
    FROM pedidos_detalles_miscelaneos dm
    JOIN pedidos ped ON ped.id = dm.id_pedido
    JOIN proyectos pr ON pr.id_proyecto = ped.id_proyecto
    LEFT JOIN remisiones_control rc ON rc.id_detalle = dm.id_detalle AND rc.tipo_material = 'miscelaneo'
    WHERE 1=1
      AND LOWER(dm.descripcion) NOT LIKE '%traspaso%'
      AND UPPER(ped.familia) NOT IN ('AL', 'MQAL', 'CR')
  `;

  let rows = [];

  if (!tipo || tipo === "aluminio" || tipo === "todos") {
    let qAlu = ALUMINIO_ALL;
    const pAlu = [];

    if (id_proyecto) {
      qAlu += ` AND ped.id_proyecto = ?`;
      pAlu.push(id_proyecto);
    }
    if (prioridad && prioridad !== "TODAS") {
      qAlu += ` AND COALESCE(rc.prioridad, 'C') = ?`;
      pAlu.push(prioridad);
    }
    if (search) {
      qAlu += ` AND (da.numero_perfil LIKE ? OR da.descripcion LIKE ? OR ped.pedido LIKE ? OR pr.nombre LIKE ?)`;
      pAlu.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const rowsAluminio = await queryAsync(qAlu, pAlu);
    rows = rows.concat(rowsAluminio);
  }

  if (!tipo || tipo === "cristal" || tipo === "todos") {
    let qCri = CRISTAL_ALL;
    const pCri = [];

    if (id_proyecto) {
      qCri += ` AND ped.id_proyecto = ?`;
      pCri.push(id_proyecto);
    }
    if (prioridad && prioridad !== "TODAS") {
      qCri += ` AND COALESCE(rc.prioridad, 'C') = ?`;
      pCri.push(prioridad);
    }
    if (search) {
      qCri += ` AND (dc.clave_modelo LIKE ? OR dc.descripcion LIKE ? OR ped.pedido LIKE ? OR pr.nombre LIKE ?)`;
      pCri.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const rowsCristal = await queryAsync(qCri, pCri);
    rows = rows.concat(rowsCristal);
  }

  if (!tipo || tipo === "miscelaneo" || tipo === "todos") {
    let qMisc = MISCELANEO_ALL;
    const pMisc = [];

    if (id_proyecto) {
      qMisc += ` AND ped.id_proyecto = ?`;
      pMisc.push(id_proyecto);
    }
    if (prioridad && prioridad !== "TODAS") {
      qMisc += ` AND COALESCE(rc.prioridad, 'C') = ?`;
      pMisc.push(prioridad);
    }
    if (search) {
      qMisc += ` AND (dm.clave LIKE ? OR dm.descripcion LIKE ? OR ped.pedido LIKE ? OR pr.nombre LIKE ?)`;
      pMisc.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const rowsMisc = await queryAsync(qMisc, pMisc);
    rows = rows.concat(rowsMisc);
  }

  rows.sort((a, b) => {
    if (a.prioridad !== b.prioridad) return a.prioridad.localeCompare(b.prioridad);
    if (a.nombre_proyecto !== b.nombre_proyecto) return a.nombre_proyecto.localeCompare(b.nombre_proyecto);
    return String(a.numero_pedido).localeCompare(String(b.numero_pedido));
  });

  return rows;
}

// ---------------------------------------------------------------------------
// GET /remisiones/resumen
// ---------------------------------------------------------------------------
export async function getResumen() {
  const queryAluminio = `
    SELECT
      COALESCE(rc.prioridad, 'C') as prioridad,
      COUNT(*) AS total_items,
      SUM(COALESCE(rc.cantidad_pedida, da.total_tramos, 0)) AS total_pedido,
      SUM(COALESCE(rc.cantidad_recibida, 0)) AS total_recibido,
      SUM(COALESCE(rc.cantidad_pedida, da.total_tramos, 0) - COALESCE(rc.cantidad_recibida, 0)) AS total_saldo,
      SUM(COALESCE(da.kg, 0)) AS total_kg,
      SUM((COALESCE(rc.cantidad_pedida, da.total_tramos, 0) - COALESCE(rc.cantidad_recibida, 0)) * COALESCE(da.medida_tramo, 0) * COALESCE(da.peso_kg_ml, 0)) AS kg_saldo
    FROM pedidos_detalles_aluminio da
    LEFT JOIN remisiones_control rc ON rc.id_detalle = da.id_detalle AND rc.tipo_material = 'aluminio'
    WHERE LOWER(da.descripcion) NOT LIKE '%traspaso%'
    GROUP BY COALESCE(rc.prioridad, 'C')
  `;

  const queryCristal = `
    SELECT
      COALESCE(rc.prioridad, 'C') as prioridad,
      COUNT(*) AS total_items,
      SUM(COALESCE(rc.cantidad_pedida, dc.piezas, 0)) AS total_pedido,
      SUM(COALESCE(rc.cantidad_recibida, 0)) AS total_recibido,
      SUM(COALESCE(rc.cantidad_pedida, dc.piezas, 0) - COALESCE(rc.cantidad_recibida, 0)) AS total_saldo,
      SUM(COALESCE(dc.m2_pedido, 0)) AS total_kg,
      SUM(COALESCE(rc.cantidad_pedida, dc.piezas, 0) - COALESCE(rc.cantidad_recibida, 0)) AS kg_saldo
    FROM pedidos_detalles_cristal dc
    LEFT JOIN remisiones_control rc ON rc.id_detalle = dc.id_detalle AND rc.tipo_material = 'cristal'
    WHERE LOWER(dc.descripcion) NOT LIKE '%traspaso%'
    GROUP BY COALESCE(rc.prioridad, 'C')
  `;

  const rowsAluminio = await queryAsync(queryAluminio);
  const rowsCristal = await queryAsync(queryCristal);

  return { rowsAluminio, rowsCristal };
}

// ---------------------------------------------------------------------------
// PUT /remisiones/:id  (upsert remisiones_control)
// ---------------------------------------------------------------------------
export async function upsertControl(id, data) {
  const {
    tipo_material,
    cantidad_pedida,
    cantidad_recibida,
    cantidad_extruido,
    cantidad_pintado,
    fecha_liberacion,
    fecha_entrega,
    fecha_entrega_desfazada,
    prioridad,
    observaciones_proveedor,
    observaciones_heg,
  } = data;

  const query = `
    INSERT INTO remisiones_control (id_detalle, tipo_material, cantidad_pedida, cantidad_recibida, cantidad_extruido, cantidad_pintado, prioridad, fecha_liberacion, fecha_entrega, fecha_entrega_desfazada, observaciones_proveedor, observaciones_heg)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      cantidad_pedida = COALESCE(VALUES(cantidad_pedida), cantidad_pedida),
      cantidad_recibida = COALESCE(VALUES(cantidad_recibida), cantidad_recibida),
      cantidad_extruido = COALESCE(VALUES(cantidad_extruido), cantidad_extruido),
      cantidad_pintado = COALESCE(VALUES(cantidad_pintado), cantidad_pintado),
      prioridad = COALESCE(VALUES(prioridad), prioridad),
      fecha_liberacion = COALESCE(VALUES(fecha_liberacion), fecha_liberacion),
      fecha_entrega = COALESCE(VALUES(fecha_entrega), fecha_entrega),
      fecha_entrega_desfazada = COALESCE(VALUES(fecha_entrega_desfazada), fecha_entrega_desfazada),
      observaciones_proveedor = COALESCE(VALUES(observaciones_proveedor), observaciones_proveedor),
      observaciones_heg = COALESCE(VALUES(observaciones_heg), observaciones_heg)
  `;

  return queryAsync(query, [
    id,
    tipo_material,
    cantidad_pedida !== undefined ? cantidad_pedida : null,
    cantidad_recibida !== undefined ? cantidad_recibida : null,
    cantidad_extruido !== undefined ? cantidad_extruido : null,
    cantidad_pintado !== undefined ? cantidad_pintado : null,
    prioridad !== undefined ? prioridad : null,
    fecha_liberacion !== undefined ? fecha_liberacion : null,
    fecha_entrega !== undefined ? fecha_entrega : null,
    fecha_entrega_desfazada !== undefined ? fecha_entrega_desfazada : null,
    observaciones_proveedor !== undefined ? observaciones_proveedor : null,
    observaciones_heg !== undefined ? observaciones_heg : null,
  ]);
}

// ---------------------------------------------------------------------------
// GET /proyectos/:id/remisiones/export  (datos para Excel por proyecto)
// ---------------------------------------------------------------------------
export async function findForExportByProyecto(id, { prioridad, tipo } = {}) {
  const [proyecto] = await queryAsync(
    `SELECT nombre FROM proyectos WHERE id_proyecto = ?`,
    [id]
  );

  if (!proyecto) return null;

  let rows = [];

  if (!tipo || tipo === "aluminio" || tipo === "todos") {
    let qAlu = `
      SELECT
        da.id_detalle as id_programacion,
        pr.nombre AS nombre_proyecto,
        ped.pedido as numero_pedido,
        '-' as subpedido,
        da.numero_perfil,
        da.descripcion,
        da.medida_tramo,
        da.peso_kg_ml,
        da.acabado,
        COALESCE(rc.cantidad_pedida, da.total_tramos, 0) as cantidad_pedida,
        COALESCE(rc.cantidad_recibida, 0) as cantidad_recibida,
        COALESCE(rc.cantidad_pedida, da.total_tramos, 0) - COALESCE(rc.cantidad_recibida, 0) as cantidad_saldo,
        COALESCE(rc.cantidad_extruido, 0) as cantidad_extruido,
        COALESCE(rc.cantidad_pintado, 0) as cantidad_pintado,
        COALESCE(da.kg, 0) as total_kg,
        (COALESCE(rc.cantidad_pedida, da.total_tramos, 0) - COALESCE(rc.cantidad_recibida, 0)) * COALESCE(da.medida_tramo, 0) * COALESCE(da.peso_kg_ml, 0) as kg_saldo,
        CASE WHEN COALESCE(rc.cantidad_pedida, da.total_tramos, 0) > 0
          THEN COALESCE(rc.cantidad_recibida, 0) / COALESCE(rc.cantidad_pedida, da.total_tramos, 1)
          ELSE 0 END as porcentaje_avance,
        COALESCE(rc.fecha_liberacion, ped.fecha_aprobacion) as fecha_liberacion,
        rc.fecha_entrega,
        NULL as fecha_entrega_desfazada,
        COALESCE(rc.prioridad, 'C') as prioridad,
        rc.observaciones_proveedor,
        rc.observaciones_heg,
        'aluminio' as tipo_material
      FROM pedidos_detalles_aluminio da
      JOIN pedidos ped ON ped.id = da.id_pedido
      JOIN proyectos pr ON pr.id_proyecto = ped.id_proyecto
      LEFT JOIN remisiones_control rc ON rc.id_detalle = da.id_detalle AND rc.tipo_material = 'aluminio'
      WHERE ped.id_proyecto = ?
        AND LOWER(da.descripcion) NOT LIKE '%traspaso%'
    `;
    const pAlu = [id];
    if (prioridad && prioridad !== "TODAS") {
      qAlu += ` AND COALESCE(rc.prioridad, 'C') = ?`;
      pAlu.push(prioridad);
    }
    const rowsAlu = await queryAsync(qAlu, pAlu);
    rows = rows.concat(rowsAlu);
  }

  if (!tipo || tipo === "cristal" || tipo === "todos") {
    let qCri = `
      SELECT
        dc.id_detalle as id_programacion,
        pr.nombre AS nombre_proyecto,
        ped.pedido as numero_pedido,
        '-' as subpedido,
        dc.clave_modelo as numero_perfil,
        dc.descripcion,
        NULL as medida_tramo,
        NULL as peso_kg_ml,
        NULL as acabado,
        COALESCE(rc.cantidad_pedida, dc.piezas, 0) as cantidad_pedida,
        COALESCE(rc.cantidad_recibida, 0) as cantidad_recibida,
        COALESCE(rc.cantidad_pedida, dc.piezas, 0) - COALESCE(rc.cantidad_recibida, 0) as cantidad_saldo,
        0 as cantidad_extruido,
        0 as cantidad_pintado,
        COALESCE(dc.m2_pedido, 0) as total_kg,
        (COALESCE(rc.cantidad_pedida, dc.piezas, 0) - COALESCE(rc.cantidad_recibida, 0)) as kg_saldo,
        CASE WHEN COALESCE(rc.cantidad_pedida, dc.piezas, 0) > 0
          THEN COALESCE(rc.cantidad_recibida, 0) / COALESCE(rc.cantidad_pedida, dc.piezas, 1)
          ELSE 0 END as porcentaje_avance,
        COALESCE(rc.fecha_liberacion, ped.fecha_aprobacion) as fecha_liberacion,
        rc.fecha_entrega,
        rc.fecha_entrega_desfazada,
        COALESCE(rc.prioridad, 'C') as prioridad,
        rc.observaciones_proveedor,
        rc.observaciones_heg,
        'cristal' as tipo_material
      FROM pedidos_detalles_cristal dc
      JOIN pedidos ped ON ped.id = dc.id_pedido
      JOIN proyectos pr ON pr.id_proyecto = ped.id_proyecto
      LEFT JOIN remisiones_control rc ON rc.id_detalle = dc.id_detalle AND rc.tipo_material = 'cristal'
      WHERE ped.id_proyecto = ?
        AND LOWER(dc.descripcion) NOT LIKE '%traspaso%'
    `;
    const pCri = [id];
    if (prioridad && prioridad !== "TODAS") {
      qCri += ` AND COALESCE(rc.prioridad, 'C') = ?`;
      pCri.push(prioridad);
    }
    const rowsCri = await queryAsync(qCri, pCri);
    rows = rows.concat(rowsCri);
  }

  if (!tipo || tipo === "miscelaneo" || tipo === "todos") {
    let qMisc = `
      SELECT
        dm.id_detalle as id_programacion,
        pr.nombre AS nombre_proyecto,
        ped.pedido as numero_pedido,
        '-' as subpedido,
        COALESCE(dm.clave, '') as numero_perfil,
        dm.descripcion,
        dm.ml as medida_tramo,
        dm.precio_x_kg as peso_kg_ml,
        dm.acabado,
        COALESCE(rc.cantidad_pedida, dm.cantidad, 0) as cantidad_pedida,
        COALESCE(rc.cantidad_recibida, 0) as cantidad_recibida,
        COALESCE(rc.cantidad_pedida, dm.cantidad, 0) - COALESCE(rc.cantidad_recibida, 0) as cantidad_saldo,
        0 as cantidad_extruido,
        0 as cantidad_pintado,
        COALESCE(dm.kg, 0) as total_kg,
        (COALESCE(rc.cantidad_pedida, dm.cantidad, 0) - COALESCE(rc.cantidad_recibida, 0)) as kg_saldo,
        CASE WHEN COALESCE(rc.cantidad_pedida, dm.cantidad, 0) > 0
          THEN COALESCE(rc.cantidad_recibida, 0) / COALESCE(rc.cantidad_pedida, dm.cantidad, 1)
          ELSE 0 END as porcentaje_avance,
        COALESCE(rc.fecha_liberacion, ped.fecha_aprobacion) as fecha_liberacion,
        rc.fecha_entrega,
        rc.fecha_entrega_desfazada,
        COALESCE(rc.prioridad, 'C') as prioridad,
        rc.observaciones_proveedor,
        rc.observaciones_heg,
        'miscelaneo' as tipo_material
      FROM pedidos_detalles_miscelaneos dm
      JOIN pedidos ped ON ped.id = dm.id_pedido
      JOIN proyectos pr ON pr.id_proyecto = ped.id_proyecto
      LEFT JOIN remisiones_control rc ON rc.id_detalle = dm.id_detalle AND rc.tipo_material = 'miscelaneo'
      WHERE ped.id_proyecto = ?
        AND LOWER(dm.descripcion) NOT LIKE '%traspaso%'
        AND UPPER(ped.familia) NOT IN ('AL', 'MQAL', 'CR')
    `;
    const pMisc = [id];
    if (prioridad && prioridad !== "TODAS") {
      qMisc += ` AND COALESCE(rc.prioridad, 'C') = ?`;
      pMisc.push(prioridad);
    }
    const rowsMisc = await queryAsync(qMisc, pMisc);
    rows = rows.concat(rowsMisc);
  }

  rows.sort((a, b) => {
    if (a.prioridad !== b.prioridad) return a.prioridad.localeCompare(b.prioridad);
    return String(a.numero_pedido).localeCompare(String(b.numero_pedido));
  });

  return { proyecto, rows };
}

// ---------------------------------------------------------------------------
// GET /remisiones/export  (datos para Excel general)
// ---------------------------------------------------------------------------
export async function findForExportAll({ prioridad, tipo } = {}) {
  let rows = [];

  if (!tipo || tipo === "aluminio" || tipo === "todos") {
    let qAlu = `
      SELECT
        da.id_detalle as id_programacion,
        pr.nombre AS nombre_proyecto,
        ped.pedido as numero_pedido,
        '-' as subpedido,
        da.numero_perfil,
        da.descripcion,
        da.medida_tramo,
        da.peso_kg_ml,
        da.acabado,
        COALESCE(rc.cantidad_pedida, da.total_tramos, 0) as cantidad_pedida,
        COALESCE(rc.cantidad_recibida, 0) as cantidad_recibida,
        COALESCE(rc.cantidad_pedida, da.total_tramos, 0) - COALESCE(rc.cantidad_recibida, 0) as cantidad_saldo,
        COALESCE(rc.cantidad_extruido, 0) as cantidad_extruido,
        COALESCE(rc.cantidad_pintado, 0) as cantidad_pintado,
        COALESCE(da.kg, 0) as total_kg,
        (COALESCE(rc.cantidad_pedida, da.total_tramos, 0) - COALESCE(rc.cantidad_recibida, 0)) * COALESCE(da.medida_tramo, 0) * COALESCE(da.peso_kg_ml, 0) as kg_saldo,
        CASE WHEN COALESCE(rc.cantidad_pedida, da.total_tramos, 0) > 0
          THEN COALESCE(rc.cantidad_recibida, 0) / COALESCE(rc.cantidad_pedida, da.total_tramos, 1)
          ELSE 0 END as porcentaje_avance,
        rc.fecha_liberacion,
        rc.fecha_entrega,
        NULL as fecha_entrega_desfazada,
        COALESCE(rc.prioridad, 'C') as prioridad,
        rc.observaciones_proveedor,
        rc.observaciones_heg,
        'aluminio' as tipo_material
      FROM pedidos_detalles_aluminio da
      JOIN pedidos ped ON ped.id = da.id_pedido
      JOIN proyectos pr ON pr.id_proyecto = ped.id_proyecto
      LEFT JOIN remisiones_control rc ON rc.id_detalle = da.id_detalle AND rc.tipo_material = 'aluminio'
      WHERE 1=1
        AND LOWER(da.descripcion) NOT LIKE '%traspaso%'
    `;
    const pAlu = [];
    if (prioridad && prioridad !== "TODAS") {
      qAlu += ` AND COALESCE(rc.prioridad, 'C') = ?`;
      pAlu.push(prioridad);
    }
    const rowsAlu = await queryAsync(qAlu, pAlu);
    rows = rows.concat(rowsAlu);
  }

  if (!tipo || tipo === "cristal" || tipo === "todos") {
    let qCri = `
      SELECT
        dc.id_detalle as id_programacion,
        pr.nombre AS nombre_proyecto,
        ped.pedido as numero_pedido,
        '-' as subpedido,
        dc.clave_modelo as numero_perfil,
        dc.descripcion,
        NULL as medida_tramo,
        NULL as peso_kg_ml,
        NULL as acabado,
        COALESCE(rc.cantidad_pedida, dc.piezas, 0) as cantidad_pedida,
        COALESCE(rc.cantidad_recibida, 0) as cantidad_recibida,
        COALESCE(rc.cantidad_pedida, dc.piezas, 0) - COALESCE(rc.cantidad_recibida, 0) as cantidad_saldo,
        0 as cantidad_extruido,
        0 as cantidad_pintado,
        COALESCE(dc.m2_pedido, 0) as total_kg,
        (COALESCE(rc.cantidad_pedida, dc.piezas, 0) - COALESCE(rc.cantidad_recibida, 0)) as kg_saldo,
        CASE WHEN COALESCE(rc.cantidad_pedida, dc.piezas, 0) > 0
          THEN COALESCE(rc.cantidad_recibida, 0) / COALESCE(rc.cantidad_pedida, dc.piezas, 1)
          ELSE 0 END as porcentaje_avance,
        rc.fecha_liberacion,
        rc.fecha_entrega,
        rc.fecha_entrega_desfazada,
        COALESCE(rc.prioridad, 'C') as prioridad,
        rc.observaciones_proveedor,
        rc.observaciones_heg,
        'cristal' as tipo_material
      FROM pedidos_detalles_cristal dc
      JOIN pedidos ped ON ped.id = dc.id_pedido
      JOIN proyectos pr ON pr.id_proyecto = ped.id_proyecto
      LEFT JOIN remisiones_control rc ON rc.id_detalle = dc.id_detalle AND rc.tipo_material = 'cristal'
      WHERE 1=1
        AND LOWER(dc.descripcion) NOT LIKE '%traspaso%'
    `;
    const pCri = [];
    if (prioridad && prioridad !== "TODAS") {
      qCri += ` AND COALESCE(rc.prioridad, 'C') = ?`;
      pCri.push(prioridad);
    }
    const rowsCri = await queryAsync(qCri, pCri);
    rows = rows.concat(rowsCri);
  }

  if (!tipo || tipo === "miscelaneo" || tipo === "todos") {
    let qMisc = `
      SELECT
        dm.id_detalle as id_programacion,
        pr.nombre AS nombre_proyecto,
        ped.pedido as numero_pedido,
        '-' as subpedido,
        COALESCE(dm.clave, '') as numero_perfil,
        dm.descripcion,
        dm.ml as medida_tramo,
        dm.precio_x_kg as peso_kg_ml,
        dm.acabado,
        COALESCE(rc.cantidad_pedida, dm.cantidad, 0) as cantidad_pedida,
        COALESCE(rc.cantidad_recibida, 0) as cantidad_recibida,
        COALESCE(rc.cantidad_pedida, dm.cantidad, 0) - COALESCE(rc.cantidad_recibida, 0) as cantidad_saldo,
        0 as cantidad_extruido,
        0 as cantidad_pintado,
        COALESCE(dm.kg, 0) as total_kg,
        (COALESCE(rc.cantidad_pedida, dm.cantidad, 0) - COALESCE(rc.cantidad_recibida, 0)) as kg_saldo,
        CASE WHEN COALESCE(rc.cantidad_pedida, dm.cantidad, 0) > 0
          THEN COALESCE(rc.cantidad_recibida, 0) / COALESCE(rc.cantidad_pedida, dm.cantidad, 1)
          ELSE 0 END as porcentaje_avance,
        rc.fecha_liberacion,
        rc.fecha_entrega,
        rc.fecha_entrega_desfazada,
        COALESCE(rc.prioridad, 'C') as prioridad,
        rc.observaciones_proveedor,
        rc.observaciones_heg,
        'miscelaneo' as tipo_material
      FROM pedidos_detalles_miscelaneos dm
      JOIN pedidos ped ON ped.id = dm.id_pedido
      JOIN proyectos pr ON pr.id_proyecto = ped.id_proyecto
      LEFT JOIN remisiones_control rc ON rc.id_detalle = dm.id_detalle AND rc.tipo_material = 'miscelaneo'
      WHERE 1=1
        AND LOWER(dm.descripcion) NOT LIKE '%traspaso%'
        AND UPPER(ped.familia) NOT IN ('AL', 'MQAL', 'CR')
    `;
    const pMisc = [];
    if (prioridad && prioridad !== "TODAS") {
      qMisc += ` AND COALESCE(rc.prioridad, 'C') = ?`;
      pMisc.push(prioridad);
    }
    const rowsMisc = await queryAsync(qMisc, pMisc);
    rows = rows.concat(rowsMisc);
  }

  rows.sort((a, b) => {
    if (a.prioridad !== b.prioridad) return a.prioridad.localeCompare(b.prioridad);
    if (a.nombre_proyecto !== b.nombre_proyecto) return a.nombre_proyecto.localeCompare(b.nombre_proyecto);
    return String(a.numero_pedido).localeCompare(String(b.numero_pedido));
  });

  return rows;
}

// ---------------------------------------------------------------------------
// GET /remisiones/buscar-pedidos
// ---------------------------------------------------------------------------
export async function buscarPedidos(tipo, search) {
  let query;
  let params = [];

  if (tipo === "miscelaneo") {
    query = `
      SELECT DISTINCT
        ped.id,
        ped.pedido as numero_pedido,
        pr.nombre as nombre_proyecto,
        ped.proveedor,
        ped.familia
      FROM pedidos ped
      JOIN proyectos pr ON pr.id_proyecto = ped.id_proyecto
      WHERE UPPER(ped.familia) NOT IN ('AL', 'MQAL', 'CR')
    `;
  } else {
    let familiaMatch = [];
    if (tipo === "aluminio") {
      familiaMatch = ["AL", "MQAL", "aluminio"];
    } else if (tipo === "cristal") {
      familiaMatch = ["CR", "cristal"];
    }

    query = `
      SELECT DISTINCT
        ped.id,
        ped.pedido as numero_pedido,
        pr.nombre as nombre_proyecto,
        ped.proveedor,
        ped.familia
      FROM pedidos ped
      JOIN proyectos pr ON pr.id_proyecto = ped.id_proyecto
      WHERE (LOWER(ped.familia) IN (${familiaMatch.map(() => "?").join(",")}) OR LOWER(ped.familia) LIKE ?)
    `;
    params = [...familiaMatch.map((f) => f.toLowerCase()), `%${tipo}%`];
  }

  if (search) {
    query += ` AND (ped.pedido LIKE ? OR pr.nombre LIKE ? OR ped.proveedor LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  query += ` ORDER BY ped.pedido DESC LIMIT 50`;

  return queryAsync(query, params);
}

// ---------------------------------------------------------------------------
// GET /remisiones/detalles-pedido/:pedidoId
// ---------------------------------------------------------------------------
export async function getDetallesPedido(pedidoId, tipo) {
  let query;
  if (tipo === "aluminio") {
    query = `
      SELECT
        da.id_detalle,
        da.numero_perfil,
        NULL as clave_modelo,
        da.descripcion,
        COALESCE(da.total_tramos, 0) as cantidad_disponible,
        COALESCE(rc.cantidad_pedida, da.total_tramos, 0) as cantidad_pedida,
        COALESCE(rc.cantidad_recibida, 0) as cantidad_recibida,
        'aluminio' as tipo_material
      FROM pedidos_detalles_aluminio da
      LEFT JOIN remisiones_control rc ON rc.id_detalle = da.id_detalle AND rc.tipo_material = 'aluminio'
      WHERE da.id_pedido = ?
        AND LOWER(da.descripcion) NOT LIKE '%traspaso%'
      ORDER BY da.id_detalle ASC
    `;
  } else if (tipo === "cristal") {
    query = `
      SELECT
        dc.id_detalle,
        NULL as numero_perfil,
        dc.clave_modelo,
        dc.descripcion,
        COALESCE(dc.piezas, 0) as cantidad_disponible,
        COALESCE(rc.cantidad_pedida, dc.piezas, 0) as cantidad_pedida,
        COALESCE(rc.cantidad_recibida, 0) as cantidad_recibida,
        'cristal' as tipo_material
      FROM pedidos_detalles_cristal dc
      LEFT JOIN remisiones_control rc ON rc.id_detalle = dc.id_detalle AND rc.tipo_material = 'cristal'
      WHERE dc.id_pedido = ?
        AND LOWER(dc.descripcion) NOT LIKE '%traspaso%'
      ORDER BY dc.id_detalle ASC
    `;
  } else {
    query = `
      SELECT
        dm.id_detalle,
        dm.clave as numero_perfil,
        NULL as clave_modelo,
        dm.descripcion,
        COALESCE(dm.cantidad, 0) as cantidad_disponible,
        COALESCE(rc.cantidad_pedida, dm.cantidad, 0) as cantidad_pedida,
        COALESCE(rc.cantidad_recibida, 0) as cantidad_recibida,
        'miscelaneo' as tipo_material
      FROM pedidos_detalles_miscelaneos dm
      LEFT JOIN remisiones_control rc ON rc.id_detalle = dm.id_detalle AND rc.tipo_material = 'miscelaneo'
      WHERE dm.id_pedido = ?
        AND LOWER(dm.descripcion) NOT LIKE '%traspaso%'
      ORDER BY dm.id_detalle ASC
    `;
  }

  return queryAsync(query, [pedidoId]);
}

// ---------------------------------------------------------------------------
// POST /remisiones/registrar-entrega  (helpers)
// ---------------------------------------------------------------------------
export async function getPedidoParaEntrega(id_pedido) {
  const rows = await queryAsync(
    `SELECT ped.pedido, pr.nombre as nombre_proyecto
     FROM pedidos ped
     JOIN proyectos pr ON pr.id_proyecto = ped.id_proyecto
     WHERE ped.id = ?`,
    [id_pedido]
  );
  return rows && rows[0] ? rows[0] : null;
}

export async function insertHistorialEntrega(data) {
  const { id_pedido, numero_pedido, nombre_proyecto, tipo_material, total_items, total_piezas, observaciones, usuario } = data;
  return queryAsync(
    `INSERT INTO remisiones_historial_entregas (id_pedido, numero_pedido, nombre_proyecto, tipo_material, total_items, total_piezas, observaciones, usuario)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id_pedido, numero_pedido, nombre_proyecto, tipo_material, total_items, total_piezas, observaciones, usuario]
  );
}

export async function upsertControlEntrega(id_detalle, tipo_material, cantidad_pedida, cantidad_entrega) {
  return queryAsync(
    `INSERT INTO remisiones_control (id_detalle, tipo_material, cantidad_pedida, cantidad_recibida)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       cantidad_recibida = cantidad_recibida + VALUES(cantidad_recibida)`,
    [id_detalle, tipo_material, cantidad_pedida, cantidad_entrega]
  );
}

export async function insertHistorialEntregaDetalle(id_entrega, id_detalle, cantidad_entregada, descripcion) {
  return queryAsync(
    `INSERT INTO remisiones_historial_entregas_detalle (id_entrega, id_detalle, cantidad_entregada, descripcion)
     VALUES (?, ?, ?, ?)`,
    [id_entrega, id_detalle, cantidad_entregada, descripcion]
  );
}

// ---------------------------------------------------------------------------
// GET /remisiones/historial-entregas
// ---------------------------------------------------------------------------
export async function getHistorialEntregas({ id_proyecto, limit = 100 } = {}) {
  let query = `
    SELECT
      id_entrega,
      fecha_entrega,
      numero_pedido,
      nombre_proyecto,
      tipo_material,
      total_items,
      total_piezas,
      observaciones,
      usuario
    FROM remisiones_historial_entregas
  `;
  const params = [];

  if (id_proyecto) {
    query += ` WHERE id_pedido IN (SELECT id FROM pedidos WHERE id_proyecto = ?)`;
    params.push(id_proyecto);
  }

  query += ` ORDER BY fecha_entrega DESC LIMIT ?`;
  params.push(parseInt(limit, 10));

  return queryAsync(query, params);
}

// ---------------------------------------------------------------------------
// GET /remisiones/historial-entregas/:id
// ---------------------------------------------------------------------------
export async function getHistorialEntregaById(id) {
  const rows = await queryAsync(
    `SELECT * FROM remisiones_historial_entregas WHERE id_entrega = ?`,
    [id]
  );
  const entrega = rows && rows[0] ? rows[0] : null;
  if (!entrega) return null;

  const detalles = await queryAsync(
    `SELECT * FROM remisiones_historial_entregas_detalle WHERE id_entrega = ?`,
    [id]
  );

  return { ...entrega, detalles };
}
