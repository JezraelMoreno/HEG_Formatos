-- =============================================================================
-- Fix: Corregir presupuestos negativos residuales
-- =============================================================================
-- Contexto: Al cambiar la semántica (presupuesto_X = definido, no restante),
-- algunos proyectos quedaron con valores negativos en presupuesto_cristal/
-- aluminio/miscelaneos porque el viejo backend los había llevado a negativo
-- (0 definido - gastado). No puede existir un presupuesto definido negativo.
--
-- Ejecutar UNA SOLA VEZ en producción.
-- =============================================================================

-- Paso 1: Corregir categorías negativas → 0
UPDATE proyectos
SET
  presupuesto_cristal     = GREATEST(COALESCE(presupuesto_cristal, 0), 0),
  presupuesto_aluminio    = GREATEST(COALESCE(presupuesto_aluminio, 0), 0),
  presupuesto_miscelaneos = GREATEST(COALESCE(presupuesto_miscelaneos, 0), 0)
WHERE presupuesto_cristal < 0
   OR presupuesto_aluminio < 0
   OR presupuesto_miscelaneos < 0;

-- Paso 2: Recalcular totales
UPDATE proyectos
SET presupuesto_total = COALESCE(presupuesto_cristal, 0)
                      + COALESCE(presupuesto_aluminio, 0)
                      + COALESCE(presupuesto_miscelaneos, 0),
    presupuesto       = COALESCE(presupuesto_cristal, 0)
                      + COALESCE(presupuesto_aluminio, 0)
                      + COALESCE(presupuesto_miscelaneos, 0);

-- Verificación
SELECT id_proyecto, nombre, presupuesto_cristal, presupuesto_aluminio,
       presupuesto_miscelaneos, presupuesto_total
FROM proyectos
ORDER BY id_proyecto;
