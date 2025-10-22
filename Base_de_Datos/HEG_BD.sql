CREATE DATABASE HEG_Sistema;

USE HEG_Sistema; 

CREATE TABLE usuarios(
id int auto_increment PRIMARY KEY,
nombre_usuario VARCHAR(15) NOT NULL UNIQUE,
contraseña VARCHAR(1000) NOT NULL
);