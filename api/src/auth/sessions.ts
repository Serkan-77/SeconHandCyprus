// Sessions and refresh-token rotation.
//
// Each sign-in creates a session and a first refresh token. Exchanging a
// refresh token marks it used and issues a new one (rotation). If a token
// that was already used comes back, it has been copied: the session is
// revoked, which signs out both the thief and the victim. A short grace
// period covers the honest race of two tabs refreshing with the same cookie
// at the same moment.
import type { Db, Tx } from "../db/pool.ts";
import { hashToken, randomToken, type TokenSigner } from "./tokens.ts";

export const REUSE_GRACE_SECONDS = 20;

export type IssuedSession = {
  sessionId: string;
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: number;
  refreshExpiresAt: Date;
};

export type SessionOptions = { ttlDays: number; maxDays: number };

export async function createSession(
  sql: Db | Tx,
  signer: TokenSigner,
  opts: SessionOptions,
  input: { userId: string; client: "web" | "mobile"; userAgent?: string | null },
): Promise<IssuedSession> {
  const [session] = await sql<{ id: string; expiresAt: Date }[]>`
    insert into auth.sessions (user_id, client, user_agent, expires_at)
    values (${input.userId}, ${input.client}, ${input.userAgent?.slice(0, 300) ?? null}, now() + make_interval(days => ${opts.ttlDays}))
    returning id, expires_at`;
  const refreshToken = randomToken();
  await sql`insert into auth.refresh_tokens (session_id, token_hash) values (${session.id}, ${hashToken(refreshToken)})`;
  await sql`update auth.users set last_sign_in_at = now() where id = ${input.userId}`;
  return {
    sessionId: session.id,
    accessToken: await signer.sign({ sub: input.userId, sid: session.id }),
    refreshToken,
    accessExpiresIn: signer.ttlSeconds,
    refreshExpiresAt: session.expiresAt,
  };
}

export type RefreshResult = { ok: true; session: IssuedSession; userId: string } | { ok: false; reason: "invalid" | "revoked" | "reused" };

export async function rotateRefreshToken(db: Db, signer: TokenSigner, opts: SessionOptions, token: string): Promise<RefreshResult> {
  if (!token || token.length > 200) return { ok: false, reason: "invalid" };
  return (await db.begin(async (sql) => {
    const [row] = await sql<
      { id: number; sessionId: string; usedAt: Date | null; userId: string; revokedAt: Date | null; expiresAt: Date; createdAt: Date; client: "web" | "mobile" }[]
    >`
      select t.id, t.session_id, t.used_at, s.user_id, s.revoked_at, s.expires_at, s.created_at, s.client
      from auth.refresh_tokens t join auth.sessions s on s.id = t.session_id
      where t.token_hash = ${hashToken(token)}
      for update of t, s`;
    if (!row) return { ok: false, reason: "invalid" };
    if (row.revokedAt || row.expiresAt.getTime() <= Date.now()) return { ok: false, reason: "revoked" };
    if (row.usedAt) {
      const age = (Date.now() - row.usedAt.getTime()) / 1000;
      if (age > REUSE_GRACE_SECONDS) {
        await sql`update auth.sessions set revoked_at = now(), revoke_reason = 'refresh_reuse' where id = ${row.sessionId}`;
        return { ok: false, reason: "reused" };
      }
    } else {
      await sql`update auth.refresh_tokens set used_at = now() where id = ${row.id}`;
    }
    const refreshToken = randomToken();
    await sql`insert into auth.refresh_tokens (session_id, token_hash) values (${row.sessionId}, ${hashToken(refreshToken)})`;
    // Sliding expiry, capped at the absolute maximum from sign-in.
    const [s] = await sql<{ expiresAt: Date }[]>`
      update auth.sessions
      set last_used_at = now(),
          expires_at = least(now() + make_interval(days => ${opts.ttlDays}), created_at + make_interval(days => ${opts.maxDays}))
      where id = ${row.sessionId}
      returning expires_at`;
    // Old used tokens are only needed to detect reuse for a while.
    await sql`delete from auth.refresh_tokens where session_id = ${row.sessionId} and used_at < now() - interval '1 day'`;
    return {
      ok: true,
      userId: row.userId,
      session: {
        sessionId: row.sessionId,
        accessToken: await signer.sign({ sub: row.userId, sid: row.sessionId }),
        refreshToken,
        accessExpiresIn: signer.ttlSeconds,
        refreshExpiresAt: s.expiresAt,
      },
    };
  })) as RefreshResult;
}

export async function revokeSession(sql: Db | Tx, sessionId: string, reason = "sign_out") {
  await sql`update auth.sessions set revoked_at = now(), revoke_reason = ${reason} where id = ${sessionId} and revoked_at is null`;
}

export async function revokeAllSessions(sql: Db | Tx, userId: string, reason: string, exceptSessionId?: string | null) {
  await sql`
    update auth.sessions set revoked_at = now(), revoke_reason = ${reason}
    where user_id = ${userId} and revoked_at is null and id is distinct from ${exceptSessionId ?? null}::uuid`;
}
