// Password hashing: Argon2id (OWASP parameters: 19 MiB, 2 iterations,
// 1 lane). Accounts imported from Supabase carry bcrypt hashes; they are
// verified with bcrypt once and rehashed to Argon2id on that sign-in, so
// nobody has to reset their password after the migration.
import { hash, verify } from "@node-rs/argon2";
import bcrypt from "bcryptjs";

const ARGON2 = { algorithm: 2 /* Argon2id */, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string) {
  return hash(password, ARGON2);
}

export function isLegacyHash(stored: string) {
  return /^\$2[aby]\$/.test(stored);
}

export async function verifyPassword(stored: string | null, password: string): Promise<boolean> {
  if (!stored) return false;
  try {
    if (stored.startsWith("$argon2")) return await verify(stored, password);
    if (isLegacyHash(stored)) return await bcrypt.compare(password, stored);
  } catch {
    return false;
  }
  return false;
}

// Spends the same time as a real check when the account does not exist, so
// response times do not reveal which e-mail addresses are registered.
let dummy: Promise<string> | null = null;
export async function burnPasswordCheck(password: string) {
  dummy ??= hashPassword("not-a-real-password-" + Math.random());
  await verifyPassword(await dummy, password);
}
