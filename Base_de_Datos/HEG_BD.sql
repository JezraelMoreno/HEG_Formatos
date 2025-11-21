-- Crear base de datos con UTF-8
CREATE DATABASE IF NOT EXISTS HEG_Sistema CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE HEG_Sistema;

------------------------------------------------------------
-- Tabla de usuarios
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
  id_usuario INT AUTO_INCREMENT PRIMARY KEY,
  nombre_usuario VARCHAR(15) NOT NULL UNIQUE,
  tipo_usuario ENUM("contador", "administrador", "visor") NOT NULL,
  contrasena VARCHAR(1000) NOT NULL
);

------------------------------------------------------------
-- Tabla de proyectos
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS proyectos (
  id_proyecto INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(50),
  fecha_proyecto DATE,
  presupuesto DECIMAL (15,2) NOT NULL
);

------------------------------------------------------------
-- Tabla de pedidos
------------------------------------------------------------
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
  porcentaje_descuento DECIMAL (6,2),

  importe_total DECIMAL(15,2) DEFAULT 0.00, 
  nombre_usuario VARCHAR(50) NOT NULL,

  CONSTRAINT uk_pedido_proyecto UNIQUE (id_proyecto, pedido),

  FOREIGN KEY (id_proyecto) REFERENCES proyectos(id_proyecto)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  FOREIGN KEY (nombre_usuario) REFERENCES usuarios(nombre_usuario)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

------------------------------------------------------------
-- Tabla pedidos_detalles_miscelaneos  (antes pedido_detalles)
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pedidos_detalles_miscelaneos (
  id_detalle INT AUTO_INCREMENT PRIMARY KEY,
  id_pedido INT NOT NULL,

  descripcion VARCHAR(255) NOT NULL,
  unidad VARCHAR(100),
  medida VARCHAR(100),

  cantidad INT DEFAULT 0,
  precio_unitario DECIMAL(15,2) DEFAULT 0.00,

  importe DECIMAL(15,2) DEFAULT 0.00,

  clave VARCHAR(50),
  ml DECIMAL(15,2) DEFAULT NULL,
  acabado VARCHAR(100),
  kg DECIMAL(15,2) DEFAULT NULL,
  precio_x_kg DECIMAL(15,2) DEFAULT NULL,

  fecha_registro DATE DEFAULT (CURRENT_DATE()),

  FOREIGN KEY (id_pedido) REFERENCES pedidos(id)
    ON DELETE CASCADE
);

------------------------------------------------------------
-- Tabla pedidos_detalles_aluminio
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pedidos_detalles_aluminio (
  id_detalle INT AUTO_INCREMENT PRIMARY KEY,
  id_pedido INT NOT NULL,

  numero_perfil VARCHAR(50),              -- N° PERFIL
  descripcion VARCHAR(255) NOT NULL,      -- DESCRIPCION
  medida_tramo DECIMAL(10,3),             -- MEDIDA (TRAMO)
  unidad VARCHAR(50),                     -- UNIDAD (ej. TRAMO)

  peso_kg_ml DECIMAL(10,3),               -- PESO (KG/ML)
  perimetro_m2_ml DECIMAL(10,3),          -- PERÍM (M2/ML)
  acabado VARCHAR(255),                   -- ACABADO

  total_tramos INT,                       -- TOTAL TRAMOS
  ml DECIMAL(15,3),                       -- M.L.
  kg DECIMAL(15,3),                       -- KG
  m2 DECIMAL(15,3),                       -- M2

  importe DECIMAL(15,2) DEFAULT 0.00,     -- IMPORTE (se captura directo)

  fecha_registro DATE DEFAULT (CURRENT_DATE()),

  FOREIGN KEY (id_pedido) REFERENCES pedidos(id)
    ON DELETE CASCADE
);

------------------------------------------------------------
-- Tabla pedidos_detalles_cristal
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pedidos_detalles_cristal (
  id_detalle INT AUTO_INCREMENT PRIMARY KEY,
  id_pedido INT NOT NULL,

  descripcion TEXT NOT NULL,
  clave_modelo VARCHAR(100),

  ancho DECIMAL(10,3),
  largo DECIMAL(10,3),
  m2_corte DECIMAL(10,3),

  piezas INT DEFAULT 0,
  m2_pedido DECIMAL(10,3),

  precio_unitario DECIMAL(15,2) DEFAULT 0.00,
  importe DECIMAL(15,2) DEFAULT 0.00,


  fecha_registro DATE DEFAULT (CURRENT_DATE()),

  FOREIGN KEY (id_pedido) REFERENCES pedidos(id)
    ON DELETE CASCADE
);

------------------------------------------------------------
-- Tabla cobranza (Carmen)
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cobranza (
  id_cobranza INT AUTO_INCREMENT PRIMARY KEY,
  id_proyecto INT NOT NULL,

  contratado_a_fecha DECIMAL(15,2) DEFAULT 0.00,
  mano_obra DECIMAL(15,2) DEFAULT 0.00,
  cobrado_total DECIMAL(15,2) DEFAULT 0.00,
  por_cobrar_total DECIMAL(15,2) DEFAULT 0.00,
  fondo_garantia DECIMAL(15,2) DEFAULT 0.00,
  liquido_por_cobrar DECIMAL(15,2) DEFAULT 0.00,

  numero INT,
  fecha DATE,
  numero_factura VARCHAR(50),
  concepto VARCHAR(100),
  importe_a_cobrar DECIMAL(15,2) DEFAULT 0.00,
  importe_cobrado DECIMAL(15,2) DEFAULT 0.00,
  saldo_por_cobrar DECIMAL(15,2) DEFAULT 0.00,
  fecha_pago DATE,
  periodo VARCHAR(50),

  fecha_reporte DATE DEFAULT (CURRENT_DATE()),

  FOREIGN KEY (id_proyecto) REFERENCES proyectos(id_proyecto)
);

------------------------------------------------------------
-- TRIGGERS PARA MISCEÁNEOS
------------------------------------------------------------
DELIMITER //

CREATE TRIGGER trg_miscel_before_insert
BEFORE INSERT ON pedidos_detalles_miscelaneos
FOR EACH ROW
BEGIN
  SET NEW.importe = NEW.cantidad * NEW.precio_unitario;
END;
//

CREATE TRIGGER trg_miscel_before_update
BEFORE UPDATE ON pedidos_detalles_miscelaneos
FOR EACH ROW
BEGIN
  SET NEW.importe = NEW.cantidad * NEW.precio_unitario;
END;
//

CREATE TRIGGER trg_miscel_after_insert
AFTER INSERT ON pedidos_detalles_miscelaneos
FOR EACH ROW
BEGIN
  UPDATE pedidos
  SET importe_total =
      IFNULL((SELECT SUM(importe) FROM pedidos_detalles_miscelaneos WHERE id_pedido = NEW.id_pedido),0)
    + IFNULL((SELECT SUM(importe) FROM pedidos_detalles_cristal WHERE id_pedido = NEW.id_pedido),0)
  WHERE id = NEW.id_pedido;
END;
//

CREATE TRIGGER trg_miscel_after_update
AFTER UPDATE ON pedidos_detalles_miscelaneos
FOR EACH ROW
BEGIN
  UPDATE pedidos
  SET importe_total =
      IFNULL((SELECT SUM(importe) FROM pedidos_detalles_miscelaneos WHERE id_pedido = NEW.id_pedido),0)
    + IFNULL((SELECT SUM(importe) FROM pedidos_detalles_cristal WHERE id_pedido = NEW.id_pedido),0)
  WHERE id = NEW.id_pedido;
END;
//

CREATE TRIGGER trg_miscel_after_delete
AFTER DELETE ON pedidos_detalles_miscelaneos
FOR EACH ROW
BEGIN
  UPDATE pedidos
  SET importe_total =
      IFNULL((SELECT SUM(importe) FROM pedidos_detalles_miscelaneos WHERE id_pedido = OLD.id_pedido),0)
    + IFNULL((SELECT SUM(importe) FROM pedidos_detalles_cristal WHERE id_pedido = OLD.id_pedido),0)
  WHERE id = OLD.id_pedido;
END;
//
------------------------------------------------------------
-- TRIGGERS PARA CRISTAL
------------------------------------------------------------

CREATE TRIGGER trg_cristal_before_insert
BEFORE INSERT ON pedidos_detalles_cristal
FOR EACH ROW
BEGIN
  SET NEW.importe = NEW.m2_pedido * NEW.precio_unitario;
END;
//

CREATE TRIGGER trg_cristal_before_update
BEFORE UPDATE ON pedidos_detalles_cristal
FOR EACH ROW
BEGIN
  SET NEW.importe = NEW.piezas * NEW.precio_unitario;
END;
//

CREATE TRIGGER trg_cristal_after_insert
AFTER INSERT ON pedidos_detalles_cristal
FOR EACH ROW
BEGIN
  UPDATE pedidos
  SET importe_total =
      IFNULL((SELECT SUM(importe) FROM pedidos_detalles_miscelaneos WHERE id_pedido = NEW.id_pedido),0)
    + IFNULL((SELECT SUM(importe) FROM pedidos_detalles_cristal WHERE id_pedido = NEW.id_pedido),0)
  WHERE id = NEW.id_pedido;
END;
//

CREATE TRIGGER trg_cristal_after_update
AFTER UPDATE ON pedidos_detalles_cristal
FOR EACH ROW
BEGIN
  UPDATE pedidos
  SET importe_total =
      IFNULL((SELECT SUM(importe) FROM pedidos_detalles_miscelaneos WHERE id_pedido = NEW.id_pedido),0)
    + IFNULL((SELECT SUM(importe) FROM pedidos_detalles_cristal WHERE id_pedido = NEW.id_pedido),0)
  WHERE id = NEW.id_pedido;
END;
//

CREATE TRIGGER trg_cristal_after_delete
AFTER DELETE ON pedidos_detalles_cristal
FOR EACH ROW
BEGIN
  UPDATE pedidos
  SET importe_total =
      IFNULL((SELECT SUM(importe) FROM pedidos_detalles_miscelaneos WHERE id_pedido = OLD.id_pedido),0)
    + IFNULL((SELECT SUM(importe) FROM pedidos_detalles_cristal WHERE id_pedido = OLD.id_pedido),0)
  WHERE id = OLD.id_pedido;
END;
//

DELIMITER ;
