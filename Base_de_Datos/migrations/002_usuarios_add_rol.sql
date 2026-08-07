-- =============================================================================
-- Migración: Reemplazar usuarios.tipo_usuario por usuarios.id_rol (FK a roles)
-- =============================================================================
-- Contexto: unificación del sistema de roles (ver 001_create_roles.sql).
-- Entorno de pruebas sin usuarios reales todavía, así que se reemplaza
-- directamente en vez de mantener ambas columnas en paralelo.
--
-- Mapeo aplicado: administrador -> Superadmin, contador -> Contador,
-- visor -> Visor.
--
-- Requiere haber corrido 001_create_roles.sql antes.
-- Ejecutar UNA SOLA VEZ.
-- =============================================================================

-- Paso 1: agregar columna nueva (nullable por ahora, se llena en el paso 2)
ALTER TABLE usuarios ADD COLUMN id_rol INT NULL;

-- Paso 2: backfill desde tipo_usuario
UPDATE usuarios u
JOIN roles r ON (
     (u.tipo_usuario = 'administrador' AND r.nombre = 'Superadmin')
  OR (u.tipo_usuario = 'contador'      AND r.nombre = 'Contador')
  OR (u.tipo_usuario = 'visor'         AND r.nombre = 'Visor')
)
SET u.id_rol = r.id_rol;

-- Verificación intermedia: no debe haber ningún usuario sin id_rol asignado
-- antes de continuar con los pasos 3-5.
SELECT id_usuario, nombre_usuario, tipo_usuario, id_rol
FROM usuarios
WHERE id_rol IS NULL;

-- Paso 3: constraint + NOT NULL (fallará si el SELECT anterior devolvió filas)
ALTER TABLE usuarios
  ADD CONSTRAINT fk_usuarios_rol FOREIGN KEY (id_rol) REFERENCES roles(id_rol)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE usuarios MODIFY id_rol INT NOT NULL;

-- Paso 4: eliminar la columna legado
ALTER TABLE usuarios DROP COLUMN tipo_usuario;

-- Verificación final
SELECT u.id_usuario, u.nombre_usuario, r.nombre AS rol
FROM usuarios u
JOIN roles r ON r.id_rol = u.id_rol
ORDER BY u.id_usuario;
