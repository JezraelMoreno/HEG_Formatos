// Datos dummy para desarrollo local. Crea (o reutiliza si ya existen) un usuario por cada rol,
// 3 proyectos DEMO y varios pedidos de ejemplo en distintos estados/familias, para que alguien
// que haga `git pull` tenga datos con los que probar la app sin necesitar la BD real del cliente.
//
// Requiere que las migraciones (Base_de_Datos/migrations/*.sql o HEG_BD_railway.sql) ya se hayan
// aplicado en la BD apuntada por Backend/.env (los roles deben existir).
//
// Uso: cd Backend && npm run seed
//
// Es seguro volver a correrlo: usuarios y pedidos se detectan por su nombre/clave y no se
// duplican; a los usuarios existentes se les vuelve a poner la contraseña HEG123.
import { queryAsync, db } from "../config/db.js";
import { hashPassword } from "../helpers/password.js";

const PASSWORD_DUMMY = "HEG123";

const USUARIOS = [
  { nombre_usuario: "superadmin_demo", rol: "Superadmin" },
  { nombre_usuario: "aprobador_demo", rol: "Aprobador" },
  { nombre_usuario: "supervisor_demo", rol: "Supervisor" },
  { nombre_usuario: "supervisor_dem2", rol: "Supervisor" },
  { nombre_usuario: "ingeniero_demo", rol: "Ingeniero" },
  { nombre_usuario: "contador_demo", rol: "Contador" },
  { nombre_usuario: "visor_demo", rol: "Visor" },
];

const PROYECTOS = [
  {
    nombre: "DEMO 001 - Torre Aurora",
    fecha_proyecto: "2026-01-15",
    estado: "en_progreso",
    presupuesto_cristal: 500000,
    presupuesto_aluminio: 400000,
    presupuesto_miscelaneos: 100000,
    supervisores: ["supervisor_demo"],
  },
  {
    nombre: "DEMO 002 - Plaza Central",
    fecha_proyecto: "2026-03-01",
    estado: "en_progreso",
    presupuesto_cristal: 250000,
    presupuesto_aluminio: 150000,
    presupuesto_miscelaneos: 50000,
    supervisores: ["supervisor_demo"],
  },
  {
    nombre: "DEMO 003 - Residencial Norte",
    fecha_proyecto: "2025-09-10",
    estado: "completado",
    presupuesto_cristal: 300000,
    presupuesto_aluminio: 300000,
    presupuesto_miscelaneos: 80000,
    supervisores: ["supervisor_dem2"],
  },
];

// familia, pedido, estado, líneas de detalle
const PEDIDOS_POR_PROYECTO = {
  "DEMO 001 - Torre Aurora": [
    { pedido: "P-001", familia: "CR", estado: "levantado", proveedor: "Vidrios del Sureste" },
    { pedido: "P-002", familia: "AL", estado: "aprobado", proveedor: "Aluminios HEG" },
    { pedido: "P-003", familia: "MI", estado: "rechazado", proveedor: "Ferretería Central" },
  ],
  "DEMO 002 - Plaza Central": [
    { pedido: "P-001", familia: "MI", estado: "levantado", proveedor: "Ferretería Central" },
    { pedido: "P-002", familia: "CR", estado: "aprobado", proveedor: "Vidrios del Sureste" },
  ],
  "DEMO 003 - Residencial Norte": [
    { pedido: "P-001", familia: "AL", estado: "aprobado", proveedor: "Aluminios HEG" },
  ],
};

async function getRoleId(nombreRol) {
  const rows = await queryAsync("SELECT id_rol FROM roles WHERE nombre = ? LIMIT 1", [nombreRol]);
  if (!rows || rows.length === 0) {
    throw new Error(
      `No existe el rol "${nombreRol}". Corre las migraciones (Base_de_Datos/migrations) antes de este script.`
    );
  }
  return rows[0].id_rol;
}

async function upsertUsuario(nombreUsuario, nombreRol) {
  const idRol = await getRoleId(nombreRol);
  const hash = await hashPassword(PASSWORD_DUMMY);
  const existentes = await queryAsync("SELECT id_usuario FROM usuarios WHERE nombre_usuario = ? LIMIT 1", [
    nombreUsuario,
  ]);
  if (existentes.length > 0) {
    const idUsuario = existentes[0].id_usuario;
    await queryAsync("UPDATE usuarios SET id_rol = ?, contrasena = ? WHERE id_usuario = ?", [
      idRol,
      hash,
      idUsuario,
    ]);
    return idUsuario;
  }
  const result = await queryAsync("INSERT INTO usuarios (nombre_usuario, id_rol, contrasena) VALUES (?, ?, ?)", [
    nombreUsuario,
    idRol,
    hash,
  ]);
  return result.insertId;
}

async function findOrCreateProyecto(p) {
  const existentes = await queryAsync("SELECT id_proyecto FROM proyectos WHERE nombre = ? LIMIT 1", [p.nombre]);
  if (existentes.length > 0) return existentes[0].id_proyecto;
  const total = p.presupuesto_cristal + p.presupuesto_aluminio + p.presupuesto_miscelaneos;
  const result = await queryAsync(
    `INSERT INTO proyectos
      (nombre, fecha_proyecto, estado, presupuesto, presupuesto_cristal, presupuesto_aluminio, presupuesto_miscelaneos, presupuesto_total)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [p.nombre, p.fecha_proyecto, p.estado, total, p.presupuesto_cristal, p.presupuesto_aluminio, p.presupuesto_miscelaneos, total]
  );
  return result.insertId;
}

async function asignarSupervisor(idProyecto, idUsuario) {
  await queryAsync("INSERT IGNORE INTO supervisores_proyectos (id_usuario, id_proyecto) VALUES (?, ?)", [
    idUsuario,
    idProyecto,
  ]);
}

async function insertDetalle(idPedido, familia) {
  if (familia === "CR") {
    await queryAsync(
      `INSERT INTO pedidos_detalles_cristal
        (id_pedido, descripcion, clave_modelo, ancho, largo, m2_corte, piezas, m2_pedido, precio_unitario)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [idPedido, "Cristal templado 6mm", "CR-DEMO", 1.2, 2.1, 2.52, 4, 10.08, 850]
    );
    return;
  }
  if (familia === "AL") {
    await queryAsync(
      `INSERT INTO pedidos_detalles_aluminio
        (id_pedido, numero_perfil, descripcion, medida_tramo, unidad, peso_kg_ml, total_tramos, ml, kg, m2, importe)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [idPedido, "PA-100", "Perfil marco ventana", 6.0, "TRAMO", 1.8, 10, 60, 108, 24, 18500]
    );
    // El importe de aluminio se captura manual (no hay trigger de BD que lo calcule) — se refleja
    // en pedidos.importe_total sumando las líneas insertadas.
    await queryAsync(
      `UPDATE pedidos SET importe_total = (
         SELECT IFNULL(SUM(importe), 0) FROM pedidos_detalles_aluminio WHERE id_pedido = ?
       ) WHERE id = ?`,
      [idPedido, idPedido]
    );
    return;
  }
  await queryAsync(
    `INSERT INTO pedidos_detalles_miscelaneos
      (id_pedido, descripcion, unidad, medida, cantidad, precio_unitario, clave)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [idPedido, "Silicón estructural", "CAJA", "PZA", 20, 145, "MI-DEMO"]
  );
}

async function crearPedido(idProyecto, nombreProyecto, def, idAprobador) {
  const existente = await queryAsync("SELECT id FROM pedidos WHERE id_proyecto = ? AND pedido = ? LIMIT 1", [
    idProyecto,
    def.pedido,
  ]);
  if (existente.length > 0) return { id: existente[0].id, esNuevo: false };

  const esResuelto = def.estado === "aprobado" || def.estado === "rechazado";
  const result = await queryAsync(
    `INSERT INTO pedidos
      (id_proyecto, nombre_proyecto, pedido, clan, familia, proveedor, fecha_aprobacion, concepto,
       situaciones_especiales, porcentaje_descuento, importe_total, nombre_usuario, estado,
       id_aprobador, fecha_levantado, fecha_resolucion)
     VALUES (?, ?, ?, ?, ?, ?, CURDATE(), ?, '', 0, 0, ?, ?, ?, NOW(), ?)`,
    [
      idProyecto,
      nombreProyecto,
      def.pedido,
      "C1",
      def.familia,
      def.proveedor,
      "Material de obra (dummy)",
      "aprobador_demo",
      def.estado,
      esResuelto ? idAprobador : null,
      esResuelto ? new Date() : null,
    ]
  );
  const idPedido = result.insertId;
  await insertDetalle(idPedido, def.familia);

  if (esResuelto) {
    await queryAsync(
      `INSERT INTO pedidos_historial_estados (id_pedido, estado_anterior, estado_nuevo, id_usuario, comentario)
       VALUES (?, 'levantado', ?, ?, ?)`,
      [idPedido, def.estado, idAprobador, def.estado === "rechazado" ? "Rechazado (dato dummy)" : null]
    );
  }
  return { id: idPedido, esNuevo: true };
}

async function main() {
  console.log(`Poblando datos dummy en la base "${process.env.DB_NAME}" (${process.env.DB_HOST})...`);

  const idsUsuarios = {};
  for (const u of USUARIOS) {
    idsUsuarios[u.nombre_usuario] = await upsertUsuario(u.nombre_usuario, u.rol);
  }
  console.log(`Usuarios listos (contraseña "${PASSWORD_DUMMY}" para todos):`);
  for (const u of USUARIOS) {
    console.log(`  - ${u.nombre_usuario} / ${PASSWORD_DUMMY}  (${u.rol})`);
  }

  const idAprobador = idsUsuarios["aprobador_demo"];
  let pedidosCreados = 0;

  for (const p of PROYECTOS) {
    const idProyecto = await findOrCreateProyecto(p);
    for (const nombreSupervisor of p.supervisores) {
      await asignarSupervisor(idProyecto, idsUsuarios[nombreSupervisor]);
    }
    const defs = PEDIDOS_POR_PROYECTO[p.nombre] || [];
    for (const def of defs) {
      const { esNuevo } = await crearPedido(idProyecto, p.nombre, def, idAprobador);
      if (esNuevo) pedidosCreados += 1;
    }
    console.log(`  - Proyecto "${p.nombre}" (id ${idProyecto}, ${p.estado}) listo`);
  }

  console.log(`Pedidos nuevos insertados: ${pedidosCreados}`);
  console.log("Listo.");
}

main()
  .then(() => {
    db.end();
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error poblando datos dummy:", err);
    db.end();
    process.exit(1);
  });
