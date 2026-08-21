-- ============================================================================
-- Datos dummy para desarrollo local — HEG Formatos
-- ============================================================================
-- Para quien haga `git pull` y necesite datos con qué probar la app sin la BD
-- real del cliente. Ejecutar completo (de un tirón) en MySQL Workbench, con el
-- esquema de HEG_Sistema ya seleccionado como base de datos activa.
--
-- Requisito: las migraciones ya deben estar aplicadas (Base_de_Datos/migrations/
-- 001 a 005, o el HEG_BD_railway.sql completo) — este script es solo DATOS, no
-- crea tablas. Los 6 roles (Superadmin, Aprobador, Supervisor, Ingeniero,
-- Contador, Visor) deben existir ya en la tabla `roles`.
--
-- Contraseña para TODOS los usuarios que crea este script: HEG123
-- (hash bcrypt precomputado abajo — MySQL no tiene función bcrypt nativa).
--
-- Seguro volver a ejecutarlo: al inicio borra los proyectos "DEMO %" y los
-- usuarios *_demo anteriores (la baja de un proyecto arrastra en cascada sus
-- pedidos, detalles, historial de estados y asignaciones de supervisor).
-- ============================================================================

-- 1) Limpieza de una corrida anterior de este mismo script (si existiera)
DELETE FROM proyectos WHERE nombre LIKE 'DEMO %';
DELETE FROM usuarios WHERE nombre_usuario IN (
  'superadmin_demo', 'aprobador_demo', 'supervisor_demo', 'supervisor_dem2',
  'ingeniero_demo', 'contador_demo', 'visor_demo'
);

-- 2) Usuarios — uno por rol
INSERT INTO usuarios (nombre_usuario, id_rol, contrasena)
VALUES ('superadmin_demo', (SELECT id_rol FROM roles WHERE nombre = 'Superadmin'),
        '$2b$10$rn6EAAelcqFNCiSfXAzJ3uZLaff22VWMylWgik0/8rSiKa5qXcIZ.');
SET @id_superadmin = LAST_INSERT_ID();

INSERT INTO usuarios (nombre_usuario, id_rol, contrasena)
VALUES ('aprobador_demo', (SELECT id_rol FROM roles WHERE nombre = 'Aprobador'),
        '$2b$10$rn6EAAelcqFNCiSfXAzJ3uZLaff22VWMylWgik0/8rSiKa5qXcIZ.');
SET @id_aprobador = LAST_INSERT_ID();

INSERT INTO usuarios (nombre_usuario, id_rol, contrasena)
VALUES ('supervisor_demo', (SELECT id_rol FROM roles WHERE nombre = 'Supervisor'),
        '$2b$10$rn6EAAelcqFNCiSfXAzJ3uZLaff22VWMylWgik0/8rSiKa5qXcIZ.');
SET @id_supervisor1 = LAST_INSERT_ID();

INSERT INTO usuarios (nombre_usuario, id_rol, contrasena)
VALUES ('supervisor_dem2', (SELECT id_rol FROM roles WHERE nombre = 'Supervisor'),
        '$2b$10$rn6EAAelcqFNCiSfXAzJ3uZLaff22VWMylWgik0/8rSiKa5qXcIZ.');
SET @id_supervisor2 = LAST_INSERT_ID();

INSERT INTO usuarios (nombre_usuario, id_rol, contrasena)
VALUES ('ingeniero_demo', (SELECT id_rol FROM roles WHERE nombre = 'Ingeniero'),
        '$2b$10$rn6EAAelcqFNCiSfXAzJ3uZLaff22VWMylWgik0/8rSiKa5qXcIZ.');
SET @id_ingeniero = LAST_INSERT_ID();

INSERT INTO usuarios (nombre_usuario, id_rol, contrasena)
VALUES ('contador_demo', (SELECT id_rol FROM roles WHERE nombre = 'Contador'),
        '$2b$10$rn6EAAelcqFNCiSfXAzJ3uZLaff22VWMylWgik0/8rSiKa5qXcIZ.');
SET @id_contador = LAST_INSERT_ID();

INSERT INTO usuarios (nombre_usuario, id_rol, contrasena)
VALUES ('visor_demo', (SELECT id_rol FROM roles WHERE nombre = 'Visor'),
        '$2b$10$rn6EAAelcqFNCiSfXAzJ3uZLaff22VWMylWgik0/8rSiKa5qXcIZ.');
SET @id_visor = LAST_INSERT_ID();

-- 3) Proyectos DEMO (dos en progreso, uno completado — para ver el checklist
--    de asignación de supervisores con proyectos atenuados)
INSERT INTO proyectos (nombre, fecha_proyecto, estado, presupuesto, presupuesto_cristal, presupuesto_aluminio, presupuesto_miscelaneos, presupuesto_total)
VALUES ('DEMO 001 - Torre Aurora', '2026-01-15', 'en_progreso', 1000000, 500000, 400000, 100000, 1000000);
SET @id_proy1 = LAST_INSERT_ID();

INSERT INTO proyectos (nombre, fecha_proyecto, estado, presupuesto, presupuesto_cristal, presupuesto_aluminio, presupuesto_miscelaneos, presupuesto_total)
VALUES ('DEMO 002 - Plaza Central', '2026-03-01', 'en_progreso', 450000, 250000, 150000, 50000, 450000);
SET @id_proy2 = LAST_INSERT_ID();

INSERT INTO proyectos (nombre, fecha_proyecto, estado, presupuesto, presupuesto_cristal, presupuesto_aluminio, presupuesto_miscelaneos, presupuesto_total)
VALUES ('DEMO 003 - Residencial Norte', '2025-09-10', 'completado', 680000, 300000, 300000, 80000, 680000);
SET @id_proy3 = LAST_INSERT_ID();

-- 4) Asignación de Supervisores a proyectos (supervisor_demo ve 2 proyectos,
--    supervisor_dem2 ve el tercero — para probar el filtrado por Supervisor)
INSERT INTO supervisores_proyectos (id_usuario, id_proyecto) VALUES
  (@id_supervisor1, @id_proy1),
  (@id_supervisor1, @id_proy2),
  (@id_supervisor2, @id_proy3);

-- 5) Pedidos de ejemplo — una familia y un estado distinto en cada uno
--    (nombre_usuario siempre 'aprobador_demo': quien "levanta" el pedido)

-- DEMO 001 - Torre Aurora / P-001 / Cristal / levantado
INSERT INTO pedidos
  (id_proyecto, nombre_proyecto, pedido, clan, familia, proveedor, fecha_aprobacion, concepto,
   situaciones_especiales, porcentaje_descuento, importe_total, nombre_usuario, estado,
   id_aprobador, fecha_levantado, fecha_resolucion)
VALUES
  (@id_proy1, 'DEMO 001 - Torre Aurora', 'P-001', 'C1', 'CR', 'Vidrios del Sureste', CURDATE(),
   'Material de obra (dummy)', '', 0, 0, 'aprobador_demo', 'levantado', NULL, NOW(), NULL);
SET @id_pedido = LAST_INSERT_ID();
INSERT INTO pedidos_detalles_cristal (id_pedido, descripcion, clave_modelo, ancho, largo, m2_corte, piezas, m2_pedido, precio_unitario)
VALUES (@id_pedido, 'Cristal templado 6mm', 'CR-DEMO', 1.2, 2.1, 2.52, 4, 10.08, 850);
-- importe_total se calcula solo (trigger de pedidos_detalles_cristal)

-- DEMO 001 - Torre Aurora / P-002 / Aluminio / aprobado
INSERT INTO pedidos
  (id_proyecto, nombre_proyecto, pedido, clan, familia, proveedor, fecha_aprobacion, concepto,
   situaciones_especiales, porcentaje_descuento, importe_total, nombre_usuario, estado,
   id_aprobador, fecha_levantado, fecha_resolucion)
VALUES
  (@id_proy1, 'DEMO 001 - Torre Aurora', 'P-002', 'C1', 'AL', 'Aluminios HEG', CURDATE(),
   'Material de obra (dummy)', '', 0, 0, 'aprobador_demo', 'aprobado', @id_aprobador, NOW(), NOW());
SET @id_pedido = LAST_INSERT_ID();
INSERT INTO pedidos_detalles_aluminio (id_pedido, numero_perfil, descripcion, medida_tramo, unidad, peso_kg_ml, total_tramos, ml, kg, m2, importe)
VALUES (@id_pedido, 'PA-100', 'Perfil marco ventana', 6.0, 'TRAMO', 1.8, 10, 60, 108, 24, 18500);
-- el importe de aluminio se captura manual (no hay trigger de BD) — se refleja a mano:
UPDATE pedidos SET importe_total = 18500 WHERE id = @id_pedido;
INSERT INTO pedidos_historial_estados (id_pedido, estado_anterior, estado_nuevo, id_usuario, comentario)
VALUES (@id_pedido, 'levantado', 'aprobado', @id_aprobador, NULL);

-- DEMO 001 - Torre Aurora / P-003 / Misceláneos / rechazado
INSERT INTO pedidos
  (id_proyecto, nombre_proyecto, pedido, clan, familia, proveedor, fecha_aprobacion, concepto,
   situaciones_especiales, porcentaje_descuento, importe_total, nombre_usuario, estado,
   id_aprobador, fecha_levantado, fecha_resolucion)
VALUES
  (@id_proy1, 'DEMO 001 - Torre Aurora', 'P-003', 'C1', 'MI', 'Ferretería Central', CURDATE(),
   'Material de obra (dummy)', '', 0, 0, 'aprobador_demo', 'rechazado', @id_aprobador, NOW(), NOW());
SET @id_pedido = LAST_INSERT_ID();
INSERT INTO pedidos_detalles_miscelaneos (id_pedido, descripcion, unidad, medida, cantidad, precio_unitario, clave)
VALUES (@id_pedido, 'Silicón estructural', 'CAJA', 'PZA', 20, 145, 'MI-DEMO');
-- importe_total se calcula solo (trigger de pedidos_detalles_miscelaneos)
INSERT INTO pedidos_historial_estados (id_pedido, estado_anterior, estado_nuevo, id_usuario, comentario)
VALUES (@id_pedido, 'levantado', 'rechazado', @id_aprobador, 'Rechazado (dato dummy)');

-- DEMO 002 - Plaza Central / P-001 / Misceláneos / levantado
INSERT INTO pedidos
  (id_proyecto, nombre_proyecto, pedido, clan, familia, proveedor, fecha_aprobacion, concepto,
   situaciones_especiales, porcentaje_descuento, importe_total, nombre_usuario, estado,
   id_aprobador, fecha_levantado, fecha_resolucion)
VALUES
  (@id_proy2, 'DEMO 002 - Plaza Central', 'P-001', 'C1', 'MI', 'Ferretería Central', CURDATE(),
   'Material de obra (dummy)', '', 0, 0, 'aprobador_demo', 'levantado', NULL, NOW(), NULL);
SET @id_pedido = LAST_INSERT_ID();
INSERT INTO pedidos_detalles_miscelaneos (id_pedido, descripcion, unidad, medida, cantidad, precio_unitario, clave)
VALUES (@id_pedido, 'Silicón estructural', 'CAJA', 'PZA', 20, 145, 'MI-DEMO');

-- DEMO 002 - Plaza Central / P-002 / Cristal / aprobado
INSERT INTO pedidos
  (id_proyecto, nombre_proyecto, pedido, clan, familia, proveedor, fecha_aprobacion, concepto,
   situaciones_especiales, porcentaje_descuento, importe_total, nombre_usuario, estado,
   id_aprobador, fecha_levantado, fecha_resolucion)
VALUES
  (@id_proy2, 'DEMO 002 - Plaza Central', 'P-002', 'C1', 'CR', 'Vidrios del Sureste', CURDATE(),
   'Material de obra (dummy)', '', 0, 0, 'aprobador_demo', 'aprobado', @id_aprobador, NOW(), NOW());
SET @id_pedido = LAST_INSERT_ID();
INSERT INTO pedidos_detalles_cristal (id_pedido, descripcion, clave_modelo, ancho, largo, m2_corte, piezas, m2_pedido, precio_unitario)
VALUES (@id_pedido, 'Cristal templado 6mm', 'CR-DEMO', 1.2, 2.1, 2.52, 4, 10.08, 850);
INSERT INTO pedidos_historial_estados (id_pedido, estado_anterior, estado_nuevo, id_usuario, comentario)
VALUES (@id_pedido, 'levantado', 'aprobado', @id_aprobador, NULL);

-- DEMO 003 - Residencial Norte / P-001 / Aluminio / aprobado
INSERT INTO pedidos
  (id_proyecto, nombre_proyecto, pedido, clan, familia, proveedor, fecha_aprobacion, concepto,
   situaciones_especiales, porcentaje_descuento, importe_total, nombre_usuario, estado,
   id_aprobador, fecha_levantado, fecha_resolucion)
VALUES
  (@id_proy3, 'DEMO 003 - Residencial Norte', 'P-001', 'C1', 'AL', 'Aluminios HEG', CURDATE(),
   'Material de obra (dummy)', '', 0, 0, 'aprobador_demo', 'aprobado', @id_aprobador, NOW(), NOW());
SET @id_pedido = LAST_INSERT_ID();
INSERT INTO pedidos_detalles_aluminio (id_pedido, numero_perfil, descripcion, medida_tramo, unidad, peso_kg_ml, total_tramos, ml, kg, m2, importe)
VALUES (@id_pedido, 'PA-100', 'Perfil marco ventana', 6.0, 'TRAMO', 1.8, 10, 60, 108, 24, 18500);
UPDATE pedidos SET importe_total = 18500 WHERE id = @id_pedido;
INSERT INTO pedidos_historial_estados (id_pedido, estado_anterior, estado_nuevo, id_usuario, comentario)
VALUES (@id_pedido, 'levantado', 'aprobado', @id_aprobador, NULL);

-- ============================================================================
-- Listo. Usuarios creados (contraseña HEG123 para todos):
--   superadmin_demo (Superadmin)   aprobador_demo (Aprobador)
--   supervisor_demo (Supervisor)   supervisor_dem2 (Supervisor)
--   ingeniero_demo (Ingeniero)     contador_demo (Contador)
--   visor_demo (Visor)
-- 3 proyectos DEMO y 6 pedidos (2 levantado, 3 aprobado, 1 rechazado).
-- ============================================================================
