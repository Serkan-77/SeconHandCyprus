// Production build: bundles the API (and the shared/ code it imports) into
// dist/. npm packages stay external and are installed in the image, so
// native modules (sharp, @node-rs/argon2) load their prebuilt binaries.
import { build } from "esbuild";
import { cp, rm } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await build({
  entryPoints: { server: "src/server.ts", migrate: "src/db/migrate.ts" },
  outdir: "dist",
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  packages: "external",
  sourcemap: true,
  logLevel: "info",
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
});
// Migrations ship next to the bundle (MIGRATIONS_DIR points here in the image).
await cp("../db/migrations", "dist/migrations", { recursive: true });
