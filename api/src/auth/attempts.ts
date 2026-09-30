// Counters for sign-in, sign-up, verification and reset attempts, kept in
// PostgreSQL so they survive restarts. Keys are SHA-256 hashes of
// "action:subject": no IP address or e-mail is stored in clear text.
import type { Db, Tx } from "../db/pool.ts";
import { tooMany } from "../lib/errors.ts";
import { attemptKey } from "./tokens.ts";

export type Limit = { action: string; subject: string; max: number; windowMinutes: number; message?: string };

export async function countAttempts(sql: Db | Tx, action: string, subject: string, windowMinutes: number) {
  const [{ n }] = await sql<{ n: number }[]>`
    select count(*)::int as n from auth.attempts
    where key_hash = ${attemptKey(action, subject)} and created_at > now() - make_interval(mins => ${windowMinutes})`;
  return n;
}

export async function recordAttempt(sql: Db | Tx, action: string, subject: string) {
  await sql`insert into auth.attempts (key_hash, action) values (${attemptKey(action, subject)}, ${action})`;
}

/** Throws 429 when any limit is reached. */
export async function enforceLimits(sql: Db | Tx, limits: Limit[]) {
  for (const l of limits) {
    if ((await countAttempts(sql, l.action, l.subject, l.windowMinutes)) >= l.max) throw tooMany(l.message);
  }
}

/** Records one attempt for every limit, then checks them (for actions counted on every call). */
export async function consumeLimits(sql: Db | Tx, limits: Limit[]) {
  await enforceLimits(sql, limits);
  for (const l of limits) await recordAttempt(sql, l.action, l.subject);
}

export async function pruneAttempts(sql: Db | Tx) {
  await sql`delete from auth.attempts where created_at < now() - interval '2 days'`;
}
