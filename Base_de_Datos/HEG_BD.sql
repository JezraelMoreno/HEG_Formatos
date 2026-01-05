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
  estado ENUM('en_progreso', 'completado') NOT NULL DEFAULT 'en_progreso',
  presupuesto DECIMAL (15,2) NOT NULL,
  presupuesto_cristal DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  presupuesto_aluminio DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  presupuesto_miscelaneos DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  presupuesto_total DECIMAL(15,2) NOT NULL DEFAULT 0.00
);

------------------------------------------------------------
-- Historial de presupuestos por proyecto
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS proyectos_presupuestos_historial (
  id_historial INT AUTO_INCREMENT PRIMARY KEY,
  id_proyecto INT NOT NULL,
  fecha_presupuesto DATE NOT NULL,
  presupuesto_cristal DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  presupuesto_aluminio DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  presupuesto_miscelaneos DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  presupuesto_total DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  FOREIGN KEY (id_proyecto) REFERENCES proyectos(id_proyecto)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

------------------------------------------------------------
-- Tabla de asignaciones para explosión de insumos
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS explosion_insumos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_proyecto INT NOT NULL,
  clan VARCHAR(10) NOT NULL DEFAULT "",
  familia VARCHAR(10) NOT NULL,
  presupuesto_asignado DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uk_explosion_proyecto_familia UNIQUE (id_proyecto, clan, familia),
  FOREIGN KEY (id_proyecto) REFERENCES proyectos(id_proyecto)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

-- Para bases ya existentes, agregar columnas de presupuesto por familia:
-- ALTER TABLE proyectos ADD COLUMN presupuesto_cristal DECIMAL(15,2) NOT NULL DEFAULT 0.00;
-- ALTER TABLE proyectos ADD COLUMN presupuesto_aluminio DECIMAL(15,2) NOT NULL DEFAULT 0.00;
-- ALTER TABLE proyectos ADD COLUMN presupuesto_miscelaneos DECIMAL(15,2) NOT NULL DEFAULT 0.00;
-- ALTER TABLE proyectos ADD COLUMN presupuesto_total DECIMAL(15,2) NOT NULL DEFAULT 0.00;
-- UPDATE proyectos SET presupuesto_total = presupuesto_cristal + presupuesto_aluminio + presupuesto_miscelaneos WHERE presupuesto_total = 0;
-- Historial (si ya existe la tabla, saltará; si no, crearla):
-- CREATE TABLE proyectos_presupuestos_historial (
--   id_historial INT AUTO_INCREMENT PRIMARY KEY,
--   id_proyecto INT NOT NULL,
--   fecha_presupuesto DATE NOT NULL,
--   presupuesto_cristal DECIMAL(15,2) NOT NULL DEFAULT 0.00,
--   presupuesto_aluminio DECIMAL(15,2) NOT NULL DEFAULT 0.00,
--   presupuesto_miscelaneos DECIMAL(15,2) NOT NULL DEFAULT 0.00,
--   presupuesto_total DECIMAL(15,2) NOT NULL DEFAULT 0.00,
--   FOREIGN KEY (id_proyecto) REFERENCES proyectos(id_proyecto)
--     ON DELETE CASCADE
--     ON UPDATE CASCADE
-- );

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
-- Tabla viaticos_presupuestos
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS viaticos_presupuestos (
  id_presupuesto INT AUTO_INCREMENT PRIMARY KEY,
  id_proyecto INT NOT NULL,
  familia ENUM('Mano de Obra', 'Viáticos', 'Fletes') NOT NULL,
  presupuesto_asignado DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  gastado DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
  nombre_usuario VARCHAR(50) NOT NULL,

  CONSTRAINT uk_viaticos_proyecto_familia UNIQUE (id_proyecto, familia),
  FOREIGN KEY (id_proyecto) REFERENCES proyectos(id_proyecto)
    ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (nombre_usuario) REFERENCES usuarios(nombre_usuario)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

------------------------------------------------------------
-- Tabla viaticos_movimientos
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS viaticos_movimientos (
  id_movimiento INT AUTO_INCREMENT PRIMARY KEY,
  id_proyecto INT NOT NULL,
  familia ENUM('Mano de Obra', 'Viáticos', 'Fletes') NOT NULL,
  persona VARCHAR(255) NOT NULL,
  concepto TEXT NOT NULL,
  clave_referencia VARCHAR(100),
  fecha DATE NOT NULL,
  ingreso DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  egreso DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  saldo DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
  nombre_usuario VARCHAR(50) NOT NULL,

  INDEX idx_proyecto_familia (id_proyecto, familia),
  INDEX idx_fecha (fecha),
  FOREIGN KEY (id_proyecto) REFERENCES proyectos(id_proyecto)
    ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (nombre_usuario) REFERENCES usuarios(nombre_usuario)
    ON UPDATE CASCADE ON DELETE RESTRICT
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

------------------------------------------------------------
-- TRIGGERS PARA VIÁTICOS
------------------------------------------------------------
-- FIXED: These triggers now only update viaticos_presupuestos, not viaticos_movimientos
-- The saldo calculation is handled by the stored procedure sp_recalcular_saldos_viaticos

CREATE TRIGGER trg_viaticos_mov_after_insert
AFTER INSERT ON viaticos_movimientos
FOR EACH ROW
BEGIN
  -- Update gastado in presupuestos
  INSERT INTO viaticos_presupuestos (id_proyecto, familia, gastado, nombre_usuario, presupuesto_asignado)
  VALUES (
    NEW.id_proyecto,
    NEW.familia,
    (SELECT IFNULL(SUM(egreso) - SUM(ingreso), 0) FROM viaticos_movimientos
     WHERE id_proyecto = NEW.id_proyecto AND familia = NEW.familia),
    NEW.nombre_usuario,
    0.00
  )
  ON DUPLICATE KEY UPDATE gastado = VALUES(gastado);
END;
//

CREATE TRIGGER trg_viaticos_mov_after_update
AFTER UPDATE ON viaticos_movimientos
FOR EACH ROW
BEGIN
  UPDATE viaticos_presupuestos
  SET gastado = (
    SELECT IFNULL(SUM(egreso) - SUM(ingreso), 0) FROM viaticos_movimientos
    WHERE id_proyecto = NEW.id_proyecto AND familia = NEW.familia
  )
  WHERE id_proyecto = NEW.id_proyecto AND familia = NEW.familia;
END;
//

CREATE TRIGGER trg_viaticos_mov_after_delete
AFTER DELETE ON viaticos_movimientos
FOR EACH ROW
BEGIN
  UPDATE viaticos_presupuestos
  SET gastado = (
    SELECT IFNULL(SUM(egreso) - SUM(ingreso), 0) FROM viaticos_movimientos
    WHERE id_proyecto = OLD.id_proyecto AND familia = OLD.familia
  )
  WHERE id_proyecto = OLD.id_proyecto AND familia = OLD.familia;
END;
//

------------------------------------------------------------
-- STORED PROCEDURE FOR RECALCULATING SALDOS
------------------------------------------------------------
-- This procedure recalculates saldos for a specific project/familia
-- It's called from the application after inserting/updating/deleting movements

DROP PROCEDURE IF EXISTS sp_recalcular_saldos_viaticos;
//

CREATE PROCEDURE sp_recalcular_saldos_viaticos(
  IN p_id_proyecto INT,
  IN p_familia VARCHAR(50)
)
BEGIN
  DECLARE v_saldo DECIMAL(15,2);
  DECLARE v_id INT;
  DECLARE v_ingreso DECIMAL(15,2);
  DECLARE v_egreso DECIMAL(15,2);
  DECLARE done INT DEFAULT FALSE;

  -- Cursor to iterate through all movements ordered by date and id
  DECLARE cur CURSOR FOR
    SELECT id_movimiento, ingreso, egreso
    FROM viaticos_movimientos
    WHERE id_proyecto = p_id_proyecto AND familia = p_familia
    ORDER BY fecha ASC, id_movimiento ASC;

  -- Handler for when cursor reaches end
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

  -- Initialize running balance
  SET v_saldo = 0;

  -- Open cursor
  OPEN cur;

  -- Loop through all movements
  read_loop: LOOP
    FETCH cur INTO v_id, v_ingreso, v_egreso;

    IF done THEN
      LEAVE read_loop;
    END IF;

    -- Calculate new balance
    SET v_saldo = v_saldo + v_ingreso - v_egreso;

    -- Update the saldo for this specific movement
    UPDATE viaticos_movimientos
    SET saldo = v_saldo
    WHERE id_movimiento = v_id;
  END LOOP;

  -- Close cursor
  CLOSE cur;
END;
//

DELIMITER ;
