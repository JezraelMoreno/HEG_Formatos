-- =============================================================================
-- Migración: Precio de aluminio en USD/MXN + tipo de cambio, por pedido
-- =============================================================================
-- Contexto: el proveedor de aluminio cotiza un precio por kg (y, cuando aplica
-- pintura, un precio por m²) en USD, y ese precio varía de pedido a pedido según
-- la cotización vigente. Antes el importe se convertía a mano fuera del sistema
-- y se capturaba ya en pesos. Estos 4 campos se agregan a `pedidos` (no a
-- pedidos_detalles_aluminio ni a una tabla nueva) porque el precio es UNO por
-- pedido completo, no por línea de detalle — confirmado con los formatos reales
-- de proveedor en Documentacion/PED-01 ALUBIN aluminio...csv.
--
-- Los DEFAULT dejan a todo pedido de aluminio existente en moneda_aluminio='MXN',
-- tipo_cambio=1.0000 (multiplicador neutro) y precios NULL — no altera ningún
-- importe ya capturado; el cálculo automático solo se activa para un pedido
-- cuando alguien llena precio_aluminio_kg explícitamente (ver
-- Backend/helpers/utils.js calcularCamposAluminio).
--
-- Requiere haber corrido las migraciones 001-006 antes.
-- Ejecutar UNA SOLA VEZ.
-- =============================================================================

ALTER TABLE pedidos
  ADD COLUMN moneda_aluminio ENUM('USD','MXN') NOT NULL DEFAULT 'MXN' AFTER porcentaje_descuento,
  ADD COLUMN tipo_cambio DECIMAL(10,4) NOT NULL DEFAULT 1.0000 AFTER moneda_aluminio,
  ADD COLUMN precio_aluminio_kg DECIMAL(12,4) NULL AFTER tipo_cambio,
  ADD COLUMN precio_pintura_m2 DECIMAL(12,4) NULL AFTER precio_aluminio_kg;

-- Verificación
SELECT id, pedido, familia, moneda_aluminio, tipo_cambio, precio_aluminio_kg, precio_pintura_m2
FROM pedidos WHERE familia IN ('AL', 'MQAL') LIMIT 20;
