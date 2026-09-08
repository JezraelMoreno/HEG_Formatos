-- =============================================================================
-- Migración: Backfill de accesos previos a generalizar la restricción de
-- proyectos por usuario (antes exclusiva del rol Supervisor)
-- =============================================================================
-- Contexto: se generaliza la restricción de visibilidad de proyectos
-- (supervisores_proyectos + requireProjectAccess*) para que aplique a
-- cualquier rol no-Superadmin, no solo Supervisor. El nuevo default es
-- estricto: sin asignaciones en supervisores_proyectos = sin proyectos
-- visibles. Como hoy Aprobador/Ingeniero/Contador/Visor ven TODOS los
-- proyectos (nunca han tenido restricciones), este backfill les otorga
-- acceso explícito a todos los proyectos existentes HOY para que nadie
-- pierda acceso el día del despliegue. Los usuarios con rol Supervisor se
-- excluyen a propósito: ya tienen su propio conjunto de accesos correcto y
-- no se debe ampliar. Proyectos creados DESPUÉS de este backfill no se
-- otorgan automáticamente a nadie (mínimo privilegio hacia adelante) — el
-- Superadmin asigna caso por caso desde el panel de usuarios.
--
-- Requiere haber corrido 001_create_roles.sql y 005_create_supervisores_proyectos.sql antes.
-- Ejecutar UNA SOLA VEZ.
-- =============================================================================

INSERT IGNORE INTO supervisores_proyectos (id_usuario, id_proyecto)
SELECT u.id_usuario, p.id_proyecto
FROM usuarios u
JOIN roles r ON u.id_rol = r.id_rol
CROSS JOIN proyectos p
WHERE LOWER(r.nombre) NOT IN ('superadmin', 'supervisor');

-- Verificación
SELECT r.nombre AS rol, COUNT(*) AS asignaciones
FROM supervisores_proyectos sp
JOIN usuarios u ON u.id_usuario = sp.id_usuario
JOIN roles r ON u.id_rol = r.id_rol
GROUP BY r.nombre;
