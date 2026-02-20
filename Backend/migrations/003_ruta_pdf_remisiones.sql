-- ============================================================
-- Migración: Agregar columna ruta_pdf a historial de entregas
-- Fecha: 2026-02-20
-- Descripción: Permite adjuntar un PDF de control al momento
--              de registrar una entrega en el módulo de remisiones
-- ============================================================

ALTER TABLE remisiones_historial_entregas
  ADD COLUMN ruta_pdf VARCHAR(500) NULL AFTER observaciones;

-- Mensaje de confirmación
SELECT 'Migración 003: columna ruta_pdf agregada a remisiones_historial_entregas' AS resultado;
