// Health endpoints for Docker, Caddy and uptime monitoring.
//   /health        the process is up (liveness)
//   /health/ready  the database answers and the schema is current (readiness)
// Neither reveals versions, hostnames or configuration.
import { statfs } from "node:fs/promises";
import type { FastifyInstance } from "fastify";

export async function healthRoutes(app: FastifyInstance) {
  const { db, config } = app.deps;

  app.get("/health", async () => ({ status: "ok" }));

  app.get("/health/ready", async (_req, reply) => {
    const checks: Record<string, string> = {};
    try {
      await db`select 1`;
      checks.database = "ok";
    } catch {
      checks.database = "down";
    }
    try {
      const s = await statfs(config.UPLOAD_DIR);
      const freeRatio = (s.bavail * s.bsize) / (s.blocks * s.bsize);
      checks.disk = freeRatio < 0.1 ? "low" : "ok";
    } catch {
      checks.disk = "unknown";
    }
    const ok = checks.database === "ok";
    return reply.status(ok ? 200 : 503).send({ status: ok ? "ok" : "degraded", checks });
  });
}
