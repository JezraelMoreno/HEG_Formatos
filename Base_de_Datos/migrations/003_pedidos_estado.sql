-- =============================================================================
-- Migración: Flujo de estados de pedidos (Borrador -> Enviado -> Aprobado/Rechazado)
-- =============================================================================
-- Contexto: Contrato Ago 2026, semana 1 - diseño de flujo de estados de pedidos.
-- Los pedidos existentes fueron cargados por el flujo CSV actual y ya están
-- operativos, así que se backfillean como 'aprobado' (no deben aparecer como
-- borrador pendiente de nadie).
--
-- Ejecutar UNA SOLA VEZ.
-- =============================================================================

ALTER TABLE pedidos
  ADD COLUMN estado ENUM('borrador', 'enviado', 'aprobado', 'rechazado')
    NOT NULL DEFAULT 'borrador',
  ADD COLUMN id_aprobador INT NULL,
  ADD COLUMN fecha_envio DATETIME NULL,
  ADD COLUMN fecha_resolucion DATETIME NULL;

ALTER TABLE pedidos
  ADD CONSTRAINT fk_pedidos_aprobador FOREIGN KEY (id_aprobador) REFERENCES usuarios(id_usuario)
    ON UPDATE CASCADE ON DELETE SET NULL;

-- Backfill: pedidos existentes (cargados por el flujo CSV actual) se marcan
-- como ya aprobados, con fecha de resolución igual a su fecha de aprobación
-- original.
UPDATE pedidos
SET estado = 'aprobado',
    fecha_envio = fecha_aprobacion,
    fecha_resolucion = fecha_aprobacion
WHERE estado = 'borrador';

-- Verificación: no debe haber estados fuera del ENUM ni pedidos históricos en borrador
SELECT estado, COUNT(*) AS total
FROM pedidos
GROUP BY estado;
