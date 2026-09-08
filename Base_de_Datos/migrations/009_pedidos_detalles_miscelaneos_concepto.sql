-- =============================================================================
-- Migración: Concepto por línea de detalle en pedidos de misceláneos
-- =============================================================================
-- Contexto: cada renglón del detalle de un pedido de misceláneos necesita su
-- propio campo de concepto/etiqueta corta. Se llama `concepto_detalle` (no
-- `concepto`) para no chocar con `pedidos.concepto`, que ya existe a nivel de
-- todo el pedido con otro significado (ej. "EMPAQUES").
--
-- Requiere haber corrido las migraciones 001-006 antes.
-- Ejecutar UNA SOLA VEZ.
-- =============================================================================

ALTER TABLE pedidos_detalles_miscelaneos
  ADD COLUMN concepto_detalle VARCHAR(150) NULL AFTER descripcion;

-- Verificación
SELECT id_detalle, id_pedido, descripcion, concepto_detalle FROM pedidos_detalles_miscelaneos LIMIT 20;
