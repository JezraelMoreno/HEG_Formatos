-- =============================================================================
-- Migración: Descripción general del pedido (cristal)
-- =============================================================================
-- Contexto: los pedidos de cristal necesitan un campo de descripción general
-- a nivel de todo el pedido (no por renglón). No se reutiliza `concepto`
-- (etiqueta corta ya usada en toda la app) ni `situaciones_especiales` (dispara
-- lógica de negocio en Backend/helpers/utils.js: isSalidaTlatilco() y
-- parseSituacionEspecialInfo() — reutilizarlo rompería ese parsing). El campo
-- se agrega a nivel de `pedidos` para cualquier familia, pero solo se
-- muestra/usa en la UI y el PDF cuando familia = 'CR'.
--
-- Requiere haber corrido las migraciones 001-006 antes.
-- Ejecutar UNA SOLA VEZ.
-- =============================================================================

ALTER TABLE pedidos
  ADD COLUMN descripcion_general TEXT NULL AFTER situaciones_especiales;

-- Verificación
SELECT id, pedido, familia, descripcion_general FROM pedidos WHERE familia = 'CR' LIMIT 20;
