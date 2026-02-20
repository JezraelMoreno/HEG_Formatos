-- ============================================================
-- Migración: Crear tabla de facturas (módulo de contabilidad)
-- Fecha: 2026-02-20
-- Descripción: Tabla para gestionar facturas de proveedores
--              (cuentas por pagar) ligadas a proyectos.
--              Soporta adjuntar PDF (requerido) y XML (opcional).
-- ============================================================

CREATE TABLE IF NOT EXISTS facturas (
  id_factura      INT AUTO_INCREMENT PRIMARY KEY,
  id_proyecto     INT NOT NULL,
  proveedor       VARCHAR(255) NOT NULL,
  concepto        VARCHAR(500) NOT NULL,
  categoria       ENUM('materiales', 'mano_de_obra', 'flete', 'otro') NOT NULL DEFAULT 'materiales',
  total           DECIMAL(12,2) NOT NULL,
  fecha_factura   DATE NOT NULL,
  estatus         ENUM('pendiente', 'pagada', 'cancelada') NOT NULL DEFAULT 'pendiente',
  fecha_pago      DATE NULL,
  metodo_pago     VARCHAR(100) NULL,
  ruta_pdf        VARCHAR(500) NOT NULL,
  ruta_xml        VARCHAR(500) NULL,
  nombre_usuario  VARCHAR(100) NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_proyecto (id_proyecto),
  INDEX idx_estatus (estatus),
  INDEX idx_fecha_factura (fecha_factura),

  FOREIGN KEY (id_proyecto) REFERENCES proyectos(id_proyecto)
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- Mensaje de confirmación
SELECT 'Migración 004: tabla facturas creada exitosamente' AS resultado;
