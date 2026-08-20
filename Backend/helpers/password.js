import bcrypt from "bcrypt";
import crypto from "crypto";

const SHA256_HEX_RE = /^[a-f0-9]{64}$/i;
const BCRYPT_ROUNDS = 10;

export function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

// Compara contra bcrypt primero; si el valor guardado tiene forma de hash SHA-256 (64 hex,
// esquema viejo sin salt) compara con ese método y marca needsRehash para migrar la fila
// a bcrypt en el mismo login (migración perezosa, sin forzar reset de contraseñas).
export async function verifyPassword(plain, stored) {
  const storedStr = String(stored || "");
  if (storedStr.startsWith("$2")) {
    const ok = await bcrypt.compare(plain, storedStr);
    return { ok, needsRehash: false };
  }
  if (SHA256_HEX_RE.test(storedStr)) {
    const legacyHash = crypto.createHash("sha256").update(plain).digest("hex");
    const ok = legacyHash === storedStr;
    return { ok, needsRehash: ok };
  }
  return { ok: false, needsRehash: false };
}
