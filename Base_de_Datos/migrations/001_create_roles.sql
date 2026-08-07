-- =============================================================================
-- Migración: Crear tabla `roles` y sembrar catálogo inicial
-- =============================================================================
-- Contexto: Contrato Ago 2026 - refactorización del módulo de pedidos. Se
-- unifica el sistema de roles de toda la app (antes usuarios.tipo_usuario
-- ENUM('contador','administrador','visor')) en una tabla normalizada que
-- también cubre los roles nuevos del flujo de pedidos (Supervisor, Aprobador,
-- Ingeniero). El mapeo de los roles legado se aplica en 002_usuarios_add_rol.sql.
--
-- Ejecutar UNA SOLA VEZ.
-- =============================================================================

CREATE TABLE IF NOT EXISTS roles (
  id_rol INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(30) NOT NULL UNIQUE,
  descripcion VARCHAR(255)
);

INSERT INTO roles (nombre, descripcion) VALUES
  ('Superadmin', 'Acceso total al sistema, gestión de usuarios y proyectos (antes "administrador")'),
  ('Supervisor', 'Consulta y monitorea los proyectos que tiene asignados (presupuestos, pedidos, avance general). No crea ni edita pedidos.'),
  ('Aprobador', 'Responsable total de los pedidos: los crea, edita, mueve el stepper de estado (Levantado/Aprobado/Rechazado) y genera las vistas previas/PDF. Es Daniel.'),
  ('Ingeniero', 'Rol existente del sistema — sin cambios en este contrato de pedidos.'),
  ('Contador', 'Acceso a cobranza, facturas y reportes financieros (antes "contador")'),
  ('Visor', 'Acceso de solo lectura (antes "visor")')
ON DUPLICATE KEY UPDATE descripcion = VALUES(descripcion);

-- Verificación
SELECT id_rol, nombre, descripcion FROM roles ORDER BY id_rol;
