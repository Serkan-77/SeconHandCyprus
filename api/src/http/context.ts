// Who is calling, resolved once per request.
//
// Credentials, in order:
//   Authorization: Bearer <access token>   mobile app / scripts
//   kie_at cookie (HttpOnly)               web browser and the Next.js server
// A token only counts if its session is still live, so signing out anywhere
// takes effect on the next request, not when the JWT expires.
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Config } from "../config.ts";
import type { Actor, Db } from "../db/pool.ts";
import { forbidden, unauthorized } from "../lib/errors.ts";
import type { TokenSigner } from "../auth/tokens.ts";
import { safeEqual } from "../auth/tokens.ts";

export const ACCESS_COOKIE = "kie_at";
export const REFRESH_COOKIE = "kie_rt";

export type Viewer = {
  id: string;
  sessionId: string;
  role: "user" | "admin";
  status: "active" | "warned" | "restricted" | "suspended";
  statusUntil: Date | null;
  emailVerified: boolean;
  via: "cookie" | "bearer";
};

declare module "fastify" {
  interface FastifyRequest {
    viewer: Viewer | null;
    authProblem: "expired" | "invalid" | null;
    clientIp: string;
  }
}

export function actorOf(req: FastifyRequest): Actor {
  return req.viewer ? { userId: req.viewer.id, role: "user" } : { userId: null, role: "anon" };
}

export function requireViewer(req: FastifyRequest): Viewer {
  if (req.viewer) return req.viewer;
  if (req.authProblem === "expired") throw unauthorized("Oturumunun süresi doldu.", "token_expired");
  throw unauthorized();
}

export function requireAdmin(req: FastifyRequest): Viewer {
  const v = requireViewer(req);
  if (v.role !== "admin") throw forbidden("Bu işlem için yönetici yetkisi gerekiyor.");
  return v;
}

/** True while a restriction or suspension is in force (mirror of public.is_sanctioned). */
export function isSanctioned(v: Pick<Viewer, "status" | "statusUntil">) {
  return (v.status === "restricted" || v.status === "suspended") && (!v.statusUntil || v.statusUntil.getTime() >= Date.now());
}

export function resolveClientIp(req: FastifyRequest, config: Config) {
  // The Next.js server calls the API on behalf of browsers; it proves itself
  // with the shared internal token and passes the browser's address along.
  const internal = req.headers["x-kie-internal"];
  const forwarded = req.headers["x-kie-client-ip"];
  if (
    config.INTERNAL_API_TOKEN &&
    typeof internal === "string" &&
    typeof forwarded === "string" &&
    safeEqual(internal, config.INTERNAL_API_TOKEN) &&
    /^[0-9a-fA-F:.]{2,45}$/.test(forwarded)
  ) {
    return forwarded;
  }
  return req.ip;
}

export async function resolveViewer(req: FastifyRequest, db: Db, signer: TokenSigner) {
  req.viewer = null;
  req.authProblem = null;
  const header = req.headers.authorization;
  let token: string | undefined;
  let via: Viewer["via"] = "cookie";
  if (typeof header === "string" && header.startsWith("Bearer ")) {
    token = header.slice(7).trim();
    via = "bearer";
  } else {
    token = req.cookies?.[ACCESS_COOKIE];
  }
  if (!token) return;
  const claims = await signer.verify(token);
  if (claims === "expired" || claims === "invalid") {
    req.authProblem = claims;
    return;
  }
  const [row] = await db<
    { role: Viewer["role"]; status: Viewer["status"]; statusUntil: Date | null; emailVerifiedAt: Date | null }[]
  >`
    select p.role, p.status, p.status_until, u.email_verified_at
    from auth.sessions s
    join auth.users u on u.id = s.user_id
    join public.profiles p on p.id = u.id
    where s.id = ${claims.sid} and s.user_id = ${claims.sub}
      and s.revoked_at is null and s.expires_at > now()`;
  if (!row) {
    req.authProblem = "invalid";
    return;
  }
  req.viewer = {
    id: claims.sub,
    sessionId: claims.sid,
    role: row.role,
    status: row.status,
    statusUntil: row.statusUntil,
    emailVerified: Boolean(row.emailVerifiedAt),
    via,
  };
}

// Cookie-carrying requests that change something must come from our own
// pages: they need the X-KIE-CSRF header (a custom header cannot be sent
// cross-site without a CORS preflight, which this API never grants) and, when
// the browser sends an Origin, it must be ours. Bearer-token requests carry
// no ambient credentials and are exempt.
export function checkCsrf(req: FastifyRequest, config: Config) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return;
  if (typeof req.headers.authorization === "string" && req.headers.authorization.startsWith("Bearer ")) return;
  if (req.headers["x-kie-csrf"] !== "1") throw forbidden("İstek doğrulanamadı. Sayfayı yenileyip tekrar dene.");
  const origin = req.headers.origin;
  if (typeof origin === "string" && origin !== "null" && !config.allowedOrigins.has(origin)) {
    throw forbidden("İstek doğrulanamadı. Sayfayı yenileyip tekrar dene.");
  }
}

export function setSessionCookies(
  reply: FastifyReply,
  config: Config,
  s: { accessToken: string; refreshToken: string; accessExpiresIn: number; refreshExpiresAt: Date },
) {
  const base = { httpOnly: true, secure: config.secureCookies, sameSite: "lax" as const, path: "/", domain: config.COOKIE_DOMAIN };
  reply.setCookie(ACCESS_COOKIE, s.accessToken, { ...base, maxAge: s.accessExpiresIn });
  reply.setCookie(REFRESH_COOKIE, s.refreshToken, {
    ...base,
    maxAge: Math.max(0, Math.floor((s.refreshExpiresAt.getTime() - Date.now()) / 1000)),
  });
}

export function clearSessionCookies(reply: FastifyReply, config: Config) {
  const base = { httpOnly: true, secure: config.secureCookies, sameSite: "lax" as const, path: "/", domain: config.COOKIE_DOMAIN };
  reply.clearCookie(ACCESS_COOKIE, base);
  reply.clearCookie(REFRESH_COOKIE, base);
}
