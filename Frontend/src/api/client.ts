import API_URL from "../config";
import { authHeader } from "../auth";

type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  data?: T;
};

/**
 * Cliente mínimo para el código nuevo de pedidos. No migra los fetch existentes de otras
 * páginas — evita repetir fetch + authHeader() + res.json() + check success en cada handler.
 */
export async function apiFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),
      ...(options.headers || {}),
    },
  });
  const data = (await res.json().catch(() => ({ success: false }))) as ApiEnvelope<T>;
  if (!res.ok || data.success === false) {
    throw new Error(data?.message || "Error de conexión");
  }
  // Algunos endpoints (ej. DELETE) no traen `data`, solo `message` — devolver el envoltorio
  // completo en ese caso para no perder esa información.
  return data.data !== undefined ? data.data : ((data as unknown) as T);
}
