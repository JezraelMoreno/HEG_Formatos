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

-- Tabla de proyectos

CREATE TABLE IF NOT EXISTS proyectos (
  id_proyecto INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(50),
  fecha_proyecto DATE
);

-- Tabla de pedidos

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
  importe_total DECIMAL(15,2) DEFAULT 0.00,         --  Total del pedido (se actualiza por trigger)
  nombre_usuario VARCHAR(50) NOT NULL,              --  Usuario que subió el pedido

  CONSTRAINT uk_pedido_proyecto UNIQUE (id_proyecto, pedido),

  CONSTRAINT fk_proyecto_pedido
    FOREIGN KEY (id_proyecto) REFERENCES proyectos(id_proyecto)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT fk_usuario_pedido
    FOREIGN KEY (nombre_usuario) REFERENCES usuarios(nombre_usuario)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

-- Tabla de pedido_detalles

CREATE TABLE IF NOT EXISTS pedido_detalles (
  id_detalle INT AUTO_INCREMENT PRIMARY KEY,
  id_pedido INT NOT NULL,                           -- Relación con pedido
  descripcion VARCHAR(255) NOT NULL,                -- Ej. "BOBINA POLIESTER VERDE - FOLIO PROTECTOR"
  unidad VARCHAR(100),                              -- Ej. "CARTON CORRUGADO DE"
  medida VARCHAR(100),                              -- Ej. "1x2 m", "mm", etc.
  cantidad INT DEFAULT 0,                           -- Ej. 9
  precio_unitario DECIMAL(15,2) DEFAULT 0.00,       -- Ej. 3736.46
  importe DECIMAL(15,2) DEFAULT 0.00,               -- 🔹 Calculado automáticamente
  clave VARCHAR(50),                                -- Ej. "PVA0010071"
  ml DECIMAL(15,2) DEFAULT NULL,                    -- Metros lineales
  acabado VARCHAR(100),                             -- Tipo de acabado
  kg DECIMAL(15,2) DEFAULT NULL,                    -- Peso en kilogramos
  precio_x_kg DECIMAL(15,2) DEFAULT NULL,           -- Precio por kilogramo
  fecha_registro DATE DEFAULT (CURRENT_DATE()),

  CONSTRAINT fk_pedido_detalle
    FOREIGN KEY (id_pedido) REFERENCES pedidos(id)
      ON DELETE CASCADE
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
  contratado_a_fecha DECIMAL(15,2) DEFAULT 0.00,
  mano_obra DECIMAL(15,2) DEFAULT 0.00,
  cobrado_total DECIMAL(15,2) DEFAULT 0.00,
  por_cobrar_total DECIMAL(15,2) DEFAULT 0.00,
  fondo_garantia DECIMAL(15,2) DEFAULT 0.00,
  liquido_por_cobrar DECIMAL(15,2) DEFAULT 0.00,

  -- DETALLE DE FACTURAS / ESTIMACIONES
  numero INT,
  fecha DATE,
  numero_factura VARCHAR(50),
  concepto VARCHAR(100),
  importe_a_cobrar DECIMAL(15,2) DEFAULT 0.00,
  importe_cobrado DECIMAL(15,2) DEFAULT 0.00,
  saldo_por_cobrar DECIMAL(15,2) DEFAULT 0.00,
  fecha_pago DATE,
  periodo VARCHAR(50),

  -- CONTROL INTERNO
  fecha_reporte DATE DEFAULT (CURRENT_DATE()),

  FOREIGN KEY (id_proyecto) REFERENCES proyectos(id_proyecto)
);


-- TRIGGERS AUTOMÁTICOS PARA IMPORTES

DELIMITER //

-- 🔹 1. Calcular importe de cada detalle (cantidad * precio_unitario)
CREATE TRIGGER trg_detalle_before_insert
BEFORE INSERT ON pedido_detalles
FOR EACH ROW
BEGIN
  SET NEW.importe = NEW.cantidad * NEW.precio_unitario;
END;
//

CREATE TRIGGER trg_detalle_before_update
BEFORE UPDATE ON pedido_detalles
FOR EACH ROW
BEGIN
  SET NEW.importe = NEW.cantidad * NEW.precio_unitario;
END;
//

-- 2. Actualizar importe_total en pedidos al insertar, actualizar o eliminar detalles
CREATE TRIGGER trg_detalle_after_insert
AFTER INSERT ON pedido_detalles
FOR EACH ROW
BEGIN
  UPDATE pedidos
  SET importe_total = (
    SELECT IFNULL(SUM(importe), 0)
    FROM pedido_detalles
    WHERE id_pedido = NEW.id_pedido
  )
  WHERE id = NEW.id_pedido;
END;
//

CREATE TRIGGER trg_detalle_after_update
AFTER UPDATE ON pedido_detalles
FOR EACH ROW
BEGIN
  UPDATE pedidos
  SET importe_total = (
    SELECT IFNULL(SUM(importe), 0)
    FROM pedido_detalles
    WHERE id_pedido = NEW.id_pedido
  )
  WHERE id = NEW.id_pedido;
END;
//

CREATE TRIGGER trg_detalle_after_delete
AFTER DELETE ON pedido_detalles
FOR EACH ROW
BEGIN
  UPDATE pedidos
  SET importe_total = (
    SELECT IFNULL(SUM(importe), 0)
    FROM pedido_detalles
    WHERE id_pedido = OLD.id_pedido
  )
  WHERE id = OLD.id_pedido;
END;
//

DELIMITER ;
