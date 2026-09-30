// Entry point: validates the environment, builds the app, starts realtime and
// housekeeping, and shuts down cleanly on SIGTERM (docker stop).
import { mkdir } from "node:fs/promises";
import { loadConfig } from "./config.ts";
import { buildApp } from "./app.ts";
import { startJobs } from "./jobs.ts";

async function main() {
  const config = loadConfig();
  await mkdir(config.UPLOAD_DIR, { recursive: true });
  const app = await buildApp(config);
  await app.deps.hub.start();
  startJobs(app);
  await app.listen({ host: config.HOST, port: config.PORT });

  let stopping = false;
  const stop = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    app.log.info({ signal }, "shutting down");
    const force = setTimeout(() => process.exit(1), 15_000);
    force.unref();
    await app.close();
    process.exit(0);
  };
  process.on("SIGTERM", () => void stop("SIGTERM"));
  process.on("SIGINT", () => void stop("SIGINT"));
}

main().catch((error) => {
  // Configuration errors list variable names only.
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
