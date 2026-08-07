-- =============================================================================
-- Migración: Simplificar pedidos.estado a 3 pasos + corregir descripciones de roles
-- =============================================================================
-- Contexto: CONTEXT.md (documento de definición de roles/flujo, confirmado con el
-- cliente) aclara que el flujo real de pedidos es Levantado -> Aprobado/Rechazado.
-- Daniel (rol Aprobador) hace todo el proceso él mismo: levanta el pedido, lo edita
-- y mueve su propio estado — no hay un paso separado de "enviar" a otra persona
-- para revisión. El ENUM de 4 valores creado en 003_pedidos_estado.sql
-- ('borrador','enviado','aprobado','rechazado') asumía ese paso intermedio, que no
-- existe. Se simplifica a 3 valores.
--
-- No requiere backfill de datos: todos los pedidos existentes ya quedaron en
-- 'aprobado' desde 003_pedidos_estado.sql (el ENUM viejo no tiene filas en
-- 'borrador' ni 'enviado').
--
-- También se corrige fecha_envio -> fecha_levantado (ya no hay "envío" como
-- concepto) y las descripciones de roles Aprobador/Supervisor/Ingeniero en la
-- tabla `roles`, que se habían sembrado con una definición incorrecta del flujo.
--
-- Requiere haber corrido 001-005 antes.
-- Ejecutar UNA SOLA VEZ.
-- =============================================================================

ALTER TABLE pedidos
  MODIFY COLUMN estado ENUM('levantado', 'aprobado', 'rechazado') NOT NULL DEFAULT 'levantado';

ALTER TABLE pedidos
  CHANGE COLUMN fecha_envio fecha_levantado DATETIME NULL;

ALTER TABLE pedidos_historial_estados
  MODIFY COLUMN estado_anterior ENUM('levantado', 'aprobado', 'rechazado') NULL,
  MODIFY COLUMN estado_nuevo ENUM('levantado', 'aprobado', 'rechazado') NOT NULL;

UPDATE roles SET descripcion =
  'Responsable total de los pedidos: los crea, edita, mueve el stepper de estado (Levantado/Aprobado/Rechazado) y genera las vistas previas/PDF. Es Daniel.'
  WHERE nombre = 'Aprobador';

UPDATE roles SET descripcion =
  'Consulta y monitorea los proyectos que tiene asignados (presupuestos, pedidos, avance general). No crea ni edita pedidos.'
  WHERE nombre = 'Supervisor';

UPDATE roles SET descripcion =
  'Rol existente del sistema — sin cambios en este contrato de pedidos.'
  WHERE nombre = 'Ingeniero';

-- Verificación
SELECT estado, COUNT(*) AS total FROM pedidos GROUP BY estado;
SHOW COLUMNS FROM pedidos LIKE 'fecha_levantado';
SELECT nombre, descripcion FROM roles ORDER BY id_rol;
