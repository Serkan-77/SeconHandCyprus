// /api/v1/auth — sign-up, sign-in, sessions, e-mail verification, password
// reset. Designed for two kinds of client:
//   web     tokens in HttpOnly cookies (kie_at, kie_rt); the body never
//           contains a token.
//   mobile  send {"client": "mobile"}; tokens come back in the JSON body and
//           the app sends "Authorization: Bearer <access>" and refreshes with
//           {"refreshToken": …}.
//
// Enumeration: sign-up, reset and resend answer the same way whether or not
// the address is registered; the e-mail itself tells the owner what happened.
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { SYSTEM, withActor } from "../db/pool.ts";
import { ApiError, badRequest, forbidden, unauthorized } from "../lib/errors.ts";
import { burnPasswordCheck, hashPassword, isLegacyHash, verifyPassword } from "../auth/passwords.ts";
import { consumeLimits, enforceLimits, recordAttempt } from "../auth/attempts.ts";
import { createSession, revokeAllSessions, revokeSession, rotateRefreshToken, type IssuedSession } from "../auth/sessions.ts";
import { hashToken, randomToken } from "../auth/tokens.ts";
import { emails } from "../email/templates.ts";
import { REFRESH_COOKIE, clearSessionCookies, requireViewer, setSessionCookies } from "../http/context.ts";
import { emailSchema, loginSchema, passwordSchema, signupSchema } from "../../../shared/schemas.ts";
import { parse } from "./common.ts";

const clientField = z.object({ client: z.enum(["web", "mobile"]).optional() });

const VERIFY_TTL_HOURS = 24;
const RESET_TTL_MINUTES = 60;

function clientOf(body: unknown): "web" | "mobile" {
  return clientField.safeParse(body).data?.client ?? "web";
}

export async function authRoutes(app: FastifyInstance) {
  const { config, db, signer, mailer, hub } = app.deps;
  const sessionOpts = { ttlDays: config.SESSION_TTL_DAYS, maxDays: config.SESSION_MAX_DAYS };
  const link = (path: string) => `${config.siteOrigin}${path}`;

  // Answers a successful sign-in in the client's format.
  function deliver(reply: FastifyReply, client: "web" | "mobile", session: IssuedSession, extra: Record<string, unknown> = {}) {
    if (client === "mobile") {
      return {
        ...extra,
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        expiresIn: session.accessExpiresIn,
        refreshExpiresAt: session.refreshExpiresAt.toISOString(),
      };
    }
    setSessionCookies(reply, config, session);
    return { ...extra, ok: true };
  }

  async function issueOneTimeToken(userId: string, kind: "email_verify" | "password_reset") {
    const token = randomToken();
    const ttl = kind === "email_verify" ? `${VERIFY_TTL_HOURS} hours` : `${RESET_TTL_MINUTES} minutes`;
    // One live token per purpose: a new request invalidates older links.
    await db`update auth.one_time_tokens set used_at = now() where user_id = ${userId} and kind = ${kind} and used_at is null`;
    await db`
      insert into auth.one_time_tokens (user_id, kind, token_hash, expires_at)
      values (${userId}, ${kind}, ${hashToken(token)}, now() + ${ttl}::interval)`;
    return token;
  }

  async function consumeOneTimeToken(token: unknown, kind: "email_verify" | "password_reset") {
    if (typeof token !== "string" || token.length < 20 || token.length > 100) return null;
    const [row] = await db<{ userId: string }[]>`
      update auth.one_time_tokens set used_at = now()
      where token_hash = ${hashToken(token)} and kind = ${kind} and used_at is null and expires_at > now()
      returning user_id`;
    return row?.userId ?? null;
  }

  function sendMail(mail: Parameters<typeof mailer.send>[0], req: FastifyRequest) {
    // Mail delivery must not decide the response (or reveal timing); failures are logged.
    void mailer.send(mail).catch((err) => req.log.error({ err: { message: (err as Error).message } }, "mail delivery failed"));
  }

  // ---------------------------------------------------------------- sign-up
  app.post("/signup", async (req) => {
    const input = parse(signupSchema, req.body);
    await consumeLimits(db, [
      { action: "signup_ip", subject: req.clientIp, max: 5, windowMinutes: 60, message: "Bu bağlantıdan çok fazla kayıt denemesi yapıldı. Daha sonra tekrar dene." },
    ]);
    const [existing] = await db<{ id: string; emailVerifiedAt: Date | null; displayName: string }[]>`
      select u.id, u.email_verified_at, p.display_name
      from auth.users u join profiles p on p.id = u.id where u.email = ${input.email}`;
    if (existing) {
      if (existing.emailVerifiedAt) {
        sendMail(emails.alreadyRegistered(input.email, link("/giris"), link("/sifre-yenile")), req);
      } else {
        const token = await issueOneTimeToken(existing.id, "email_verify");
        sendMail(emails.verify(input.email, existing.displayName, link(`/eposta-dogrula?token=${token}`)), req);
      }
      return { ok: true, verificationSent: true };
    }
    const passwordHash = await hashPassword(input.password);
    const userId = await withActor(db, SYSTEM, async (sql) => {
      const [user] = await sql<{ id: string }[]>`
        insert into auth.users (email, password_hash, password_changed_at)
        values (${input.email}, ${passwordHash}, now()) returning id`;
      await sql`insert into profiles (id, display_name, region) values (${user.id}, ${input.name}, ${input.region})`;
      await sql`insert into profile_private (id, phone) values (${user.id}, ${input.phone})`;
      return user.id;
    });
    const token = await issueOneTimeToken(userId, "email_verify");
    sendMail(emails.verify(input.email, input.name, link(`/eposta-dogrula?token=${token}`)), req);
    return { ok: true, verificationSent: true };
  });

  // ---------------------------------------------------------------- e-mail verification
  app.post("/verify-email", async (req, reply) => {
    const body = (req.body ?? {}) as { token?: unknown };
    const userId = await consumeOneTimeToken(body.token, "email_verify");
    if (!userId) throw new ApiError(400, "invalid_token", "Doğrulama bağlantısı geçersiz ya da süresi dolmuş. Yeni bir bağlantı iste.");
    await db`update auth.users set email_verified_at = coalesce(email_verified_at, now()) where id = ${userId}`;
    // Proving the address signs the person in, as the old e-mail link did.
    const session = await createSession(db, signer, sessionOpts, { userId, client: clientOf(req.body), userAgent: req.headers["user-agent"] });
    return deliver(reply, clientOf(req.body), session, { verified: true });
  });

  app.post("/resend-verification", async (req) => {
    const email = parse(z.object({ email: emailSchema }), req.body).email;
    await consumeLimits(db, [
      { action: "resend_ip", subject: req.clientIp, max: 10, windowMinutes: 60 },
      { action: "resend_email", subject: email, max: 3, windowMinutes: 60 },
    ]);
    const [user] = await db<{ id: string; emailVerifiedAt: Date | null; displayName: string }[]>`
      select u.id, u.email_verified_at, p.display_name from auth.users u join profiles p on p.id = u.id where u.email = ${email}`;
    if (user && !user.emailVerifiedAt) {
      const token = await issueOneTimeToken(user.id, "email_verify");
      sendMail(emails.verify(email, user.displayName, link(`/eposta-dogrula?token=${token}`)), req);
    }
    return { ok: true };
  });

  // ---------------------------------------------------------------- sign-in
  app.post("/login", async (req, reply) => {
    const input = parse(loginSchema, req.body);
    const client = clientOf(req.body);
    const limits = [
      { action: "login_ip", subject: req.clientIp, max: 30, windowMinutes: 15 },
      { action: "login_email", subject: input.email, max: 8, windowMinutes: 15, message: "Bu hesap için çok fazla hatalı deneme yapıldı. 15 dakika sonra tekrar dene ya da şifreni sıfırla." },
    ];
    await enforceLimits(db, limits);
    const [user] = await db<{ id: string; passwordHash: string | null; emailVerifiedAt: Date | null }[]>`
      select id, password_hash, email_verified_at from auth.users where email = ${input.email}`;
    const ok = user?.passwordHash ? await verifyPassword(user.passwordHash, input.password) : (await burnPasswordCheck(input.password), false);
    if (!user || !ok) {
      for (const l of limits) await recordAttempt(db, l.action, l.subject);
      throw unauthorized("E-posta ya da şifre hatalı.", "invalid_credentials");
    }
    if (!user.emailVerifiedAt) {
      throw new ApiError(403, "email_not_verified", "E-posta adresin henüz doğrulanmadı. Gelen kutundaki bağlantıya tıkla ya da yeni bağlantı iste.");
    }
    if (isLegacyHash(user.passwordHash!)) {
      // Imported Supabase (bcrypt) hash: upgrade to Argon2id now that we know the password.
      await db`update auth.users set password_hash = ${await hashPassword(input.password)} where id = ${user.id}`;
    }
    const session = await createSession(db, signer, sessionOpts, { userId: user.id, client, userAgent: req.headers["user-agent"] });
    return deliver(reply, client, session);
  });

  app.post("/refresh", async (req, reply) => {
    const body = (req.body ?? {}) as { refreshToken?: unknown; client?: unknown };
    const client = clientOf(req.body);
    const token = client === "mobile" ? body.refreshToken : req.cookies[REFRESH_COOKIE];
    const result = await rotateRefreshToken(db, signer, sessionOpts, typeof token === "string" ? token : "");
    if (!result.ok) {
      if (client === "web") clearSessionCookies(reply, config);
      if (result.reason === "reused") req.log.warn({ event: "refresh_token_reuse" }, "refresh token reuse: session revoked");
      throw unauthorized("Oturumun sona erdi. Tekrar giriş yap.", "session_expired");
    }
    return deliver(reply, client, result.session);
  });

  app.post("/logout", async (req, reply) => {
    if (req.viewer) {
      await revokeSession(db, req.viewer.sessionId);
      hub.closeSession(req.viewer.sessionId);
    }
    clearSessionCookies(reply, config);
    return { ok: true };
  });

  app.post("/logout-all", async (req, reply) => {
    const v = requireViewer(req);
    await revokeAllSessions(db, v.id, "sign_out_everywhere");
    hub.closeUser(v.id);
    clearSessionCookies(reply, config);
    return { ok: true };
  });

  app.get("/sessions", async (req) => {
    const v = requireViewer(req);
    const rows = await db<{ id: string; client: string; userAgent: string | null; createdAt: Date; lastUsedAt: Date }[]>`
      select id, client, user_agent, created_at, last_used_at from auth.sessions
      where user_id = ${v.id} and revoked_at is null and expires_at > now()
      order by last_used_at desc limit 50`;
    return { sessions: rows.map((s) => ({ ...s, current: s.id === v.sessionId })) };
  });

  app.delete("/sessions/:id", async (req) => {
    const v = requireViewer(req);
    const id = String((req.params as { id: string }).id);
    const [row] = await db`
      update auth.sessions set revoked_at = now(), revoke_reason = 'revoked_by_user'
      where id = ${id}::uuid and user_id = ${v.id} and revoked_at is null returning id`;
    if (row) hub.closeSession(id);
    return { ok: Boolean(row) };
  });

  app.get("/me", async (req) => {
    const v = requireViewer(req);
    const [u] = await db<{ email: string; hasPassword: boolean }[]>`
      select email, password_hash is not null as has_password from auth.users where id = ${v.id}`;
    return { id: v.id, role: v.role, status: v.status, email: u?.email ?? null, emailVerified: v.emailVerified, hasPassword: Boolean(u?.hasPassword) };
  });

  // ---------------------------------------------------------------- passwords
  app.post("/password-reset", async (req) => {
    const email = parse(z.object({ email: emailSchema }), req.body).email;
    await consumeLimits(db, [
      { action: "reset_ip", subject: req.clientIp, max: 10, windowMinutes: 60 },
      { action: "reset_email", subject: email, max: 3, windowMinutes: 60 },
    ]);
    const [user] = await db<{ id: string }[]>`select id from auth.users where email = ${email}`;
    if (user) {
      const token = await issueOneTimeToken(user.id, "password_reset");
      sendMail(emails.passwordReset(email, link(`/yeni-sifre?token=${token}`)), req);
    }
    return { ok: true };
  });

  app.post("/password-reset/confirm", async (req, reply) => {
    const body = parse(z.object({ token: z.string().min(20).max(100), password: passwordSchema }), req.body);
    await consumeLimits(db, [{ action: "reset_confirm_ip", subject: req.clientIp, max: 20, windowMinutes: 60 }]);
    const userId = await consumeOneTimeToken(body.token, "password_reset");
    if (!userId) throw new ApiError(400, "invalid_token", "Şifre sıfırlama bağlantısı geçersiz ya da süresi dolmuş. Yeni bir bağlantı iste.");
    const [user] = await db<{ email: string }[]>`
      update auth.users
      set password_hash = ${await hashPassword(body.password)}, password_changed_at = now(),
          email_verified_at = coalesce(email_verified_at, now())
      where id = ${userId} returning email`;
    // A reset means the old password may be known to someone else.
    await revokeAllSessions(db, userId, "password_reset");
    hub.closeUser(userId);
    sendMail(emails.passwordChanged(user.email, link("/destek")), req);
    const session = await createSession(db, signer, sessionOpts, { userId, client: clientOf(req.body), userAgent: req.headers["user-agent"] });
    return deliver(reply, clientOf(req.body), session);
  });

  app.post("/password", async (req) => {
    const v = requireViewer(req);
    const body = parse(z.object({ current: z.string().max(200).optional(), password: passwordSchema }), req.body);
    const [user] = await db<{ email: string; passwordHash: string | null }[]>`
      select email, password_hash from auth.users where id = ${v.id}`;
    if (user.passwordHash) {
      await enforceLimits(db, [{ action: "password_change", subject: v.id, max: 5, windowMinutes: 15 }]);
      if (!(await verifyPassword(user.passwordHash, body.current ?? ""))) {
        await recordAttempt(db, "password_change", v.id);
        throw forbidden("Mevcut şifren hatalı.");
      }
    }
    if (body.current && body.current === body.password) throw badRequest("Yeni şifre eskisiyle aynı olamaz.");
    await db`update auth.users set password_hash = ${await hashPassword(body.password)}, password_changed_at = now() where id = ${v.id}`;
    await revokeAllSessions(db, v.id, "password_changed", v.sessionId);
    sendMail(emails.passwordChanged(user.email, link("/destek")), req);
    return { ok: true };
  });
}
