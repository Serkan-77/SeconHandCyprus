// Independent check of a finished Supabase import. Read only on both sides.
//
//   SOURCE_DATABASE_URL, TARGET_DATABASE_URL, UPLOAD_DIR, IMPORT_STATE
//   tsx scripts/supabase-verify.ts
//
// Checks
//   * every source row exists in the target, by primary key, per table
//     (listing photos may be missing only where the import recorded a failed
//     image; rate-limit events are not carried over)
//   * message bodies, listing texts and prices are identical (compared by
//     hash, never printed)
//   * password hashes and e-mail confirmation carried over
//   * every listing photo and uploaded avatar has an uploads row and its
//     WebP files on disk
//   * sequences are ahead of the imported values
// Exit code 1 on any mismatch.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";

const need = (n: string) => process.env[n] ?? (() => { throw new Error(`${n} is required`); })();
const src = postgres(need("SOURCE_DATABASE_URL"), { max: 1, prepare: false, idle_timeout: 5 });
const dst = postgres(need("TARGET_DATABASE_URL"), { max: 1, prepare: false, idle_timeout: 5 });
const UPLOAD_DIR = need("UPLOAD_DIR");
const state: Record<string, { key?: string; error?: string }> = JSON.parse(
  readFileSync(process.env.IMPORT_STATE ?? "./supabase-import-state.json", "utf8"),
);

const failures: string[] = [];
const fail = (m: string) => { failures.push(m); console.log(`  ✗ ${m}`); };
const ok = (m: string) => console.log(`  ✓ ${m}`);
const digest = (rows: unknown[]) => createHash("sha256").update(JSON.stringify(rows)).digest("hex");

async function keys(sql: postgres.Sql, table: string, key: string) {
  return new Set((await sql.unsafe(`select ${key}::text as k from ${table}`)).map((r) => r.k as string));
}

async function compareKeys(table: string, key: string, allowedMissing = new Set<string>()) {
  const a = await keys(src, table, key);
  const b = await keys(dst, table, key);
  const missing = [...a].filter((k) => !b.has(k) && !allowedMissing.has(k));
  const extra = [...b].filter((k) => !a.has(k));
  if (missing.length) fail(`${table}: ${missing.length} source rows missing (e.g. ${missing.slice(0, 3).join(", ")})`);
  else ok(`${table}: ${a.size - allowedMissing.size} rows present${allowedMissing.size ? ` (${allowedMissing.size} dropped: failed images)` : ""}`);
  if (extra.length && table !== "public.categories") fail(`${table}: ${extra.length} rows not in source`);
}

console.log("rows");
const failedImageRows = new Set(
  (await src`select id::text, path from public.listing_images`)
    .filter((r) => !state[`listing-images:${r.path}`]?.key)
    .map((r) => r.id as string),
);
await compareKeys("auth.users", "id");
for (const t of ["profiles", "profile_private", "listings", "conversations", "messages", "ratings", "reports",
  "sanctions", "verification_requests", "notifications", "announcements", "support_tickets"]) {
  await compareKeys(`public.${t}`, "id");
}
await compareKeys("public.listing_images", "id", failedImageRows);
await compareKeys("public.favorites", "user_id::text || ':' || listing_id");
await compareKeys("public.blocks", "blocker_id::text || ':' || blocked_id");
const googleSrc = await src`select provider_id from auth.identities where provider = 'google' order by 1`;
const googleDst = await dst`select provider_user_id as provider_id from auth.identities where provider = 'google' order by 1`;
if (digest(googleSrc) === digest(googleDst)) ok(`auth.identities: ${googleSrc.length} Google links`);
else fail("auth.identities: Google links differ");

console.log("content");
const same = async (label: string, a: postgres.PendingQuery<postgres.Row[]>, b: postgres.PendingQuery<postgres.Row[]>) => {
  const [x, y] = await Promise.all([a, b]);
  if (digest(x) === digest(y)) ok(`${label} identical (${x.length})`);
  else fail(`${label} differ`);
};
await same("message bodies and timestamps",
  src`select id, conversation_id, sender_id, body, read_at, created_at from public.messages order by id`,
  dst`select id, conversation_id, sender_id, body, read_at, created_at from public.messages order by id`);
await same("listing texts, prices, statuses, timestamps",
  src`select id, ref_no, slug, seller_id, title, description, price::text, currency, city, status, featured, view_count, created_at, published_at, details as attrs from public.listings order by id`,
  dst`select id, ref_no, slug, seller_id, title, description, price::text, currency, city, status, featured, view_count, created_at, published_at, attributes as attrs from public.listings order by id`);
await same("meeting confirmations",
  src`select id, buyer_id, seller_id, listing_id, buyer_confirmed_at, seller_confirmed_at, meeting_confirmed_at from public.conversations order by id`,
  dst`select id, buyer_id, seller_id, listing_id, buyer_confirmed_at, seller_confirmed_at, meeting_confirmed_at from public.conversations order by id`);
await same("ratings",
  src`select id, rater_id, ratee_id, conversation_id, score, comment from public.ratings order by id`,
  dst`select id, rater_id, ratee_id, conversation_id, score, comment from public.ratings order by id`);
await same("roles, statuses and store flags",
  src`select id, role, status, status_until, phone_verified, account_type, store_name, store_verified from public.profiles order by id`,
  dst`select id, role, status, status_until, phone_verified, account_type, store_name, store_verified from public.profiles order by id`);
await same("password hashes and e-mail confirmation",
  src`select id, case when encrypted_password ~ '^[$]2[aby][$]' and deleted_at is null then encrypted_password end as h, email_confirmed_at as v from auth.users order by id`,
  dst`select id, password_hash as h, email_verified_at as v from auth.users order by id`);
const [srcEmails, dstEmails] = await Promise.all([
  src`select id, lower(btrim(email)) as e from auth.users where email is not null order by id`,
  dst`select id, email::text as e from auth.users where email not like '%@imported.invalid' order by id`,
]);
if (digest(srcEmails) === digest(dstEmails)) ok(`e-mail addresses (${srcEmails.length})`);
else fail("e-mail addresses differ (duplicates or empty addresses are replaced by placeholders; see the import report)");

console.log("files");
const images = await dst`
  select i.id, i.path, u.key is not null as has_upload from public.listing_images i left join public.uploads u on u.key = i.path`;
const avatars = await dst`
  select p.id, p.avatar_url as path, u.key is not null as has_upload from public.profiles p left join public.uploads u on u.key = p.avatar_url
  where p.avatar_url is not null and p.avatar_url !~ '^https://'`;
let missingFiles = 0;
for (const img of [...images, ...avatars]) {
  if (!img.has_upload) fail(`image ${img.id}: no uploads row for ${img.path}`);
  const variants = String(img.path).startsWith("a/") ? ["sm", "md"] : ["sm", "md", "lg"];
  for (const v of variants) if (!existsSync(path.join(UPLOAD_DIR, String(img.path), `${v}.webp`))) missingFiles++;
}
if (missingFiles) fail(`${missingFiles} image files missing on disk`);
else ok(`${images.length} listing photos and ${avatars.length} avatars on disk`);

console.log("sequences");
const [seq] = await dst`
  select (select last_value from public.listing_ref_seq) >= (select coalesce(max(ref_no), 0) from public.listings) as ref_ok,
         (select last_value from public.categories_id_seq) >= (select max(id) from public.categories) as cat_ok`;
if (seq.ref_ok && seq.cat_ok) ok("listing_ref_seq and categories_id_seq ahead of data");
else fail("a sequence is behind imported data");

await Promise.all([src.end(), dst.end()]);
console.log(failures.length ? `\nFAILED: ${failures.length} problem(s)` : "\nOK: import verified");
process.exit(failures.length ? 1 : 0);
