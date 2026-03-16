-- =============================================================================
-- Migración: Restaurar presupuesto_cristal/aluminio/miscelaneos al valor DEFINIDO
-- =============================================================================
-- Contexto: Anteriormente estos campos almacenaban el SALDO RESTANTE
-- (presupuesto_definido - gastado). Con este cambio, pasan a almacenar el
-- PRESUPUESTO DEFINIDO por el usuario. El gastado se calcula dinámicamente
-- desde la tabla pedidos.
--
-- Ejecutar UNA SOLA VEZ antes de desplegar la versión del backend que
-- elimina las llamadas a ajustarPresupuestoProyecto.
-- =============================================================================

-- Paso 1: Restaurar los valores sumando de vuelta lo ya gastado en cada categoría
UPDATE proyectos p
SET
  presupuesto_cristal = COALESCE(presupuesto_cristal, 0) + COALESCE((
    SELECT SUM(importe_total)
    FROM pedidos
    WHERE id_proyecto = p.id_proyecto
      AND familia = 'CR'
  ), 0),
  presupuesto_aluminio = COALESCE(presupuesto_aluminio, 0) + COALESCE((
    SELECT SUM(importe_total)
    FROM pedidos
    WHERE id_proyecto = p.id_proyecto
      AND familia IN ('AL', 'MQAL')
  ), 0),
  presupuesto_miscelaneos = COALESCE(presupuesto_miscelaneos, 0) + COALESCE((
    SELECT SUM(importe_total)
    FROM pedidos
    WHERE id_proyecto = p.id_proyecto
      AND familia NOT IN ('CR', 'AL', 'MQAL')
  ), 0);

-- Paso 2: Recalcular totales
UPDATE proyectos
SET
  presupuesto_total = COALESCE(presupuesto_cristal, 0)
                    + COALESCE(presupuesto_aluminio, 0)
                    + COALESCE(presupuesto_miscelaneos, 0),
  presupuesto       = COALESCE(presupuesto_cristal, 0)
                    + COALESCE(presupuesto_aluminio, 0)
                    + COALESCE(presupuesto_miscelaneos, 0);

-- Verificación: muestra los valores resultantes por proyecto
SELECT
  id_proyecto,
  nombre,
  presupuesto_cristal,
  presupuesto_aluminio,
  presupuesto_miscelaneos,
  presupuesto_total,
  (SELECT COALESCE(SUM(importe_total), 0) FROM pedidos WHERE id_proyecto = p.id_proyecto) AS gastado_total,
  presupuesto_total - (SELECT COALESCE(SUM(importe_total), 0) FROM pedidos WHERE id_proyecto = p.id_proyecto) AS disponible
FROM proyectos p
ORDER BY id_proyecto;
