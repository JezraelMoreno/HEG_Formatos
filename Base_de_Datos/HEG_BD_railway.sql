-- Crear base de datos con UTF-8
-- DATABASE YA EXISTE EN RAILWAY
-- USE railway (ya seleccionada)

-- ---
-- Tabla de roles
-- ---
-- Reemplaza al ENUM usuarios.tipo_usuario ("contador","administrador","visor").
-- Ver Base_de_Datos/migrations/001_create_roles.sql y 002_usuarios_add_rol.sql.
CREATE TABLE IF NOT EXISTS roles (
  id_rol INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(30) NOT NULL UNIQUE,
  descripcion VARCHAR(255)
);

-- ---
-- Tabla de usuarios
-- ---
CREATE TABLE IF NOT EXISTS usuarios (
  id_usuario INT AUTO_INCREMENT PRIMARY KEY,
  nombre_usuario VARCHAR(15) NOT NULL UNIQUE,
  id_rol INT NOT NULL,
  contrasena VARCHAR(1000) NOT NULL,

  FOREIGN KEY (id_rol) REFERENCES roles(id_rol)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

-- ---
-- Tabla de proyectos
-- ---
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

-- ---
-- Historial de presupuestos por proyecto
-- ---
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

-- ---
-- Tabla de asignaciones para explosion de insumos
-- ---
CREATE TABLE IF NOT EXISTS explosion_insumos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_proyecto INT NOT NULL,
  clan VARCHAR(30) NOT NULL DEFAULT "",
  familia VARCHAR(10) NOT NULL,
  presupuesto_asignado DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uk_explosion_proyecto_familia UNIQUE (id_proyecto, clan, familia),
  FOREIGN KEY (id_proyecto) REFERENCES proyectos(id_proyecto)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);


-- ---
-- Tabla de pedidos
-- ---
CREATE TABLE IF NOT EXISTS pedidos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_proyecto INT NOT NULL,
  nombre_proyecto VARCHAR(50) NOT NULL,
  pedido VARCHAR(10) NOT NULL,
  clan VARCHAR(30) NOT NULL,
  familia VARCHAR(10) NOT NULL,
  proveedor VARCHAR(100) NOT NULL,
  fecha_aprobacion DATE NOT NULL,
  concepto VARCHAR(100) NOT NULL,
  situaciones_especiales VARCHAR(100),
  porcentaje_descuento DECIMAL (6,2),

  importe_total DECIMAL(15,2) DEFAULT 0.00,
  nombre_usuario VARCHAR(50) NOT NULL,

  -- Flujo de aprobación (ver Base_de_Datos/migrations/003_pedidos_estado.sql y
  -- 006_pedidos_estado_simplificar.sql). Daniel (rol Aprobador) levanta el pedido,
  -- lo edita y mueve su propio estado; no hay paso de "enviar" a otra persona.
  estado ENUM('levantado', 'aprobado', 'rechazado') NOT NULL DEFAULT 'levantado',
  id_aprobador INT NULL,
  fecha_levantado DATETIME NULL,
  fecha_resolucion DATETIME NULL,

  CONSTRAINT uk_pedido_proyecto UNIQUE (id_proyecto, pedido),

  FOREIGN KEY (id_proyecto) REFERENCES proyectos(id_proyecto)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  FOREIGN KEY (nombre_usuario) REFERENCES usuarios(nombre_usuario)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  FOREIGN KEY (id_aprobador) REFERENCES usuarios(id_usuario)
    ON UPDATE CASCADE
    ON DELETE SET NULL
);

-- ---
-- Tabla pedidos_detalles_miscelaneos  (antes pedido_detalles)
-- ---
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

-- ---
-- Tabla pedidos_detalles_aluminio
-- ---
CREATE TABLE IF NOT EXISTS pedidos_detalles_aluminio (
  id_detalle INT AUTO_INCREMENT PRIMARY KEY,
  id_pedido INT NOT NULL,

  numero_perfil VARCHAR(50),              -- NÂ° PERFIL
  descripcion VARCHAR(255) NOT NULL,      -- DESCRIPCION
  medida_tramo DECIMAL(10,3),             -- MEDIDA (TRAMO)
  unidad VARCHAR(50),                     -- UNIDAD (ej. TRAMO)

  peso_kg_ml DECIMAL(10,3),               -- PESO (KG/ML)
  perimetro_m2_ml DECIMAL(10,3),          -- PERÃM (M2/ML)
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

-- ---
-- Tabla pedidos_detalles_cristal
-- ---
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

-- ---
-- Tabla pedidos_historial_estados
-- Auditoría de cambios de estado de pedidos (trazabilidad de aprobaciones)
-- Ver Base_de_Datos/migrations/004_create_pedidos_historial_estados.sql
-- ---
CREATE TABLE IF NOT EXISTS pedidos_historial_estados (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_pedido INT NOT NULL,
  estado_anterior ENUM('levantado', 'aprobado', 'rechazado') NULL,
  estado_nuevo ENUM('levantado', 'aprobado', 'rechazado') NOT NULL,
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

-- ---
-- Tabla supervisores_proyectos
-- Asignación de Supervisores a proyectos
-- Ver Base_de_Datos/migrations/005_create_supervisores_proyectos.sql
-- ---
CREATE TABLE IF NOT EXISTS supervisores_proyectos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT NOT NULL,
  id_proyecto INT NOT NULL,
  fecha_asignacion DATETIME DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT uk_supervisor_proyecto UNIQUE (id_usuario, id_proyecto),

  FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
    ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (id_proyecto) REFERENCES proyectos(id_proyecto)
    ON UPDATE CASCADE ON DELETE CASCADE
);

-- ---
-- Tabla cobranza_proyecto (resumen de cobranza por proyecto)
-- Similar a la hoja "COBRANZA TOTAL" del Excel
-- ---
CREATE TABLE IF NOT EXISTS cobranza_proyecto (
  id_cobranza_proyecto INT AUTO_INCREMENT PRIMARY KEY,
  id_proyecto INT NOT NULL UNIQUE,

  -- Datos principales (todos captura manual)
  codigo_control VARCHAR(20),                           -- CONTROL (ej: 00431)
  importe_contratado DECIMAL(15,2) DEFAULT 0.00,       -- IMPORTE CONTRATADO (captura manual)
  importe_cobrado DECIMAL(15,2) DEFAULT 0.00,          -- IMPORTE COBRADO (captura manual)
  fondo_garantia DECIMAL(15,2) DEFAULT 0.00,           -- FONDO DE GARANTIA (captura manual)
  aplicado DECIMAL(15,2) DEFAULT 0.00,                 -- APLICADO / GASTOS (captura manual)

  -- Campos derivados (calculados en el backend desde los manuales):
  -- importe_a_cobrar = importe_contratado - importe_cobrado
  -- liquido_por_cobrar = importe_contratado - importe_cobrado - fondo_garantia
  -- cobrado_vs_aplicado = importe_cobrado - aplicado (negativo = EN ROJO)

  -- INDIRECTOS
  factor_indirectos DECIMAL(5,2) DEFAULT 0.20,         -- FACTOR (ej: 0.20 = 20%)
  indirectos_aplicados DECIMAL(15,2) DEFAULT 0.00,     -- APLICADO de indirectos (captura manual)
  -- indirectos_esperado = importe_contratado * factor_indirectos
  -- indirectos_cobrado = importe_cobrado * factor_indirectos
  -- indirectos_cobrado_vs_aplicado = indirectos_cobrado - indirectos_aplicados

  fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  nombre_usuario VARCHAR(50),

  FOREIGN KEY (id_proyecto) REFERENCES proyectos(id_proyecto)
    ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (nombre_usuario) REFERENCES usuarios(nombre_usuario)
    ON UPDATE CASCADE ON DELETE SET NULL
);

-- Para bases existentes, ejecutar:
-- ALTER TABLE cobranza_proyecto ADD COLUMN IF NOT EXISTS factor_indirectos DECIMAL(5,2) DEFAULT 0.20;
-- ALTER TABLE cobranza_proyecto ADD COLUMN IF NOT EXISTS indirectos_aplicados DECIMAL(15,2) DEFAULT 0.00;
-- ALTER TABLE cobranza_proyecto ADD COLUMN IF NOT EXISTS importe_contratado DECIMAL(15,2) DEFAULT 0.00;
-- ALTER TABLE cobranza_proyecto ADD COLUMN IF NOT EXISTS aplicado DECIMAL(15,2) DEFAULT 0.00;

-- ---
-- Tabla cobranza_facturas (detalle de facturas por proyecto)
-- Similar a las hojas individuales por proyecto del Excel
-- ---
CREATE TABLE IF NOT EXISTS cobranza_facturas (
  id_factura INT AUTO_INCREMENT PRIMARY KEY,
  id_proyecto INT NOT NULL,

  numero INT,                                           -- NÂ° consecutivo
  fecha DATE,                                           -- FECHA de factura
  numero_factura VARCHAR(50),                           -- NÂ° FACTURA
  concepto VARCHAR(100),                                -- CONCEPTO (ej: EST 01, ANTICIPO 70%)
  importe_a_cobrar DECIMAL(15,2) DEFAULT 0.00,         -- IMPORTE A COBRAR
  importe_cobrado DECIMAL(15,2) DEFAULT 0.00,          -- IMPORTE COBRADO
  saldo_por_cobrar DECIMAL(15,2) DEFAULT 0.00,         -- SALDO POR COBRAR
  fecha_pago DATE,                                      -- FECHA DE PAGO
  periodo VARCHAR(100),                                 -- PERIODO (ej: 29/03/2025 AL 18/04/2025)

  fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
  nombre_usuario VARCHAR(50),

  FOREIGN KEY (id_proyecto) REFERENCES proyectos(id_proyecto)
    ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (nombre_usuario) REFERENCES usuarios(nombre_usuario)
    ON UPDATE CASCADE ON DELETE SET NULL
);

-- ---
-- Tabla viaticos_presupuestos
-- ---
CREATE TABLE IF NOT EXISTS viaticos_presupuestos (
  id_presupuesto INT AUTO_INCREMENT PRIMARY KEY,
  id_proyecto INT NOT NULL,
  familia ENUM('Mano de Obra', 'ViÃ¡ticos', 'Fletes', 'F.H.', 'Rentas Casa') NOT NULL,
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

-- ---
-- Tabla viaticos_movimientos
-- ---
CREATE TABLE IF NOT EXISTS viaticos_movimientos (
  id_movimiento INT AUTO_INCREMENT PRIMARY KEY,
  id_proyecto INT NOT NULL,
  familia ENUM('Mano de Obra', 'ViÃ¡ticos', 'Fletes', 'F.H.', 'Rentas Casa') NOT NULL,
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

-- ---
-- TRIGGERS PARA MISCEÃNEOS
-- ---
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
-- ---
-- TRIGGERS PARA CRISTAL
-- ---

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

-- ---
-- TRIGGERS PARA VIÃTICOS
-- ---
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

-- ---
-- STORED PROCEDURE FOR RECALCULATING SALDOS
-- ---
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




-- Remisiones
CREATE TABLE IF NOT EXISTS remisiones_control (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_detalle INT NOT NULL,                           -- FK a pedidos_detalles_aluminio.id_detalle, pedidos_detalles_cristal.id_detalle o pedidos_detalles_miscelaneos.id_detalle
  tipo_material ENUM('aluminio', 'cristal', 'miscelaneo') NOT NULL,

  -- Control de entregas (EDITABLE desde el mÃ³dulo de remisiones)
  cantidad_pedida INT DEFAULT 0,                     -- PEDIDO (tramos/piezas pedidas)
  cantidad_recibida INT DEFAULT 0,                   -- RECIBIDO
  cantidad_extruido INT DEFAULT 0,                   -- EXTRUIDO (solo aplica para aluminio)
  cantidad_pintado INT DEFAULT 0,                    -- PINTADO (solo aplica para aluminio)

  -- Prioridad y fechas
  prioridad ENUM('A', 'B', 'C') DEFAULT 'C',
  fecha_liberacion DATE,
  fecha_entrega DATE,
  fecha_entrega_desfazada DATE,                        -- FECHA DE ENTREGA DESFAZADA (solo cristal)

  -- Observaciones
  observaciones_proveedor TEXT,
  observaciones_heg TEXT,

  -- AuditorÃ­a
  fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Clave Ãºnica: un registro de control por cada detalle
  UNIQUE KEY uk_detalle_material (id_detalle, tipo_material),

  INDEX idx_prioridad (prioridad),
  INDEX idx_tipo_material (tipo_material)
);


-- ---
-- Tabla remisiones_historial_entregas
-- Registra cada entrega realizada (cabecera)
-- ---
CREATE TABLE IF NOT EXISTS remisiones_historial_entregas (
  id_entrega INT AUTO_INCREMENT PRIMARY KEY,
  id_pedido INT NOT NULL,
  numero_pedido VARCHAR(20) NOT NULL,
  nombre_proyecto VARCHAR(100) NOT NULL,
  tipo_material ENUM('aluminio', 'cristal', 'miscelaneo') NOT NULL,
  total_items INT NOT NULL DEFAULT 0,
  total_piezas INT NOT NULL DEFAULT 0,
  observaciones TEXT,
  ruta_pdf VARCHAR(500) NULL,
  usuario VARCHAR(50) NOT NULL,
  fecha_entrega DATETIME DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_fecha (fecha_entrega),
  INDEX idx_pedido (id_pedido),
  INDEX idx_tipo_material (tipo_material),
  
  FOREIGN KEY (id_pedido) REFERENCES pedidos(id)
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- ---
-- Tabla remisiones_historial_entregas_detalle
-- Registra el detalle de cada entrega (lÃ­neas)
-- ---
CREATE TABLE IF NOT EXISTS remisiones_historial_entregas_detalle (
  id_detalle_entrega INT AUTO_INCREMENT PRIMARY KEY,
  id_entrega INT NOT NULL,
  id_detalle INT NOT NULL,
  cantidad_entregada INT NOT NULL DEFAULT 0,
  descripcion VARCHAR(255),
  
  FOREIGN KEY (id_entrega) REFERENCES remisiones_historial_entregas(id_entrega)
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- ---
-- Tabla facturas (mÃ³dulo de contabilidad)
-- Facturas de proveedores ligadas a proyectos
-- ---
CREATE TABLE IF NOT EXISTS facturas (
  id_factura     INT AUTO_INCREMENT PRIMARY KEY,
  id_proyecto    INT NOT NULL,
  proveedor      VARCHAR(255) NOT NULL,
  concepto       VARCHAR(500) NOT NULL,
  categoria      ENUM('materiales', 'mano_de_obra', 'flete', 'otro') NOT NULL DEFAULT 'materiales',
  total          DECIMAL(12,2) NOT NULL,
  fecha_factura  DATE NOT NULL,
  estatus        ENUM('pendiente', 'pagada', 'cancelada') NOT NULL DEFAULT 'pendiente',
  fecha_pago     DATE NULL,
  metodo_pago    VARCHAR(100) NULL,
  ruta_pdf       VARCHAR(500) NOT NULL,
  ruta_xml       VARCHAR(500) NULL,
  nombre_usuario VARCHAR(100) NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_proyecto (id_proyecto),
  INDEX idx_estatus (estatus),
  INDEX idx_fecha_factura (fecha_factura),

  FOREIGN KEY (id_proyecto) REFERENCES proyectos(id_proyecto)
    ON DELETE CASCADE ON UPDATE CASCADE
);

