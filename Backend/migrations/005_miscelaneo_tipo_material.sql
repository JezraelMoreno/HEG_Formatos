-- Migración 005: Agregar 'miscelaneo' al ENUM tipo_material en remisiones_control y remisiones_historial_entregas

ALTER TABLE remisiones_control
  MODIFY COLUMN tipo_material ENUM('aluminio', 'cristal', 'miscelaneo') NOT NULL;

ALTER TABLE remisiones_historial_entregas
  MODIFY COLUMN tipo_material ENUM('aluminio', 'cristal', 'miscelaneo') NOT NULL;
