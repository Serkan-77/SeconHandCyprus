// One-way import from the old Supabase project into the new PostgreSQL
// database. See MIGRATION.md for the full runbook.
//
//   SOURCE_DATABASE_URL   Supabase Postgres (session pooler or direct), read only
//   TARGET_DATABASE_URL   new database as the `postgres` superuser (needed to
//                         import with triggers off: session_replication_role)
//   STORAGE_SOURCE        https://<ref>.supabase.co/storage/v1/object/public
//                         or a local directory holding <bucket>/<path> files
//   UPLOAD_DIR            where processed images are written (the API's)
//   IMPORT_STATE          image progress file (default ./supabase-import-state.json)
//
//   tsx scripts/supabase-import.ts [--dry-run] [--images-only] [--report=<file>]
//
// What it does
//   1. Reads the whole source inside one REPEATABLE READ, READ ONLY
//      transaction, so the copy is a consistent snapshot. Nothing is written
//      to Supabase.
//   2. Images: every listing photo and Storage avatar is fetched, decoded and
//      re-encoded by the API's own pipeline (WebP variants, metadata
//      stripped). Progress is kept in IMPORT_STATE so a rerun resumes.
//   3. Data: one target transaction with triggers off (they are guards and
//      side effects like notifications; the data is already valid). IDs and
//      timestamps are preserved. Each table copies the columns both schemas
//      share plus the documented transforms; a row the new constraints refuse
//      aborts the import with its table and id (fail closed).
//   4. Sequences are moved past imported ids, then every foreign key in the
//      database is checked explicitly before COMMIT.
// The target must be freshly migrated and hold no accounts.
// Personal data is never logged: rows are identified by id only.
import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import { ImageRejected, newKey, processImage, type UploadKind } from "../src/storage/images.ts";
import { LocalStore } from "../src/storage/store.ts";

type Row = Record<string, unknown>;
type Sql = postgres.Sql | postgres.TransactionSql;

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const IMAGES_ONLY = args.has("--images-only");
const REPORT_FILE = process.argv.find((a) => a.startsWith("--report="))?.slice(9);

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required`);
  return v;
}

const SOURCE_URL = env("SOURCE_DATABASE_URL");
const TARGET_URL = IMAGES_ONLY ? "" : env("TARGET_DATABASE_URL");
const STORAGE_SOURCE = env("STORAGE_SOURCE").replace(/\/$/, "");
const UPLOAD_DIR = env("UPLOAD_DIR");
const STATE_FILE = process.env.IMPORT_STATE ?? "./supabase-import-state.json";
const BATCH = 500;

const report = {
  startedAt: new Date().toISOString(),
  dryRun: DRY_RUN,
  tables: {} as Record<string, { source: number; imported: number; skipped: number }>,
  images: { processed: 0, reused: 0, failed: 0, external: 0 },
  warnings: [] as string[],
};
const warn = (msg: string) => {
  report.warnings.push(msg);
  console.warn(`  ! ${msg}`);
};
const log = (msg: string) => console.log(msg);

// ---------------------------------------------------------------------------
// 1. Source snapshot
// ---------------------------------------------------------------------------

// Old tables, in dependency order. Anything else found in the source is
// reported; rate_limit_events is short-lived state and is not carried over.
const PUBLIC_TABLES = [
  "profiles", "profile_private", "listings", "listing_images", "favorites", "blocks",
  "conversations", "messages", "ratings", "reports", "sanctions", "verification_requests",
  "notifications", "announcements", "support_tickets",
];
const NOT_IMPORTED = new Set(["rate_limit_events", "categories", "schema_migrations"]);

type Snapshot = { users: Row[]; identities: Row[]; categories: Row[]; tables: Map<string, Row[]> };

async function readSource(): Promise<Snapshot> {
  const src = postgres(SOURCE_URL, { max: 1, prepare: false, idle_timeout: 5, connection: { application_name: "kie-import" } });
  try {
    return await src.begin("isolation level repeatable read read only", async (tx) => {
      const users = await tx`
        select id, email, encrypted_password, email_confirmed_at, last_sign_in_at, created_at, updated_at, deleted_at
        from auth.users order by created_at, id`;
      const identities = await tx`
        select user_id, provider, provider_id, identity_data ->> 'email' as email, created_at
        from auth.identities where provider = 'google'`;
      const categories = await tx`select * from public.categories order by id`;
      const present = await tx<{ tableName: string }[]>`
        select table_name as "tableName" from information_schema.tables
        where table_schema = 'public' and table_type = 'BASE TABLE'`;
      const names = new Set(present.map((r) => r.tableName));
      for (const t of names) {
        if (!PUBLIC_TABLES.includes(t) && !NOT_IMPORTED.has(t)) warn(`source table public.${t} has no import rule; not copied`);
      }
      const tables = new Map<string, Row[]>();
      for (const t of PUBLIC_TABLES) {
        if (!names.has(t)) {
          warn(`source has no public.${t}`);
          tables.set(t, []);
          continue;
        }
        tables.set(t, await tx`select * from ${tx("public")}.${tx(t)}`);
      }
      return { users, identities, categories, tables };
    });
  } finally {
    await src.end();
  }
}

// ---------------------------------------------------------------------------
// 2. Images
// ---------------------------------------------------------------------------

type ImageEntry = { key: string; width: number; height: number; bytes: number } | { error: string };
type State = Record<string, ImageEntry>;

function loadState(): State {
  return existsSync(STATE_FILE) ? (JSON.parse(readFileSync(STATE_FILE, "utf8")) as State) : {};
}
function saveState(state: State) {
  writeFileSync(`${STATE_FILE}.tmp`, JSON.stringify(state, null, 1));
  renameSync(`${STATE_FILE}.tmp`, STATE_FILE);
}

const GOOGLE_AVATAR = /^https:\/\/lh[0-9]\.googleusercontent\.com\//;

async function fetchObject(bucket: string, objectPath: string): Promise<Buffer> {
  if (/^https:\/\//.test(objectPath)) return download(objectPath);
  if (/^https?:\/\//.test(STORAGE_SOURCE)) {
    const url = `${STORAGE_SOURCE}/${bucket}/${objectPath.split("/").map(encodeURIComponent).join("/")}`;
    return download(url);
  }
  const base = path.resolve(STORAGE_SOURCE, bucket);
  const file = path.resolve(base, objectPath);
  if (!file.startsWith(base + path.sep)) throw new Error("path escapes the storage directory");
  return readFile(file);
}

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000), redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const length = Number(res.headers.get("content-length") ?? 0);
  if (length > 30 * 1024 * 1024) throw new Error("file too large");
  return Buffer.from(await res.arrayBuffer());
}

/** Old image reference → bucket/kind, or null when it is not a Storage object. */
function imageRef(value: unknown, bucket: "listing-images" | "avatars"): { id: string; kind: UploadKind; bucket: string; path: string } | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  if (bucket === "avatars" && GOOGLE_AVATAR.test(value)) return null; // kept as an external URL
  if (/^http:\/\//.test(value) || value.startsWith("/")) return null; // not importable
  return { id: `${bucket}:${value}`, kind: bucket === "avatars" ? "avatar" : "listing", bucket, path: value };
}

async function importImages(snap: Snapshot, state: State) {
  const store = new LocalStore(UPLOAD_DIR);
  const refs = new Map<string, NonNullable<ReturnType<typeof imageRef>>>();
  for (const r of snap.tables.get("listing_images") ?? []) {
    const ref = imageRef(r.path, "listing-images");
    if (ref) refs.set(ref.id, ref);
    else warn(`listing_images ${r.id}: path is not a Storage object; row dropped`);
  }
  for (const p of snap.tables.get("profiles") ?? []) {
    const ref = imageRef(p.avatar_url, "avatars");
    if (ref) refs.set(ref.id, ref);
    else if (typeof p.avatar_url === "string" && GOOGLE_AVATAR.test(p.avatar_url)) report.images.external++;
  }
  log(`images: ${refs.size} to import`);
  let done = 0;
  for (const ref of refs.values()) {
    done++;
    const prev = state[ref.id];
    if (prev && "key" in prev && existsSync(path.join(UPLOAD_DIR, prev.key, "md.webp"))) {
      report.images.reused++;
      continue;
    }
    try {
      const input = await fetchObject(ref.bucket, ref.path);
      const out = await processImage(input, ref.kind, { legacy: true });
      const key = newKey(ref.kind);
      await store.putVariants(key, out.variants);
      state[ref.id] = { key, width: out.width, height: out.height, bytes: out.bytes };
      report.images.processed++;
    } catch (e) {
      const reason = e instanceof ImageRejected ? `not a usable image (${e.message})` : (e as Error).message;
      state[ref.id] = { error: reason };
      report.images.failed++;
      warn(`image ${ref.bucket}/${ref.path}: ${reason}`);
    }
    if (done % 25 === 0) {
      saveState(state);
      log(`  ${done}/${refs.size}`);
    }
  }
  saveState(state);
}

// ---------------------------------------------------------------------------
// 3. Data
// ---------------------------------------------------------------------------

const clip = (v: unknown, max: number) => (typeof v === "string" && v.length > max ? v.slice(0, max) : v);
const slugify = (s: string) =>
  s.toLocaleLowerCase("tr").replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
    .replace(/ö/g, "o").replace(/ç/g, "c").normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

type ColumnInfo = { name: string; type: string };

async function targetColumns(tx: Sql, schema: string, table: string): Promise<ColumnInfo[]> {
  return tx<ColumnInfo[]>`
    select column_name as name, data_type as type from information_schema.columns
    where table_schema = ${schema} and table_name = ${table}
      and is_generated = 'NEVER' and (identity_generation is null or identity_generation = 'BY DEFAULT')
    order by ordinal_position`;
}

const droppedNoted = new Set<string>();

/** Inserts rows (already transformed to target column names) in batches. */
async function insertRows(tx: postgres.TransactionSql, schema: string, table: string, rows: Row[], sourceCount = rows.length) {
  const label = `${schema}.${table}`;
  const entry = (report.tables[label] ??= { source: 0, imported: 0, skipped: 0 });
  entry.source += sourceCount;
  entry.skipped += sourceCount - rows.length;
  if (rows.length === 0) return;
  const cols = await targetColumns(tx, schema, table);
  const known = new Map(cols.map((c) => [c.name, c.type]));
  const used = [...new Set(rows.flatMap((r) => Object.keys(r)))].filter((c) => {
    if (known.has(c)) return true;
    if (!droppedNoted.has(`${label}.${c}`)) {
      droppedNoted.add(`${label}.${c}`);
      log(`  ${label}: source column "${c}" has no target column (dropped)`);
    }
    return false;
  });
  const prepared = rows.map((r) => {
    const o: Row = {};
    for (const c of used) {
      const v = r[c];
      o[c] = v !== null && v !== undefined && (known.get(c) === "jsonb" || known.get(c) === "json") ? tx.json(v as never) : v ?? null;
    }
    return o;
  });
  for (let i = 0; i < prepared.length; i += BATCH) {
    const chunk = prepared.slice(i, i + BATCH);
    try {
      await tx.savepoint((sp) => sp`insert into ${sp(schema)}.${sp(table)} ${sp(chunk as never, used)}`);
    } catch {
      // Find the exact row the new schema refuses, then stop.
      for (const row of chunk) {
        try {
          await tx.savepoint((sp) => sp`insert into ${sp(schema)}.${sp(table)} ${sp([row] as never, used)}`);
        } catch (e) {
          const id = (row.id ?? row.user_id ?? "?") as string;
          throw new Error(`${label} row ${id}: ${(e as Error).message}`);
        }
      }
    }
  }
  entry.imported += rows.length;
  log(`  ${label}: ${rows.length}${sourceCount !== rows.length ? ` of ${sourceCount}` : ""}`);
}

async function importData(snap: Snapshot, state: State) {
  const target = postgres(TARGET_URL, { max: 1, prepare: false, idle_timeout: 5, onnotice: () => {} });
  const ROLLBACK = Symbol("dry-run");
  try {
    await target.begin(async (tx) => {
      // --- preflight --------------------------------------------------------
      const [{ superuser }] = await tx<{ superuser: boolean }[]>`select rolsuper as superuser from pg_roles where rolname = current_user`;
      if (!superuser) throw new Error("TARGET_DATABASE_URL must connect as the postgres superuser");
      const migrations = await tx<{ name: string }[]>`select name from public.schema_migrations`;
      if (migrations.length === 0) throw new Error("target is not migrated; run the migrate service first");
      const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from auth.users`;
      if (n > 0) throw new Error(`target already has ${n} accounts; import only into a fresh database`);
      await tx`set local session_replication_role = replica`;
      await tx`set local statement_timeout = 0`;

      // --- categories ------------------------------------------------------
      // Keep the new taxonomy. Old categories map by slug; admin-added ones
      // that the new tree lacks are added (top level) with their old id.
      const existing = await tx<{ id: number; slug: string }[]>`select id, slug from public.categories`;
      const bySlug = new Map(existing.map((c) => [c.slug, c.id]));
      const ids = new Set(existing.map((c) => c.id));
      const categoryMap = new Map<number, number>();
      const newCategories: Row[] = [];
      for (const c of snap.categories) {
        const id = Number(c.id);
        const slug = typeof c.slug === "string" && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(c.slug) ? c.slug : slugify(String(c.slug ?? c.name));
        const match = bySlug.get(slug);
        if (match !== undefined) {
          categoryMap.set(id, match);
          if (match !== id) warn(`category ${id} (${slug}) mapped to existing id ${match}`);
          continue;
        }
        let newId = id;
        if (ids.has(newId)) {
          [{ newId }] = await tx<{ newId: number }[]>`select nextval('public.categories_id_seq')::int as "newId"`;
          warn(`category ${id} (${slug}) id is taken; imported as ${newId}`);
        }
        ids.add(newId);
        bySlug.set(slug, newId);
        categoryMap.set(id, newId);
        const name = String(c.name ?? slug).trim();
        newCategories.push({
          id: newId, slug, name: name.length >= 2 ? clip(name, 60) : slug,
          icon: clip(c.icon ?? "tag", 40), sort_order: c.sort_order ?? 0, created_at: c.created_at, parent_id: null,
        });
      }
      await insertRows(tx, "public", "categories", newCategories, newCategories.length);

      // --- accounts --------------------------------------------------------
      const seenEmails = new Set<string>();
      const users = snap.users.map((u) => {
        let email = typeof u.email === "string" ? u.email.trim().toLowerCase() : "";
        let hash = typeof u.encrypted_password === "string" && /^\$2[aby]\$\d\d\$/.test(u.encrypted_password) ? u.encrypted_password : null;
        if (!email || seenEmails.has(email)) {
          warn(`user ${u.id}: ${email ? "duplicate" : "no"} e-mail; imported with a placeholder address and no password`);
          email = `${u.id}@imported.invalid`;
          hash = null;
        }
        if (u.deleted_at) {
          warn(`user ${u.id}: soft-deleted in Supabase; imported without a password`);
          hash = null;
        }
        seenEmails.add(email);
        return {
          id: u.id, email, email_verified_at: u.email_confirmed_at ?? null, password_hash: hash,
          last_sign_in_at: u.last_sign_in_at ?? null, created_at: u.created_at, updated_at: u.updated_at ?? u.created_at,
        };
      });
      await insertRows(tx, "auth", "users", users);
      const userIds = new Set(users.map((u) => u.id as string));
      const identities = snap.identities
        .filter((i) => userIds.has(i.user_id as string))
        .map((i) => ({
          user_id: i.user_id, provider: "google", provider_user_id: String(i.provider_id),
          email: typeof i.email === "string" ? i.email.toLowerCase() : null, created_at: i.created_at,
        }));
      await insertRows(tx, "auth", "identities", identities, snap.identities.length);

      // --- uploads ---------------------------------------------------------
      const uploads: Row[] = [];
      const imageFor = (bucket: string, value: unknown, owner: unknown, createdAt: unknown) => {
        const entry = state[`${bucket}:${value}`];
        if (!entry || !("key" in entry)) return null;
        uploads.push({
          id: randomUUID(), owner_id: owner ?? null, kind: bucket === "avatars" ? "avatar" : "listing", key: entry.key,
          width: entry.width, height: entry.height, bytes: entry.bytes, attached_at: createdAt ?? new Date(), created_at: createdAt ?? new Date(),
        });
        return entry;
      };

      // --- public tables ---------------------------------------------------
      const regions = new Set((await tx<{ name: string }[]>`select name from public.regions`).map((r) => r.name));
      const sellerOf = new Map((snap.tables.get("listings") ?? []).map((l) => [l.id as string, l.seller_id]));

      const transform: Record<string, (r: Row) => Row | null> = {
        profiles: (r) => {
          let avatar = r.avatar_url as string | null;
          if (avatar && !GOOGLE_AVATAR.test(avatar)) {
            const img = imageFor("avatars", avatar, r.id, r.updated_at ?? r.created_at);
            if (!img) warn(`profile ${r.id}: avatar could not be imported; cleared`);
            avatar = img ? (img as { key: string }).key : null;
          }
          const name = String(r.display_name ?? "").trim();
          return {
            ...r, avatar_url: avatar,
            display_name: name.length >= 2 ? clip(name, 40) : "Kullanıcı",
            region: typeof r.region === "string" && regions.has(r.region) ? r.region : null,
            settings: r.settings ?? {},
          };
        },
        // The e-mail address lives in auth.users only now.
        profile_private: (r) => {
          const { email, ...rest } = r;
          void email;
          return rest;
        },
        listings: ({ details, ...r }) => {
          const category = categoryMap.get(Number(r.category_id));
          if (category === undefined) throw new Error(`listing ${r.id}: unknown category ${r.category_id}`);
          return {
            ...r, category_id: category,
            attributes: details && typeof details === "object" ? details : {},
            reject_reason: clip(r.reject_reason, 500),
          };
        },
        listing_images: (r) => {
          const img = imageFor("listing-images", r.path, sellerOf.get(r.listing_id as string), r.created_at);
          if (!img) return null; // reported during the image phase
          const { key, width, height } = img as { key: string; width: number; height: number };
          return { ...r, path: key, width, height };
        },
        reports: (r) => ({ ...r, resolution_note: clip(r.resolution_note, 1000) }),
        sanctions: (r) => {
          let reason = String(r.reason ?? "").trim();
          if (reason.length < 5) reason = `${reason || "Belirtilmedi"} (eski kayıt)`;
          return { ...r, reason: clip(reason, 500) };
        },
        announcements: (r) => ({
          ...r,
          title: clip(String(r.title ?? "").trim() || "Duyuru", 120),
          body: clip(String(r.body ?? "").trim() || "-", 2000),
        }),
      };

      for (const table of PUBLIC_TABLES) {
        const rows = snap.tables.get(table) ?? [];
        const fn = transform[table];
        const out = fn ? rows.map(fn).filter((r): r is Row => r !== null) : rows;
        if (table === "listings") { const u = uploads.splice(0); await insertRows(tx, "public", "uploads", u, u.length); } // avatars
        await insertRows(tx, "public", table, out, rows.length);
        if (table === "listing_images") { const u = uploads.splice(0); await insertRows(tx, "public", "uploads", u, u.length); }
      }

      // --- sequences -------------------------------------------------------
      await tx`select setval('public.listing_ref_seq', greatest((select coalesce(max(ref_no), 0) from public.listings), (select last_value from public.listing_ref_seq)))`;
      await tx`select setval('public.categories_id_seq', greatest((select max(id) from public.categories), (select last_value from public.categories_id_seq)))`;

      // --- integrity -------------------------------------------------------
      await tx`set local session_replication_role = origin`;
      const fks = await tx<{ name: string; child: string; parent: string; childCols: string[]; parentCols: string[] }[]>`
        select c.conname as name, c.conrelid::regclass::text as child, c.confrelid::regclass::text as parent,
          (select array_agg(a.attname order by k.i) from unnest(c.conkey) with ordinality k(n, i) join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.n) as "childCols",
          (select array_agg(a.attname order by k.i) from unnest(c.confkey) with ordinality k(n, i) join pg_attribute a on a.attrelid = c.confrelid and a.attnum = k.n) as "parentCols"
        from pg_constraint c join pg_namespace n on n.oid = c.connamespace
        where c.contype = 'f' and n.nspname in ('public', 'auth')`;
      const broken: string[] = [];
      for (const fk of fks) {
        const notNull = fk.childCols.map((c) => `c.${quoteIdent(c)} is not null`).join(" and ");
        const join = fk.childCols.map((c, i) => `p.${quoteIdent(fk.parentCols[i])} = c.${quoteIdent(c)}`).join(" and ");
        const [{ n: bad }] = await tx.unsafe<{ n: number }[]>(
          `select count(*)::int as n from ${fk.child} c where ${notNull} and not exists (select 1 from ${fk.parent} p where ${join})`,
        );
        if (bad > 0) broken.push(`${fk.child}.${fk.childCols.join(",")} → ${fk.parent} (${fk.name}): ${bad} rows`);
      }
      if (broken.length) throw new Error(`foreign key check failed:\n  ${broken.join("\n  ")}`);
      log(`foreign keys: ${fks.length} checked, all hold`);

      if (DRY_RUN) throw ROLLBACK;
    });
  } catch (e) {
    if (e !== ROLLBACK) throw e;
    log("dry run: rolled back");
  } finally {
    await target.end();
  }
}

function quoteIdent(name: string) {
  return `"${name.replace(/"/g, '""')}"`;
}

// ---------------------------------------------------------------------------

const t0 = Date.now();
log(`reading source snapshot…`);
const snapshot = await readSource();
log(`  ${snapshot.users.length} accounts, ${snapshot.tables.get("listings")?.length ?? 0} listings, ${snapshot.tables.get("messages")?.length ?? 0} messages`);
const state = loadState();
await importImages(snapshot, state);
if (!IMAGES_ONLY) {
  log(`importing data${DRY_RUN ? " (dry run)" : ""}…`);
  await importData(snapshot, state);
}
const summary = {
  ...report,
  finishedAt: new Date().toISOString(),
  seconds: Math.round((Date.now() - t0) / 1000),
  sourceFingerprint: createHash("sha256").update(JSON.stringify(Object.fromEntries([...snapshot.tables].map(([k, v]) => [k, v.length])))).digest("hex").slice(0, 16),
};
if (REPORT_FILE) writeFileSync(REPORT_FILE, JSON.stringify(summary, null, 2));
log(`done in ${summary.seconds}s: ${report.images.processed} images processed, ${report.images.reused} reused, ${report.images.failed} failed; ${report.warnings.length} warnings`);
