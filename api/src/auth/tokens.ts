// Access tokens are short-lived JWTs (HS256) naming the user and the session;
// every request still checks that the session is live, so signing out or
// "sign out everywhere" takes effect immediately. Refresh tokens and one-time
// tokens are random 256-bit strings; only their SHA-256 is stored.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify, errors as joseErrors } from "jose";

const ISSUER = "kibrisikincielcim";
const AUDIENCE = "kie-api";

export type AccessClaims = { sub: string; sid: string };

export function createTokenSigner(secret: string, ttlSeconds: number) {
  const key = new TextEncoder().encode(secret);
  return {
    async sign(claims: AccessClaims) {
      return new SignJWT({ sid: claims.sid })
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .setSubject(claims.sub)
        .setIssuer(ISSUER)
        .setAudience(AUDIENCE)
        .setIssuedAt()
        .setExpirationTime(`${ttlSeconds}s`)
        .sign(key);
    },
    /** The claims, or "expired" / "invalid". */
    async verify(token: string): Promise<AccessClaims | "expired" | "invalid"> {
      try {
        const { payload } = await jwtVerify(token, key, { issuer: ISSUER, audience: AUDIENCE, algorithms: ["HS256"] });
        if (typeof payload.sub !== "string" || typeof payload.sid !== "string") return "invalid";
        return { sub: payload.sub, sid: payload.sid };
      } catch (e) {
        return e instanceof joseErrors.JWTExpired ? "expired" : "invalid";
      }
    },
    ttlSeconds,
  };
}

export type TokenSigner = ReturnType<typeof createTokenSigner>;

export function randomToken() {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest();
}

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Opaque, non-reversible key for rate-limit rows ("login_ip:1.2.3.4"). */
export function attemptKey(action: string, subject: string) {
  return createHash("sha256").update(`${action}:${subject.toLowerCase()}`).digest();
}
