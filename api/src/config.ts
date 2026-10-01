// Environment, validated once at start-up. A missing or malformed value stops
// the process with the variable's name (never its value).
import { z } from "zod";

const bool = z
  .enum(["0", "1", "true", "false"])
  .optional()
  .transform((v) => v === "1" || v === "true");

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    HOST: z.string().default("0.0.0.0"),
    PORT: z.coerce.number().int().positive().default(4000),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),

    /** Runtime connection as kie_app (row level security applies). */
    DATABASE_URL: z.string().url(),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),

    /** Public origin of the site, e.g. https://www.kibrisikincielcim.com. */
    SITE_URL: z.string().url(),
    /** Extra origins allowed to send cookie-authenticated requests (comma separated). */
    EXTRA_ORIGINS: z.string().default(""),

    /** HMAC key for access tokens; at least 32 random bytes. */
    JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
    SESSION_MAX_DAYS: z.coerce.number().int().min(1).max(365).default(180),
    COOKIE_DOMAIN: z.string().optional(),

    /** Shared secret the Next.js server sends so the API trusts its client-IP header. */
    INTERNAL_API_TOKEN: z.string().min(32).optional(),
    /** Hops of trusted reverse proxies in front of the API (Caddy = 1). */
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(3).default(1),

    UPLOAD_DIR: z.string().default("./data/uploads"),
    MEDIA_URL: z.string().default("/media"),
    SERVE_MEDIA: bool,

    MAIL_TRANSPORT: z.enum(["smtp", "log", "memory"]).default("log"),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    SMTP_SECURE: bool,
    MAIL_FROM: z.string().default("Kıbrıs İkinci Elcim <no-reply@kibrisikincielcim.com>"),

    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    /** Google endpoints; overridden only by tests (a local fake provider). */
    GOOGLE_AUTH_URL: z.string().url().default("https://accounts.google.com/o/oauth2/v2/auth"),
    GOOGLE_TOKEN_URL: z.string().url().default("https://oauth2.googleapis.com/token"),
    GOOGLE_JWKS_URL: z.string().url().default("https://www.googleapis.com/oauth2/v3/certs"),
    GOOGLE_ISSUER: z.string().default("https://accounts.google.com"),

    /** Disables the in-memory request limiter (tests only). */
    DISABLE_REQUEST_LIMITER: bool,
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "production") {
      if (!env.SITE_URL.startsWith("https://")) {
        ctx.addIssue({ code: "custom", path: ["SITE_URL"], message: "must be https in production" });
      }
      if (env.MAIL_TRANSPORT !== "smtp") {
        ctx.addIssue({ code: "custom", path: ["MAIL_TRANSPORT"], message: "must be smtp in production" });
      }
      for (const key of ["GOOGLE_AUTH_URL", "GOOGLE_TOKEN_URL", "GOOGLE_JWKS_URL"] as const) {
        if (!env[key].startsWith("https://")) ctx.addIssue({ code: "custom", path: [key], message: "must be https in production" });
      }
      if (env.DISABLE_REQUEST_LIMITER) {
        ctx.addIssue({ code: "custom", path: ["DISABLE_REQUEST_LIMITER"], message: "not allowed in production" });
      }
    }
    if (env.MAIL_TRANSPORT === "smtp" && !env.SMTP_HOST) {
      ctx.addIssue({ code: "custom", path: ["SMTP_HOST"], message: "required when MAIL_TRANSPORT=smtp" });
    }
    if (Boolean(env.GOOGLE_CLIENT_ID) !== Boolean(env.GOOGLE_CLIENT_SECRET)) {
      ctx.addIssue({ code: "custom", path: ["GOOGLE_CLIENT_SECRET"], message: "set both Google variables or neither" });
    }
  });

export type Config = z.infer<typeof schema> & {
  siteOrigin: string;
  allowedOrigins: Set<string>;
  secureCookies: boolean;
  googleEnabled: boolean;
};

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join(".") || "env"}: ${i.message}`);
    throw new Error(`Invalid environment:\n  ${problems.join("\n  ")}`);
  }
  const c = parsed.data;
  const siteOrigin = new URL(c.SITE_URL).origin;
  const allowedOrigins = new Set([
    siteOrigin,
    ...c.EXTRA_ORIGINS.split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => new URL(s).origin),
  ]);
  // www and apex are the same site.
  const url = new URL(siteOrigin);
  if (url.hostname.startsWith("www.")) allowedOrigins.add(`${url.protocol}//${url.hostname.slice(4)}`);
  return {
    ...c,
    siteOrigin,
    allowedOrigins,
    secureCookies: siteOrigin.startsWith("https://"),
    googleEnabled: Boolean(c.GOOGLE_CLIENT_ID && c.GOOGLE_CLIENT_SECRET),
  };
}
