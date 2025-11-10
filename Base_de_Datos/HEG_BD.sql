-- Crear base de datos con UTF-8
CREATE DATABASE IF NOT EXISTS HEG_Sistema CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE HEG_Sistema;

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS usuarios (
  id_usuario INT AUTO_INCREMENT PRIMARY KEY,
  nombre_usuario VARCHAR(15) NOT NULL UNIQUE,
  tipo_usuario ENUM("contador", "administrador") NOT NULL,
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
  familia VARCHAR(10) NOT NULL,
  proveedor VARCHAR(100) NOT NULL,
  fecha_aprobacion DATE NOT NULL,
  concepto VARCHAR(100) NOT NULL,
  situaciones_especiales VARCHAR(100),
  importe DECIMAL(15,5) NOT NULL,
  CONSTRAINT fk_proyectos_detalle_proyecto
    FOREIGN KEY (id_proyecto) REFERENCES proyectos(id_proyecto)
);


-- Tabla cobranza (carmen)
-- Si alguien llega a cambiar esta tabla, le recomiendo encarecidamente que no lo haga
-- si se hace, carmen probablemente no sabrá como usar el sistema. 
-- Esta tabla no sigue las mejores practicas pero funciona para lo que me pidieron 
-- ATTE: EDER

CREATE TABLE IF NOT EXISTS cobranza (
  id_cobranza INT AUTO_INCREMENT PRIMARY KEY,
  id_proyecto INT NOT NULL,

  -- ENCABEZADO DEL REPORTE
  contratado_a_fecha DECIMAL(15,2) DEFAULT 0.00,   -- Contratado a la fecha
  mano_obra DECIMAL(15,2) DEFAULT 0.00,            -- Mano de obra
  cobrado_total DECIMAL(15,2) DEFAULT 0.00,        -- Cobrado
  por_cobrar_total DECIMAL(15,2) DEFAULT 0.00,     -- Por cobrar
  fondo_garantia DECIMAL(15,2) DEFAULT 0.00,       -- Fondo de garantía
  liquido_por_cobrar DECIMAL(15,2) DEFAULT 0.00,   -- Líquido por cobrar

  -- DETALLE DE FACTURAS / ESTIMACIONES
  numero INT,                                      -- N° consecutivo
  fecha DATE,                                      -- Fecha de la factura o estimación
  numero_factura VARCHAR(50),                      -- N° factura (ej. 4143)
  concepto VARCHAR(100),                           -- Concepto (ej. EST 22, ANTICIPO OC-01, etc.)
  importe_a_cobrar DECIMAL(15,2) DEFAULT 0.00,     -- Importe a cobrar
  importe_cobrado DECIMAL(15,2) DEFAULT 0.00,      -- Importe cobrado
  saldo_por_cobrar DECIMAL(15,2) DEFAULT 0.00,     -- Saldo por cobrar
  fecha_pago DATE,                                 -- Fecha de pago
  periodo VARCHAR(50),                             -- Periodo (ej. '29/03/2025 AL 18/04/2025')

  -- CONTROL INTERNO
  fecha_reporte DATE DEFAULT (CURRENT_DATE()),     -- Fecha del reporte (ej. 21/10/2025)

  FOREIGN KEY (id_proyecto) REFERENCES proyectos(id_proyecto)
);