-- Crear base de datos con UTF-8
CREATE DATABASE IF NOT EXISTS HEG_Sistema CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE HEG_Sistema;

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS usuarios (
  id_usuario INT AUTO_INCREMENT PRIMARY KEY,
  nombre_usuario VARCHAR(15) NOT NULL UNIQUE,
  contrasena VARCHAR(1000) NOT NULL
);

-- Tabla de proyectos (maestro)
CREATE TABLE IF NOT EXISTS proyectos (
  id_proyecto INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(50),
  fecha_proyecto DATE
);

-- pedidos(hija)
CREATE TABLE IF NOT EXISTS pedidos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_proyecto INT NOT NULL,
  nombre_proyecto VARCHAR(50) NOT NULL,
  pedido VARCHAR(10) NOT NULL,
  clan VARCHAR(10) NOT NULL,
  familia VARCHAR(5) NOT NULL,
  proveedor VARCHAR(20) NOT NULL,
  fecha_aprobacion DATE NOT NULL,
  concepto VARCHAR(20) NOT NULL,
  situaciones_especiales VARCHAR(20),
  importe DECIMAL(15,5) NOT NULL,
  CONSTRAINT fk_proyectos_detalle_proyecto
    FOREIGN KEY (id_proyecto) REFERENCES proyectos(id_proyecto)
);


-- Tabla cobranza (carmen)
-- Si alguien llega a cambiar esta tabla, le recomiendo encarecidamente que no lo haga
-- si se hace, carmen probablemente no sabrá como usar el sistema, esta tabla no sigue las mejores practicas
-- pero funciona para lo que me pidieron ATTE: EDER
CREATE TABLE IF NOT EXISTS cobranza(
  id_cobranza INT AUTO_INCREMENT PRIMARY KEY,
  id_proyecto INT NOT NULL,
  fecha_reporte DATE NOT NULL,                     -- Fecha general del reporte (13 junio 2025)                         -- N° (índice de fila)
  fecha_factura DATE,                              -- Fecha de la factura
  numero_factura VARCHAR(20),                      -- N° factura
  concepto_cobranza VARCHAR(100),                  -- Concepto (ej. Anticipo, estimación, etc.)
  importe_cobrar DECIMAL(15,2) DEFAULT 0.00,       -- Importe a cobrar
  importe_cobrado DECIMAL(15,2) DEFAULT 0.00,      -- Importe cobrado
  saldo_por_cobrar DECIMAL(15,2) GENERATED ALWAYS AS (importe_cobrar - importe_cobrado) STORED,
  fecha_pago DATE,                                 -- Fecha de pago
  contratado_a_fecha DECIMAL(15,2) DEFAULT 0.00,   -- Contratado a la fecha (resumen superior)
  cobrado_total DECIMAL(15,2) DEFAULT 0.00,        -- Cobrado total (resumen superior)
  por_cobrar_total DECIMAL(15,2) DEFAULT 0.00,     -- Por cobrar (resumen superior)
  fondo_garantia DECIMAL(15,2) DEFAULT 0.00,       -- Fondo de garantía (resumen superior)
  liquido_por_cobrar DECIMAL(15,2) DEFAULT 0.00,   -- Líquido por cobrar (resumen superior)
  FOREIGN KEY (id_proyecto) REFERENCES proyectos(id_proyecto)
)
