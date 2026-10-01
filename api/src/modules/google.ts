// /api/v1/auth/google — "Google ile devam et" for the web (authorization code
// flow with PKCE). Enabled only when GOOGLE_CLIENT_ID and _SECRET are set.
//
//   GET /start?returnTo=/path  → 302 to Google; state, nonce and the PKCE
//                                verifier travel in a short-lived signed,
//                                HttpOnly cookie scoped to this path
//   GET /callback              → state checked, code exchanged, ID token
//                                verified against Google's keys (issuer,
//                                audience, nonce, expiry, verified e-mail),
//                                session cookies set, 302 to returnTo
//
// Accounts: a known Google identity signs in; otherwise an account with the
// same (Google-verified) e-mail address is linked; otherwise one is created.
// Linking to an account whose address was never verified removes its
// password and sessions: whoever registered it could not prove the address,
// Google just did (protects against account pre-hijacking).
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyReply } from "fastify";
import { SignJWT, createRemoteJWKSet, jwtVerify } from "jose";
import { SYSTEM, withActor } from "../db/pool.ts";
import { consumeLimits } from "../auth/attempts.ts";
import { createSession, revokeAllSessions } from "../auth/sessions.ts";
import { randomToken } from "../auth/tokens.ts";
import { setSessionCookies } from "../http/context.ts";
import { ApiError } from "../lib/errors.ts";

const STATE_COOKIE = "kie_g";
const STATE_TTL_SECONDS = 600;
const GOOGLE_AVATAR = /^https:\/\/lh[0-9]\.googleusercontent\.com\/[A-Za-z0-9/_=.-]{1,400}$/;

/** Only same-site paths; anything else falls back to the home page. */
export function safeReturnTo(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
  if (value.length > 300 || /[\r\n]/.test(value)) return "/";
  if (value.startsWith("/api/") || value.startsWith("/giris") || value.startsWith("/kayit")) return "/";
  return value;
}

export async function googleRoutes(app: FastifyInstance) {
  const { config, db, signer } = app.deps;
  const sessionOpts = { ttlDays: config.SESSION_TTL_DAYS, maxDays: config.SESSION_MAX_DAYS };
  const redirectUri = `${config.siteOrigin}/api/v1/auth/google/callback`;
  const stateKey = createHmac("sha256", config.JWT_SECRET).update("google-oauth-state").digest();
  const cookiePath = "/api/v1/auth/google";
  const jwks = createRemoteJWKSet(new URL(config.GOOGLE_JWKS_URL), { timeoutDuration: 5000 });
  const issuers = config.GOOGLE_ISSUER === "https://accounts.google.com" ? ["https://accounts.google.com", "accounts.google.com"] : [config.GOOGLE_ISSUER];

  app.addHook("onRequest", async () => {
    if (!config.googleEnabled) throw new ApiError(404, "not_found", "Bulunamadı.");
  });

  // Errors end on the sign-in page with a short code, never as JSON in the
  // browser; the reason is logged without any token or address.
  const fail = (reply: FastifyReply, reason: string, log: (o: object, m: string) => void) => {
    log({ event: "google_sign_in_failed", reason }, "google sign-in failed");
    reply.clearCookie(STATE_COOKIE, { path: cookiePath });
    return reply.redirect(`${config.siteOrigin}/giris?hata=google`, 302);
  };

  app.get("/start", async (req, reply) => {
    await consumeLimits(db, [{ action: "google_start_ip", subject: req.clientIp, max: 30, windowMinutes: 15 }]);
    const state = randomToken();
    const nonce = randomToken();
    const verifier = randomToken();
    const returnTo = safeReturnTo((req.query as { returnTo?: unknown }).returnTo);
    const cookie = await new SignJWT({ state, nonce, verifier, returnTo })
      .setProtectedHeader({ alg: "HS256" })
      .setAudience("kie-google-state")
      .setIssuedAt()
      .setExpirationTime(`${STATE_TTL_SECONDS}s`)
      .sign(stateKey);
    reply.setCookie(STATE_COOKIE, cookie, {
      httpOnly: true, secure: config.secureCookies, sameSite: "lax", path: cookiePath, maxAge: STATE_TTL_SECONDS,
    });
    const url = new URL(config.GOOGLE_AUTH_URL);
    url.search = new URLSearchParams({
      client_id: config.GOOGLE_CLIENT_ID!,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      nonce,
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: "S256",
      prompt: "select_account",
    }).toString();
    reply.header("cache-control", "no-store");
    return reply.redirect(url.toString(), 302);
  });

  app.get("/callback", async (req, reply) => {
    const log = req.log.warn.bind(req.log);
    await consumeLimits(db, [{ action: "google_callback_ip", subject: req.clientIp, max: 30, windowMinutes: 15 }]);
    const q = req.query as { code?: unknown; state?: unknown; error?: unknown };
    if (q.error) return fail(reply, "denied_at_google", log);

    let saved: { state: string; nonce: string; verifier: string; returnTo: string };
    try {
      const { payload } = await jwtVerify(req.cookies[STATE_COOKIE] ?? "", stateKey, { audience: "kie-google-state", algorithms: ["HS256"] });
      saved = payload as typeof saved;
    } catch {
      return fail(reply, "missing_or_expired_state", log);
    }
    reply.clearCookie(STATE_COOKIE, { path: cookiePath });
    const a = Buffer.from(String(q.state ?? ""));
    const b = Buffer.from(saved.state);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return fail(reply, "state_mismatch", log);
    if (typeof q.code !== "string" || q.code.length > 2000) return fail(reply, "no_code", log);

    // Code → tokens (server to server, client secret never leaves the API).
    let idToken: string;
    try {
      const res = await fetch(config.GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: q.code,
          client_id: config.GOOGLE_CLIENT_ID!,
          client_secret: config.GOOGLE_CLIENT_SECRET!,
          redirect_uri: redirectUri,
          code_verifier: saved.verifier,
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return fail(reply, `token_endpoint_${res.status}`, log);
      const body = (await res.json()) as { id_token?: unknown };
      if (typeof body.id_token !== "string") return fail(reply, "no_id_token", log);
      idToken = body.id_token;
    } catch {
      return fail(reply, "token_endpoint_unreachable", log);
    }

    let claims: { sub: string; email: string; name?: string; picture?: string };
    try {
      const { payload } = await jwtVerify(idToken, jwks, {
        issuer: issuers,
        audience: config.GOOGLE_CLIENT_ID!,
        algorithms: ["RS256"],
        maxTokenAge: "10m",
      });
      if (payload.nonce !== saved.nonce) return fail(reply, "nonce_mismatch", log);
      if (payload.email_verified !== true || typeof payload.email !== "string" || typeof payload.sub !== "string") {
        return fail(reply, "email_not_verified_by_google", log);
      }
      claims = payload as typeof claims;
    } catch {
      return fail(reply, "id_token_invalid", log);
    }

    const email = claims.email.trim().toLowerCase();
    if (email.length > 254) return fail(reply, "email_too_long", log);
    const name = (claims.name ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
    const avatar = typeof claims.picture === "string" && GOOGLE_AVATAR.test(claims.picture) ? claims.picture : null;

    const { userId, revoke } = await withActor(db, SYSTEM, async (sql) => {
      const [known] = await sql<{ userId: string }[]>`
        select user_id from auth.identities where provider = 'google' and provider_user_id = ${claims.sub}`;
      if (known) return { userId: known.userId, revoke: false };

      const [existing] = await sql<{ id: string; emailVerifiedAt: Date | null }[]>`
        select id, email_verified_at from auth.users where email = ${email} for update`;
      if (existing) {
        await sql`insert into auth.identities (user_id, provider, provider_user_id, email) values (${existing.id}, 'google', ${claims.sub}, ${email})`;
        if (!existing.emailVerifiedAt) {
          await sql`update auth.users set email_verified_at = now(), password_hash = null where id = ${existing.id}`;
          // Links e-mailed for the unproven registration are void too.
          await sql`update auth.one_time_tokens set used_at = now() where user_id = ${existing.id} and used_at is null`;
          return { userId: existing.id, revoke: true };
        }
        return { userId: existing.id, revoke: false };
      }

      const [user] = await sql<{ id: string }[]>`
        insert into auth.users (email, email_verified_at) values (${email}, now()) returning id`;
      await sql`insert into profiles (id, display_name, avatar_url) values (${user.id}, ${name.length >= 2 ? name : "Kullanıcı"}, ${avatar})`;
      await sql`insert into profile_private (id) values (${user.id})`;
      await sql`insert into auth.identities (user_id, provider, provider_user_id, email) values (${user.id}, 'google', ${claims.sub}, ${email})`;
      return { userId: user.id, revoke: false };
    });
    if (revoke) await revokeAllSessions(db, userId, "google_link_unverified");

    const session = await createSession(db, signer, sessionOpts, { userId, client: "web", userAgent: req.headers["user-agent"] });
    setSessionCookies(reply, config, session);
    reply.header("cache-control", "no-store");
    return reply.redirect(`${config.siteOrigin}${safeReturnTo(saved.returnTo)}`, 302);
  });
}
