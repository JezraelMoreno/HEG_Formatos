-- =============================================================================
-- Migración: Asignación de Supervisores a Proyectos
-- =============================================================================
-- Contexto: Contrato Ago 2026 - soporta "Lógica de asignación de Supervisores
-- a proyectos" (semana 2) y "Vista filtrada de proyectos asignados por
-- Supervisor" (semana 3).
--
-- Requiere haber corrido 001_create_roles.sql y 002_usuarios_add_rol.sql antes.
-- Ejecutar UNA SOLA VEZ.
-- =============================================================================

CREATE TABLE IF NOT EXISTS supervisores_proyectos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT NOT NULL,
  id_proyecto INT NOT NULL,
  fecha_asignacion DATETIME DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT uk_supervisor_proyecto UNIQUE (id_usuario, id_proyecto),

  FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
    ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (id_proyecto) REFERENCES proyectos(id_proyecto)
    ON UPDATE CASCADE ON DELETE CASCADE
);

-- Verificación
SELECT COUNT(*) AS total_asignaciones FROM supervisores_proyectos;
