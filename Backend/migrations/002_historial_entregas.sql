-- ============================================================
-- Migración: Agregar tablas de historial de entregas
-- Fecha: 2026-02-06
-- Descripción: Crea las tablas necesarias para el módulo de
--              historial de entregas en remisiones
-- ============================================================

-- Tabla remisiones_historial_entregas (cabecera)
CREATE TABLE IF NOT EXISTS remisiones_historial_entregas (
  id_entrega INT AUTO_INCREMENT PRIMARY KEY,
  id_pedido INT NOT NULL,
  numero_pedido VARCHAR(20) NOT NULL,
  nombre_proyecto VARCHAR(100) NOT NULL,
  tipo_material ENUM('aluminio', 'cristal') NOT NULL,
  total_items INT NOT NULL DEFAULT 0,
  total_piezas INT NOT NULL DEFAULT 0,
  observaciones TEXT,
  usuario VARCHAR(50) NOT NULL,
  fecha_entrega DATETIME DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_fecha (fecha_entrega),
  INDEX idx_pedido (id_pedido),
  INDEX idx_tipo_material (tipo_material),
  
  FOREIGN KEY (id_pedido) REFERENCES pedidos(id)
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- Tabla remisiones_historial_entregas_detalle (líneas de cada entrega)
CREATE TABLE IF NOT EXISTS remisiones_historial_entregas_detalle (
  id_detalle_entrega INT AUTO_INCREMENT PRIMARY KEY,
  id_entrega INT NOT NULL,
  id_detalle INT NOT NULL,
  cantidad_entregada INT NOT NULL DEFAULT 0,
  descripcion VARCHAR(255),
  
  FOREIGN KEY (id_entrega) REFERENCES remisiones_historial_entregas(id_entrega)
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- Mensaje de confirmación
SELECT 'Migración de historial de entregas completada exitosamente' AS resultado;
