// Housekeeping that runs inside the API process (one instance), on timers.
// Each job is small, idempotent and safe to skip.
import type { FastifyInstance } from "fastify";
import { pruneAttempts } from "./auth/attempts.ts";
import { cleanOrphanUploads } from "./modules/uploads.ts";

export function startJobs(app: FastifyInstance) {
  const { db } = app.deps;
  const every = (minutes: number, name: string, fn: () => Promise<unknown>) => {
    const tick = () =>
      fn()
        .then((r) => app.log.debug({ job: name, result: r }, "job done"))
        .catch((err) => app.log.warn({ job: name, err: { message: (err as Error).message } }, "job failed"));
    const first = setTimeout(tick, 30_000 + Math.random() * 30_000);
    const timer = setInterval(tick, minutes * 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  };

  const stops = [
    every(30, "orphan-uploads", () => cleanOrphanUploads(app)),
    every(60, "auth-attempts", () => pruneAttempts(db)),
    every(360, "auth-sessions", () =>
      db`delete from auth.sessions where expires_at < now() - interval '7 days' or revoked_at < now() - interval '30 days'`,
    ),
    every(360, "auth-tokens", () => db`delete from auth.one_time_tokens where expires_at < now() - interval '7 days'`),
  ];
  app.addHook("onClose", async () => stops.forEach((s) => s()));
}
