-- Agregar columna estado a la tabla proyectos
ALTER TABLE proyectos
ADD COLUMN estado ENUM('en_progreso', 'completado') DEFAULT 'en_progreso'
AFTER fecha_proyecto;

-- Actualizar proyectos existentes basados en la fecha
-- Proyectos antiguos (más de 90 días) se marcan como completados
UPDATE proyectos
SET estado = 'completado'
WHERE fecha_proyecto < DATE_SUB(NOW(), INTERVAL 90 DAY);

-- Proyectos recientes se quedan como en_progreso
UPDATE proyectos
SET estado = 'en_progreso'
WHERE fecha_proyecto >= DATE_SUB(NOW(), INTERVAL 90 DAY);
