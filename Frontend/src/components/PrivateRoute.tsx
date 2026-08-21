import { Navigate } from "react-router-dom";
import { getToken, isTokenValid } from "../auth";
import { useAuth } from "../hooks/useAuth";
import type { ReactNode } from "react";


type Props = { children: ReactNode; allowedRoles?: string[] };

export function PrivateRoute({ children, allowedRoles }: Props) {
  const token = getToken();
  const ok = isTokenValid(token);
  const { role } = useAuth();
  if (!ok) return <Navigate to="/" replace />;
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.map((r) => r.toLowerCase()).includes(role)) {
    return <Navigate to="/home" replace />;
  }
  return <>{children}</>;
}

