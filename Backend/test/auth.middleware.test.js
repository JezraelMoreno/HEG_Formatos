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

test("requireProjectAccess deja pasar directo a roles distintos de Supervisor (sin tocar BD)", async () => {
  const result = await runMiddleware(requireProjectAccess, {
    user: { role: "Aprobador" },
    params: { pedidoId: "999999999" },
  });
  assert.equal(result.nextCalled, true);
});

test("requireProjectAccessByProyectoId deja pasar directo a roles distintos de Supervisor (sin tocar BD)", async () => {
  const result = await runMiddleware(requireProjectAccessByProyectoId, {
    user: { role: "Superadmin" },
    params: { id: "999999999" },
  });
  assert.equal(result.nextCalled, true);
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
