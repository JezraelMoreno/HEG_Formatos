import { Navigate } from "react-router-dom";
import { getToken, isTokenValid } from "../auth";
import { ReactNode } from "react";

type Props = { children: ReactNode };

export function PrivateRoute({ children }: Props) {
  const token = getToken();
  const ok = isTokenValid(token);
  if (!ok) return <Navigate to="/" replace />;
  return <>{children}</>;
}

