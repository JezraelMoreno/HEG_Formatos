import { queryAsync } from "../config/db.js";

export async function findByProyecto(id_proyecto) {
  return queryAsync(
    `SELECT * FROM facturas WHERE id_proyecto = ? ORDER BY created_at DESC`,
    [id_proyecto]
  );
}

export async function findById(id_factura) {
  const rows = await queryAsync(
    `SELECT * FROM facturas WHERE id_factura = ?`,
    [id_factura]
  );
  return rows && rows[0] ? rows[0] : null;
}

export async function insert(data) {
  const {
    id_proyecto,
    proveedor,
    concepto,
    categoria,
    total,
    fecha_factura,
    estatus,
    fecha_pago,
    metodo_pago,
    ruta_pdf,
    ruta_xml,
    nombre_usuario,
  } = data;

  return queryAsync(
    `INSERT INTO facturas
      (id_proyecto, proveedor, concepto, categoria, total, fecha_factura, estatus, fecha_pago, metodo_pago, ruta_pdf, ruta_xml, nombre_usuario)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id_proyecto,
      proveedor,
      concepto,
      categoria,
      total,
      fecha_factura,
      estatus || "pendiente",
      fecha_pago || null,
      metodo_pago || null,
      ruta_pdf,
      ruta_xml || null,
      nombre_usuario || null,
    ]
  );
}

export async function update(id_factura, data) {
  const { estatus, fecha_pago, metodo_pago } = data;
  return queryAsync(
    `UPDATE facturas SET estatus = ?, fecha_pago = ?, metodo_pago = ? WHERE id_factura = ?`,
    [estatus, fecha_pago || null, metodo_pago || null, id_factura]
  );
}

export async function deleteById(id_factura) {
  return queryAsync(`DELETE FROM facturas WHERE id_factura = ?`, [id_factura]);
}
