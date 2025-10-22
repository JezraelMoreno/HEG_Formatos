CREATE DATABASE IF NOT EXISTS proyectosdb;
USE proyectosdb;

CREATE TABLE proyectos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  proyecto VARCHAR(255),
  proveedor VARCHAR(255),
  pedido VARCHAR(255),
  familia VARCHAR(255),
  num_perfil VARCHAR(100),
  fecha_aprobacion DATE,
  descripcion TEXT,
  partida VARCHAR(255),
  dibujo VARCHAR(255),
  medida_tramo VARCHAR(100),
  unidad VARCHAR(100),
  peso_kg_ml DECIMAL(10,2),
  perim_m2_ml DECIMAL(10,2),
  acabado VARCHAR(100),
  total_tramos INT,
  ml DECIMAL(10,2),
  kg DECIMAL(10,2),
  m2 DECIMAL(10,2),
  importe DECIMAL(12,2)
);

