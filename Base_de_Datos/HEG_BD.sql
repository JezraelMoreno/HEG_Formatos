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
-- si se hace, carmen probablemente no sabrá como usar el sistema. 
-- Esta tabla no sigue las mejores practicas pero funciona para lo que me pidieron 
-- ATTE: EDER

CREATE TABLE IF NOT EXISTS cobranza (
  id_cobranza INT AUTO_INCREMENT PRIMARY KEY,
  id_proyecto INT NOT NULL,
  proyecto VARCHAR(100) NOT NULL,                  -- Nombre del proyecto
  control VARCHAR(20) NOT NULL,                    -- Código de control (ej. 00431)
  importe_contratado DECIMAL(15,2) DEFAULT 0.00,   -- Importe contratado
  importe_cobrado DECIMAL(15,2) DEFAULT 0.00,      -- Importe cobrado
  importe_a_cobrar DECIMAL(15,2) DEFAULT 0.00,     -- Importe a cobrar
  fondo_garantia DECIMAL(15,2) DEFAULT 0.00,       -- Fondo de garantía
  liquido_por_cobrar DECIMAL(15,2) DEFAULT 0.00,   -- Líquido por cobrar
  facturas_por_cobrar DECIMAL(15,2) DEFAULT 0.00,  -- Facturas por cobrar
  factor DECIMAL(5,2) DEFAULT 0.00,                -- Factor (porcentaje, ej. 30%)
  indirectos_esperado DECIMAL(15,2) DEFAULT 0.00,  -- Indirectos esperado
  indirectos_cobrado DECIMAL(15,2) DEFAULT 0.00,   -- Indirectos cobrado
  indirectos_aplicado DECIMAL(15,2) DEFAULT 0.00,  -- Indirectos aplicado
  cobrado_vs_aplicado DECIMAL(15,2) DEFAULT 0.00,  -- Cobrado vs aplicado
  -- Este campo se usará internamente para obtener la factura más reciente
  numero_factura VARCHAR(50),                      -- N° factura (última o más reciente)
  fecha_factura DATE,                              -- Fecha de la factura más reciente
  fecha_reporte DATE DEFAULT (CURRENT_DATE()),     -- Fecha del reporte
  FOREIGN KEY (id_proyecto) REFERENCES proyectos(id_proyecto)
);
