-- =============================================================================
-- Migración: Pedidos tipo "anticipo" + aplicación de su saldo a pedidos futuros
-- =============================================================================
-- Contexto: un "anticipo" es un pre-pago genérico a un proveedor (ej. KG de
-- aluminio crudo, M² de acabado) antes de conocer el detalle exacto de
-- perfiles/piezas. Disponible para los 3 tipos de pedido (cristal/aluminio/
-- misceláneos) — `familia` en un anticipo sigue indicando a qué material
-- pre-paga, `es_anticipo` es un flag ortogonal que activa un shape de detalle
-- distinto (concepto libre + unidad + cantidad + precio_unitario, sin los
-- campos específicos de perfil/pieza de cada familia).
--
-- Su saldo se va aplicando a pedidos reales futuros de la MISMA familia y
-- MISMO proyecto: `pedidos_anticipo_aplicaciones` guarda, por pedido destino,
-- cuánto se descontó de qué anticipo (v1: un anticipo por pedido destino,
-- UNIQUE(id_pedido_destino) — no es un ledger histórico, es una fila mutable
-- que se actualiza/borra si el detalle del destino cambia). `monto_cubierto_
-- anticipo` en `pedidos` persiste ese monto para que `importe_total` siga
-- siendo "lo que realmente falta pagar" y el valor real del material se pueda
-- reconstruir (importe_total + monto_cubierto_anticipo) para reportes.
--
-- ON DELETE RESTRICT en las FKs de aplicaciones (a diferencia del CASCADE de
-- pedidos_historial_estados): borrar un pedido con aplicaciones vivas debe
-- fallar explícitamente; Backend/controllers/pedidos.controller.js valida
-- antes y da un mensaje amigable en vez de dejar que MySQL tire el error.
--
-- Requiere haber corrido las migraciones 001-010 antes.
-- Ejecutar UNA SOLA VEZ.
-- =============================================================================

ALTER TABLE pedidos
  ADD COLUMN es_anticipo TINYINT(1) NOT NULL DEFAULT 0 AFTER familia,
  ADD COLUMN monto_cubierto_anticipo DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER importe_total;

CREATE TABLE IF NOT EXISTS pedidos_detalles_anticipo (
  id_detalle INT AUTO_INCREMENT PRIMARY KEY,
  id_pedido INT NOT NULL,
  concepto VARCHAR(150) NOT NULL,
  unidad VARCHAR(50) NULL,
  cantidad DECIMAL(15,3) NOT NULL DEFAULT 0,
  precio_unitario DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  importe DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  fecha_registro DATE DEFAULT (CURRENT_DATE()),
  FOREIGN KEY (id_pedido) REFERENCES pedidos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pedidos_anticipo_aplicaciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_pedido_anticipo INT NOT NULL,
  id_pedido_destino INT NOT NULL,
  monto_aplicado DECIMAL(15,2) NOT NULL,
  id_usuario INT NOT NULL,
  fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uk_pedido_destino UNIQUE (id_pedido_destino),
  INDEX idx_anticipo (id_pedido_anticipo),
  FOREIGN KEY (id_pedido_anticipo) REFERENCES pedidos(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (id_pedido_destino) REFERENCES pedidos(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Verificación
SELECT id, pedido, familia, es_anticipo, importe_total, monto_cubierto_anticipo FROM pedidos WHERE es_anticipo = 1 LIMIT 20;
SELECT * FROM pedidos_anticipo_aplicaciones LIMIT 20;
