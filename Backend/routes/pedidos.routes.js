import { Router } from "express";
import {
  authenticateToken,
  requireRole,
  requireProjectAccess,
  requireProjectAccessByProyectoId,
} from "../middleware/auth.js";
import * as PedidosCtrl from "../controllers/pedidos.controller.js";

const router = Router();

// Captura directa de pedidos (reemplaza gradualmente la carga masiva por CSV, que sigue
// intacta en POST /proyectos/:id/pedidos).
router.post(
  "/proyectos/:id/pedidos/nuevo",
  authenticateToken,
  requireRole("Aprobador", "Superadmin"),
  PedidosCtrl.crearDirecto
);

// Rutas literales (/pedidos/resumen) van ANTES de /pedidos/:pedidoId: Express matchea de
// arriba a abajo, y "resumen" sería capturado como :pedidoId si se registrara después.
router.get(
  "/pedidos/resumen",
  authenticateToken,
  requireRole("Aprobador", "Superadmin", "Visor"),
  PedidosCtrl.resumen
);

router.get(
  "/pedidos/pendientes/conteo",
  authenticateToken,
  requireRole("Superadmin", "Supervisor"),
  PedidosCtrl.conteoPendientes
);

router.get(
  "/proyectos/:id/pedidos",
  authenticateToken,
  requireRole("Aprobador", "Superadmin", "Supervisor", "Visor"),
  requireProjectAccessByProyectoId,
  PedidosCtrl.listarPorProyecto
);

router.get(
  "/pedidos/:pedidoId",
  authenticateToken,
  requireRole("Aprobador", "Superadmin", "Supervisor", "Visor"),
  requireProjectAccess,
  PedidosCtrl.obtenerUno
);

router.put(
  "/pedidos/:pedidoId",
  authenticateToken,
  requireRole("Aprobador", "Superadmin"),
  PedidosCtrl.actualizar
);

router.patch(
  "/pedidos/:pedidoId/estado",
  authenticateToken,
  requireRole("Aprobador", "Superadmin"),
  PedidosCtrl.cambiarEstado
);

router.get(
  "/pedidos/:pedidoId/historial",
  authenticateToken,
  requireRole("Aprobador", "Superadmin", "Supervisor"),
  requireProjectAccess,
  PedidosCtrl.historial
);

router.delete(
  "/pedidos/:pedidoId",
  authenticateToken,
  requireRole("Aprobador", "Superadmin"),
  PedidosCtrl.eliminar
);

export default router;
