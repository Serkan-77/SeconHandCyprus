// Applies db/migrations/*.sql in name order, each in its own transaction, as
// the schema owner (DATABASE_OWNER_URL). Applied files are recorded with a
// checksum; a changed file that was already applied stops the run instead of
// silently diverging from production.
//
//   npm run migrate            apply pending migrations
//   npm run migrate -- --check exit 1 if any migration is pending (CI/deploy gate)
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const here = path.dirname(fileURLToPath(import.meta.url));

export function migrationsDir() {
  return process.env.MIGRATIONS_DIR ?? path.resolve(here, "../../../db/migrations");
}

export async function migrate(url: string, { check = false, log = console.log } = {}) {
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await sql`create table if not exists public.schema_migrations (
      name text primary key,
      checksum text not null,
      applied_at timestamptz not null default now()
    )`;
    const applied = new Map(
      (await sql<{ name: string; checksum: string }[]>`select name, checksum from public.schema_migrations`).map((r) => [
        r.name,
        r.checksum,
      ]),
    );
    const dir = migrationsDir();
    const files = (await readdir(dir)).filter((f) => /^\d{4}_[a-z0-9_]+\.sql$/.test(f)).sort();
    const pending: string[] = [];
    for (const file of files) {
      const body = await readFile(path.join(dir, file), "utf8");
      const checksum = createHash("sha256").update(body).digest("hex");
      const known = applied.get(file);
      if (known && known !== checksum) {
        throw new Error(`Migration ${file} was changed after it was applied. Add a new migration instead.`);
      }
      if (known) continue;
      pending.push(file);
      if (check) continue;
      await sql.begin(async (tx) => {
        await tx.unsafe(body);
        await tx`insert into public.schema_migrations (name, checksum) values (${file}, ${checksum})`;
      });
      log(`applied ${file}`);
    }
    if (check && pending.length) {
      log(`pending: ${pending.join(", ")}`);
      return { pending };
    }
    if (!pending.length) log("database is up to date");
    return { pending: check ? pending : [] };
  } finally {
    await sql.end();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const url = process.env.DATABASE_OWNER_URL;
  if (!url) {
    console.error("DATABASE_OWNER_URL is required");
    process.exit(1);
  }
  const check = process.argv.includes("--check");
  migrate(url, { check })
    .then(({ pending }) => process.exit(check && pending.length ? 1 : 0))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
