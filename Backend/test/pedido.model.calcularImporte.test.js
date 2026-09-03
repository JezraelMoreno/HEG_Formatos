import { test, after } from "node:test";
import assert from "node:assert/strict";
import { calcularImporteDesdeDetalles } from "../models/pedido.model.js";
import { queryAsync, db } from "../config/db.js";

after(() => {
  db.end();
});

// Regresión del bug corregido en pedidos.controller.js: un pedido sin líneas de detalle
// (lump-sum) debe devolver subtotal 0 de forma explícita, nunca null/NaN, para que el
// controller pueda distinguir "sin detalles" de "con detalles" al decidir si sobreescribe
// importe_total (ver `if (calc && calc.subtotal > 0 && Number.isFinite(calc.total))`).
test("calcularImporteDesdeDetalles devuelve subtotal y total en 0 cuando no hay detalles", async () => {
  const pedidoInexistente = { id: 999999999, familia: "CR" };
  const resultado = await calcularImporteDesdeDetalles(pedidoInexistente, { includeSubtotal: true });
  assert.deepEqual(resultado, { subtotal: 0, total: 0 });
});

test("calcularImporteDesdeDetalles sin includeSubtotal devuelve 0 cuando no hay detalles", async () => {
  const pedidoInexistente = { id: 999999999, familia: "AL" };
  const resultado = await calcularImporteDesdeDetalles(pedidoInexistente);
  assert.equal(resultado, 0);
});

// Requiere datos de Backend/scripts/seedDummyData.js (`npm run seed`): el pedido "P-002"
// (familia AL) del proyecto "DEMO 001 - Torre Aurora" tiene una línea en
// pedidos_detalles_aluminio con importe = 18500 y sin descuento/IVA especial.
test("calcularImporteDesdeDetalles calcula el total real de un pedido con detalles", async (t) => {
  const rows = await queryAsync(
    `SELECT p.id, p.familia, p.situaciones_especiales, p.porcentaje_descuento
     FROM pedidos p
     JOIN proyectos pr ON pr.id_proyecto = p.id_proyecto
     WHERE pr.nombre = ? AND p.pedido = ?
     LIMIT 1`,
    ["DEMO 001 - Torre Aurora", "P-002"]
  );

  if (!rows.length) {
    t.skip('Requiere datos de seedDummyData.js — correr "npm run seed" primero');
    return;
  }

  const resultado = await calcularImporteDesdeDetalles(rows[0], { includeSubtotal: true });
  assert.equal(resultado.subtotal, 18500);
  assert.equal(resultado.total, Number((18500 * 1.16).toFixed(2)));
});
