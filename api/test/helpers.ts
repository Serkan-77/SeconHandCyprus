// Test harness: a fresh database (kie_test) built from db/migrations, the
// real app built in-process, and helpers to act as different users.
//
// Needs the development PostgreSQL (docker compose -f docker-compose.dev.yml up -d).
// Connection details can be overridden with TEST_PG_SUPER_URL / TEST_PG_HOST.
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import postgres from "postgres";
import sharp from "sharp";
import { loadConfig } from "../src/config.ts";
import { buildApp } from "../src/app.ts";
import { migrate } from "../src/db/migrate.ts";

const HOST = process.env.TEST_PG_HOST ?? "127.0.0.1:55432";
const SUPER = process.env.TEST_PG_SUPER_URL ?? `postgres://postgres:dev-superuser-password@${HOST}/postgres`;
const DB = "kie_test";
export const OWNER_URL = `postgres://kie_owner:dev-owner-password@${HOST}/${DB}`;
export const APP_URL = `postgres://kie_app:dev-app-password@${HOST}/${DB}`;
export const SITE = "http://localhost:3000";
export const INTERNAL_TOKEN = "internal-token-internal-token-internal-token";

export async function resetDatabase() {
  const su = postgres(SUPER, { max: 1, onnotice: () => {} });
  try {
    await su.unsafe(`drop database if exists ${DB} with (force)`);
    await su.unsafe(`create database ${DB} owner kie_owner template template0 encoding 'UTF8' lc_collate 'C.UTF-8' lc_ctype 'C.UTF-8'`);
    await su.unsafe(`grant connect, temporary on database ${DB} to kie_app`);
  } finally {
    await su.end();
  }
  const db = postgres(SUPER.replace(/\/postgres$/, `/${DB}`), { max: 1, onnotice: () => {} });
  try {
    await db.unsafe(`create extension if not exists pg_trgm; create extension if not exists citext;
      revoke create on schema public from public; alter schema public owner to kie_owner;`);
  } finally {
    await db.end();
  }
  await migrate(OWNER_URL, { log: () => {} });
}

export type TestApp = { app: FastifyInstance; owner: postgres.Sql; close: () => Promise<void> };

export async function startApp(env: Record<string, string> = {}): Promise<TestApp> {
  const uploadDir = await mkdtemp(path.join(tmpdir(), "kie-uploads-"));
  const config = loadConfig({
    NODE_ENV: "test",
    DATABASE_URL: APP_URL,
    SITE_URL: SITE,
    JWT_SECRET: "test-secret-test-secret-test-secret-0123456789",
    MAIL_TRANSPORT: "memory",
    DISABLE_REQUEST_LIMITER: "1",
    UPLOAD_DIR: uploadDir,
    SERVE_MEDIA: "1",
    LOG_LEVEL: "silent",
    INTERNAL_API_TOKEN: INTERNAL_TOKEN,
    ...env,
  });
  const app = await buildApp(config);
  await app.ready();
  const owner = postgres(OWNER_URL, { max: 2, onnotice: () => {}, transform: { column: { from: postgres.toCamel, to: postgres.fromCamel } } });
  return {
    app,
    owner,
    close: async () => {
      await app.close();
      await owner.end();
    },
  };
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

export type Res = LightMyRequestResponse & { body: string; data: any };

function wrap(res: LightMyRequestResponse): Res {
  let data: unknown = null;
  try {
    data = res.json();
  } catch {
    data = null;
  }
  return Object.assign(res, { data }) as Res;
}

let ipCounter = 0;

export class Client {
  cookies: Record<string, string> = {};
  bearer: string | null = null;
  /** Each client gets its own address, passed the way the Next.js server does. */
  ip = `10.${Math.floor(++ipCounter / 250) % 250}.${ipCounter % 250}.${1 + Math.floor(Math.random() * 250)}`;
  constructor(
    public app: FastifyInstance,
    public id = "",
    public email = "",
  ) {}

  private headers(extra: Record<string, string> = {}) {
    const h: Record<string, string> = {
      "x-kie-csrf": "1",
      "x-kie-internal": INTERNAL_TOKEN,
      "x-kie-client-ip": this.ip,
      ...extra,
    };
    const cookie = Object.entries(this.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
    if (cookie) h.cookie = cookie;
    if (this.bearer) h.authorization = `Bearer ${this.bearer}`;
    return h;
  }

  private remember(res: LightMyRequestResponse) {
    for (const c of res.cookies as { name: string; value: string; maxAge?: number }[]) {
      if (c.value === "" || c.maxAge === 0) delete this.cookies[c.name];
      else this.cookies[c.name] = c.value;
    }
  }

  async request(method: string, url: string, body?: unknown, headers: Record<string, string> = {}): Promise<Res> {
    const res = await this.app.inject({
      method: method as "GET",
      url,
      headers: this.headers(headers),
      ...(body === undefined ? {} : { payload: body as object }),
    });
    this.remember(res);
    return wrap(res);
  }

  get(url: string, headers?: Record<string, string>) {
    return this.request("GET", url, undefined, headers);
  }
  post(url: string, body: unknown = {}, headers?: Record<string, string>) {
    return this.request("POST", url, body, headers);
  }
  patch(url: string, body: unknown, headers?: Record<string, string>) {
    return this.request("PATCH", url, body, headers);
  }
  put(url: string, body: unknown = {}, headers?: Record<string, string>) {
    return this.request("PUT", url, body, headers);
  }
  del(url: string, body?: unknown, headers?: Record<string, string>) {
    return this.request("DELETE", url, body, headers);
  }

  async upload(image: Buffer, kind: "listing" | "avatar" = "listing", filename = "photo.jpg", contentType = "image/jpeg") {
    const boundary = "----kietest" + Math.random().toString(16).slice(2);
    const head = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`,
    );
    const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
    const res = await this.app.inject({
      method: "POST",
      url: `/api/v1/uploads?kind=${kind}`,
      headers: this.headers({ "content-type": `multipart/form-data; boundary=${boundary}` }),
      payload: Buffer.concat([head, image, tail]),
    });
    return wrap(res);
  }
}

export function anon(app: FastifyInstance) {
  return new Client(app);
}

let counter = 0;

/** Signs up, verifies the e-mail through the link in the (memory) outbox, and returns a signed-in client. */
export async function newUser(t: TestApp, name = "Test Kullanıcı", opts: { admin?: boolean } = {}) {
  counter += 1;
  const email = `user${Date.now()}${counter}@example.test`;
  const c = new Client(t.app, "", email);
  const signup = await c.post("/api/v1/auth/signup", { email, password: "Guclu-Sifre-2026", name, region: "Girne" });
  if (signup.statusCode !== 200) throw new Error(`signup failed: ${signup.body}`);
  const token = lastLinkToken(t, email, "/eposta-dogrula");
  const verify = await c.post("/api/v1/auth/verify-email", { token });
  if (verify.statusCode !== 200) throw new Error(`verify failed: ${verify.body}`);
  const me = await c.get("/api/v1/auth/me");
  c.id = me.data.id;
  if (opts.admin) await t.owner`update profiles set role = 'admin' where id = ${c.id}`;
  return c;
}

export function lastLinkToken(t: TestApp, email: string, pathPrefix: string) {
  const mails = t.app.deps.mailer.outbox.filter((m) => m.to === email);
  for (let i = mails.length - 1; i >= 0; i--) {
    const m = mails[i].text.match(new RegExp(`${pathPrefix.replace("/", "\\/")}\\?token=([A-Za-z0-9_-]+)`));
    if (m) return m[1];
  }
  throw new Error(`no ${pathPrefix} link for ${email}`);
}

/** A real photo-like JPEG (with EXIF orientation and a GPS tag) for upload tests. */
export async function testJpeg(width = 800, height = 600, color = { r: 200, g: 120, b: 40 }) {
  return sharp({ create: { width, height, channels: 3, background: color } })
    .jpeg({ quality: 80 })
    .withExif({ IFD0: { Make: "TestCam", Model: "Secret Model" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "35/1 20/1 0/1" } })
    .toBuffer();
}

/** Uploads n photos and returns their keys. */
export async function uploadPhotos(c: Client, n = 1) {
  const keys: string[] = [];
  for (let i = 0; i < n; i++) {
    const res = await c.upload(await testJpeg(640 + i, 480));
    if (res.statusCode !== 200) throw new Error(`upload failed: ${res.body}`);
    keys.push(res.data.key);
  }
  return keys;
}

export async function categoryId(t: TestApp, slug: string) {
  const [row] = await t.owner<{ id: number }[]>`select id from categories where slug = ${slug}`;
  return row.id;
}

/** Creates a listing through the API (pending) and optionally approves it as system. */
export async function newListing(
  t: TestApp,
  c: Client,
  overrides: Record<string, unknown> = {},
  { approve = true }: { approve?: boolean } = {},
) {
  const photos = await uploadPhotos(c, 1);
  const res = await c.post("/api/v1/listings", {
    title: "Ahşap berjer koltuk",
    categoryId: await categoryId(t, "koltuk-kanepe"),
    condition: "Az kullanılmış",
    description: "Temiz, sigarasız evden.",
    price: 1500,
    currency: "TL",
    city: "Girne",
    district: "Alsancak",
    negotiable: false,
    submissionKey: crypto.randomUUID(),
    attributes: { sofa_type: "berjer-tekli-koltuk", seats: 1 },
    photos,
    ...overrides,
  });
  if (res.statusCode !== 200) throw new Error(`create listing failed: ${res.body}`);
  const listing = res.data.listing as { id: string; slug: string; status: string };
  if (approve) await t.owner`update listings set status = 'active' where id = ${listing.id}`;
  return listing;
}

/** Runs SQL as the API role with a given caller context: the same path an API bug would take. */
export async function asDbUser<T>(userId: string | null, role: "anon" | "user", fn: (sql: postgres.TransactionSql) => Promise<T>) {
  const sql = postgres(APP_URL, { max: 1, onnotice: () => {}, transform: { column: { from: postgres.toCamel, to: postgres.fromCamel } } });
  try {
    return (await sql.begin(async (tx) => {
      await tx`select set_config('app.user_id', ${userId ?? ""}, true), set_config('app.role', ${role}, true)`;
      return fn(tx);
    })) as T;
  } finally {
    await sql.end();
  }
}
