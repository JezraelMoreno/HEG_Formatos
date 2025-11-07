export function getToken(): string | null {
  return localStorage.getItem("token");
}

export function setToken(token: string) {
  localStorage.setItem("token", token);
}

export function clearToken() {
  localStorage.removeItem("token");
  localStorage.removeItem("usuario");
}

export function isTokenValid(token: string | null): boolean {
  if (!token) return false;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const payloadJson = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(payloadJson);
    if (!payload || typeof payload !== "object") return false;
    if (typeof payload.exp !== "number") return true; // si no hay exp, asumir válido
    const nowSec = Math.floor(Date.now() / 1000);
    return payload.exp > nowSec;
  } catch {
    return false;
  }
}

export function authHeader(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function getUserInfo(): { username?: string; role?: string } | null {
  const token = getToken();
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payloadJson = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(payloadJson);
    if (!payload || typeof payload !== "object") return null;
    const username = typeof payload.username === "string" ? payload.username : undefined;
    const role = typeof payload.role === "string" ? payload.role : undefined;
    return { username, role };
  } catch {
    return null;
  }
}

export function getRole(): string | null {
  const info = getUserInfo();
  return info?.role || null;
}
