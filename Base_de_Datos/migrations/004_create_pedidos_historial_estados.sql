-- =============================================================================
-- Migración: Historial/auditoría de cambios de estado de pedidos
-- =============================================================================
-- Contexto: Contrato Ago 2026 - cubre "Historial de cambios y trazabilidad de
-- aprobaciones" (semana 4). El modelo de datos se define en semana 1 para no
-- tener que migrar de nuevo cuando se construya el módulo de Aprobador.
--
-- Requiere haber corrido 003_pedidos_estado.sql antes.
-- Ejecutar UNA SOLA VEZ.
-- =============================================================================

CREATE TABLE IF NOT EXISTS pedidos_historial_estados (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_pedido INT NOT NULL,
  estado_anterior ENUM('borrador', 'enviado', 'aprobado', 'rechazado') NULL,
  estado_nuevo ENUM('borrador', 'enviado', 'aprobado', 'rechazado') NOT NULL,
  id_usuario INT NOT NULL,
  comentario VARCHAR(500) NULL,
  fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_pedido (id_pedido),
  INDEX idx_fecha (fecha_registro),

  FOREIGN KEY (id_pedido) REFERENCES pedidos(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

-- Verificación
SELECT COUNT(*) AS total_registros FROM pedidos_historial_estados;
