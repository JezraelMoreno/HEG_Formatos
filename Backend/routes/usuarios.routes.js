import { Router } from "express";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import * as UsuariosCtrl from "../controllers/usuarios.controller.js";

const router = Router();

router.get("/usuarios", authenticateToken, requireRole("Superadmin", "Visor"), UsuariosCtrl.listar);
router.post("/usuarios", authenticateToken, requireRole("Superadmin"), UsuariosCtrl.crear);
router.patch("/usuarios/:id/rol", authenticateToken, requireRole("Superadmin"), UsuariosCtrl.cambiarRol);

export default router;
