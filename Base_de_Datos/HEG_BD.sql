-- Crear base de datos con UTF-8
CREATE DATABASE IF NOT EXISTS HEG_Sistema CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE HEG_Sistema;

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
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

