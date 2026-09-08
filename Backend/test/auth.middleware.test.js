import { test, after } from "node:test";
import assert from "node:assert/strict";
import {
  requireRole,
  requireProjectAccess,
  requireProjectAccessByProyectoId,
} from "../middleware/auth.js";
import { queryAsync, db } from "../config/db.js";
import { runMiddleware } from "./helpers.js";

after(() => {
  db.end();
});

test("requireRole permite un rol autorizado", async () => {
  const mw = requireRole("Aprobador", "Superadmin");
  const result = await runMiddleware(mw, { user: { role: "Aprobador" } });
  assert.equal(result.nextCalled, true);
});

test("requireRole rechaza un rol no autorizado con 403", async () => {
  const mw = requireRole("Aprobador", "Superadmin");
  const result = await runMiddleware(mw, { user: { role: "Visor" } });
  assert.equal(result.nextCalled, false);
  assert.equal(result.statusCode, 403);
});

test("requireRole rechaza cuando no hay rol en el token", async () => {
  const mw = requireRole("Aprobador", "Superadmin");
  const result = await runMiddleware(mw, { user: {} });
  assert.equal(result.nextCalled, false);
  assert.equal(result.statusCode, 403);
});

// La restricción de proyectos por usuario se generalizó a cualquier rol no-Superadmin (antes
// solo Supervisor) — ver Base_de_Datos/migrations/007_backfill_acceso_proyectos.sql. Ahora
// únicamente Superadmin pasa directo sin tocar la BD; cualquier otro rol pasa por el chequeo
// de supervisores_proyectos.
test("requireProjectAccess deja pasar directo a Superadmin (sin tocar BD)", async () => {
  const result = await runMiddleware(requireProjectAccess, {
    user: { role: "Superadmin" },
    params: { pedidoId: "999999999" },
  });
  assert.equal(result.nextCalled, true);
});

test("requireProjectAccessByProyectoId deja pasar directo a Superadmin (sin tocar BD)", async () => {
  const result = await runMiddleware(requireProjectAccessByProyectoId, {
    user: { role: "Superadmin" },
    params: { id: "999999999" },
  });
  assert.equal(result.nextCalled, true);
});

test("requireProjectAccess NO deja pasar directo a un rol restringible como Aprobador (toca BD y responde 404 para un pedido inexistente)", async () => {
  const result = await runMiddleware(requireProjectAccess, {
    user: { role: "Aprobador", sub: 1 },
    params: { pedidoId: "999999999" },
  });
  assert.equal(result.nextCalled, false);
  assert.equal(result.statusCode, 404);
});

// Requiere datos de Backend/scripts/seedDummyData.js (`npm run seed`): el usuario
// "supervisor_demo" asignado a "DEMO 001 - Torre Aurora" pero NO a "DEMO 003 - Residencial Norte".
test("requireProjectAccessByProyectoId permite y deniega correctamente a un Supervisor real", async (t) => {
  const usuarioRows = await queryAsync(
    "SELECT id_usuario FROM usuarios WHERE nombre_usuario = ? LIMIT 1",
    ["supervisor_demo"]
  );
  const proyectoAsignadoRows = await queryAsync(
    "SELECT id_proyecto FROM proyectos WHERE nombre = ? LIMIT 1",
    ["DEMO 001 - Torre Aurora"]
  );
  const proyectoAjenoRows = await queryAsync(
    "SELECT id_proyecto FROM proyectos WHERE nombre = ? LIMIT 1",
    ["DEMO 003 - Residencial Norte"]
  );

  if (!usuarioRows.length || !proyectoAsignadoRows.length || !proyectoAjenoRows.length) {
    t.skip('Requiere datos de seedDummyData.js — correr "npm run seed" primero');
    return;
  }

  const idUsuario = usuarioRows[0].id_usuario;
  const idProyectoAsignado = proyectoAsignadoRows[0].id_proyecto;
  const idProyectoAjeno = proyectoAjenoRows[0].id_proyecto;

  const permitido = await runMiddleware(requireProjectAccessByProyectoId, {
    user: { role: "Supervisor", sub: idUsuario },
    params: { id: String(idProyectoAsignado) },
  });
  assert.equal(permitido.nextCalled, true, "debe permitir acceso a un proyecto asignado");

  const denegado = await runMiddleware(requireProjectAccessByProyectoId, {
    user: { role: "Supervisor", sub: idUsuario },
    params: { id: String(idProyectoAjeno) },
  });
  assert.equal(denegado.nextCalled, false);
  assert.equal(denegado.statusCode, 403, "debe denegar acceso a un proyecto no asignado");
});
