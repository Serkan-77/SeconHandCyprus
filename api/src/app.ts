// Builds the Fastify application. server.ts starts it; tests build it with a
// test configuration and call it through app.inject().
import { randomUUID } from "node:crypto";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import { ZodError } from "zod";
import type { Config } from "./config.ts";
import { createDb, type Db } from "./db/pool.ts";
import { ApiError, fromDbError } from "./lib/errors.ts";
import { createTokenSigner, type TokenSigner } from "./auth/tokens.ts";
import { createMailer, type Mailer } from "./email/mailer.ts";
import { LocalStore, type ObjectStore } from "./storage/store.ts";
import { RealtimeHub } from "./realtime/hub.ts";
import { checkCsrf, resolveClientIp, resolveViewer } from "./http/context.ts";
import { LIMITS } from "../../shared/constants.ts";
import { firstError } from "../../shared/schemas.ts";
import { googleRoutes } from "./modules/google.ts";
import { authRoutes } from "./modules/auth.ts";
import { taxonomyRoutes } from "./modules/taxonomy.ts";
import { listingRoutes } from "./modules/listings.ts";
import { meRoutes } from "./modules/me.ts";
import { conversationRoutes } from "./modules/conversations.ts";
import { userRoutes } from "./modules/users.ts";
import { mediaRoutes, uploadRoutes } from "./modules/uploads.ts";
import { adminRoutes } from "./modules/admin.ts";
import { realtimeRoutes } from "./modules/realtime.ts";
import { healthRoutes } from "./modules/health.ts";

export type Deps = {
  config: Config;
  db: Db;
  signer: TokenSigner;
  mailer: Mailer;
  store: ObjectStore;
  hub: RealtimeHub;
};

declare module "fastify" {
  interface FastifyInstance {
    deps: Deps;
  }
}

export async function buildApp(config: Config, overrides: Partial<Deps> = {}): Promise<FastifyInstance> {
  const app = Fastify({
    // Only the configured number of proxy hops (Caddy) may set X-Forwarded-For.
    trustProxy: (_address: string, hop: number) => hop < config.TRUST_PROXY_HOPS,
    bodyLimit: 256 * 1024,
    genReqId: (req) => {
      const given = req.headers["x-request-id"];
      return typeof given === "string" && /^[A-Za-z0-9-]{8,64}$/.test(given) ? given : randomUUID();
    },
    logger:
      config.LOG_LEVEL === "silent"
        ? false
        : {
            level: config.LOG_LEVEL,
            // Credentials and cookies never reach the log; request bodies are
            // not logged at all (they hold passwords and messages).
            redact: {
              paths: ["req.headers.authorization", "req.headers.cookie", 'res.headers["set-cookie"]', "req.headers[\"x-kie-internal\"]"],
              censor: "[redacted]",
            },
            serializers: {
              req: (req: FastifyRequest) => ({ method: req.method, url: req.url.split("?")[0], id: req.id }),
            },
          },
  });

  const db = overrides.db ?? createDb(config.DATABASE_URL, config.DATABASE_POOL_MAX);
  const deps: Deps = {
    config,
    db,
    signer: overrides.signer ?? createTokenSigner(config.JWT_SECRET, config.ACCESS_TOKEN_TTL_SECONDS),
    mailer: overrides.mailer ?? createMailer(config, app.log),
    store: overrides.store ?? new LocalStore(config.UPLOAD_DIR),
    hub: overrides.hub ?? new RealtimeHub(db, app.log),
  };
  app.decorate("deps", deps);
  app.decorateRequest("viewer", null);
  app.decorateRequest("authProblem", null);
  app.decorateRequest("clientIp", "");

  await app.register(cookie);
  await app.register(multipart, {
    limits: { fileSize: LIMITS.uploadMaxBytes, files: 1, fields: 4, parts: 6, headerPairs: 50 },
  });
  await app.register(websocket, { options: { maxPayload: 4096 } });
  if (!config.DISABLE_REQUEST_LIMITER) {
    // Coarse per-IP ceiling against floods and scraping; the business limits
    // (messages, listings, reports…) are enforced in the database.
    await app.register(rateLimit, {
      global: true,
      // After the onRequest hook, so the key is the browser's address even
      // for requests the Next.js server makes on its behalf.
      hook: "preHandler",
      max: 600,
      timeWindow: "5 minutes",
      keyGenerator: (req) => req.clientIp || req.ip,
      allowList: (req) => req.url.startsWith("/health"),
      errorResponseBuilder: () => ({
        statusCode: 429,
        error: { code: "rate_limited", message: "Çok fazla istek gönderdin. Biraz bekleyip tekrar dene." },
      }),
    });
  }

  app.addHook("onRequest", async (req, reply) => {
    reply.header("x-request-id", req.id);
    req.clientIp = resolveClientIp(req, config);
    if (req.url.startsWith("/api/")) {
      reply.header("cache-control", "no-store");
      reply.header("x-content-type-options", "nosniff");
      checkCsrf(req, config);
      await resolveViewer(req, db, deps.signer);
    }
  });

  app.setErrorHandler((error, req, reply) => {
    let e: ApiError | null = null;
    if (error instanceof ApiError) e = error;
    else if (error instanceof ZodError) {
      const fields: Record<string, string> = {};
      for (const issue of error.issues) fields[issue.path.join(".") || "_"] ??= issue.message;
      e = new ApiError(422, "validation_failed", firstError(error), fields);
    } else e = fromDbError(error);
    const status = (error as { statusCode?: number }).statusCode;
    if (!e && status === 429) e = new ApiError(429, "rate_limited", "Çok fazla istek gönderdin. Biraz bekleyip tekrar dene.");
    if (!e && status === 413) e = new ApiError(413, "too_large", "Dosya ya da istek çok büyük.");
    if (!e && status && status >= 400 && status < 500) e = new ApiError(status, "bad_request", "Geçersiz istek.");
    if (!e) {
      req.log.error({ err: error }, "unhandled error");
      e = new ApiError(500, "internal", "Beklenmeyen bir sorun oluştu. Lütfen tekrar dene.");
    }
    const body: { error: { code: string; message: string; fields?: Record<string, string> } } = {
      error: { code: e.code, message: e.message },
    };
    if (e.fields) body.error.fields = e.fields;
    return reply.status(e.status).send(body);
  });

  app.setNotFoundHandler((_req, reply) => reply.status(404).send({ error: { code: "not_found", message: "Bulunamadı." } }));

  await app.register(healthRoutes);
  await app.register(realtimeRoutes);
  await app.register(mediaRoutes);
  await app.register(
    async (api) => {
      await api.register(authRoutes, { prefix: "/auth" });
      await api.register(googleRoutes, { prefix: "/auth/google" });
      await api.register(taxonomyRoutes);
      await api.register(listingRoutes);
      await api.register(meRoutes, { prefix: "/me" });
      await api.register(conversationRoutes);
      await api.register(userRoutes);
      await api.register(uploadRoutes);
      await api.register(adminRoutes, { prefix: "/admin" });
    },
    { prefix: "/api/v1" },
  );

  app.addHook("onClose", async () => {
    await deps.hub.stop();
    if (!overrides.db) await db.end({ timeout: 5 });
  });

  return app;
}
