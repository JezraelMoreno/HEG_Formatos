import { Router } from "express";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import * as SupervisoresCtrl from "../controllers/supervisores.controller.js";

const router = Router();

router.get("/mis-proyectos", authenticateToken, SupervisoresCtrl.misProyectos);
router.get("/proyectos/:id/supervisores", authenticateToken, requireRole("Superadmin"), SupervisoresCtrl.listar);
router.post("/proyectos/:id/supervisores", authenticateToken, requireRole("Superadmin"), SupervisoresCtrl.asignar);
router.delete(
  "/proyectos/:id/supervisores/:idUsuario",
  authenticateToken,
  requireRole("Superadmin"),
  SupervisoresCtrl.quitar
);
router.get(
  "/usuarios/:id/proyectos-supervisados",
  authenticateToken,
  requireRole("Superadmin"),
  SupervisoresCtrl.proyectosDeUsuario
);

export default router;
