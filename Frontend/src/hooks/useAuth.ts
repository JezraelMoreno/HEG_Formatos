import { getRole, getUserInfo } from "../auth";

// Roles reales desde la migración de roles de semana 1 (tabla `roles`): Superadmin, Supervisor,
// Aprobador, Ingeniero, Contador, Visor. El JWT ya devuelve estos nombres — "administrador" era
// el ENUM legado y ya no existe.
export function useAuth() {
  const info = getUserInfo();
  const role = (info?.role || getRole() || "").toLowerCase();

  return {
    role,
    username: info?.username,
    isSuperadmin: role === "superadmin",
    isAprobador: role === "aprobador",
    isSupervisor: role === "supervisor",
    isContador: role === "contador",
    isVisor: role === "visor",
    isIngeniero: role === "ingeniero",
  };
}
