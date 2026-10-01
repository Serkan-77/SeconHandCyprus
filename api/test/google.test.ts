// Google sign-in against a local fake Google (JWKS + token endpoint) that
// signs ID tokens with its own RSA key and enforces PKCE like the real one.
import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { SignJWT, exportJWK, generateKeyPair, type JWK } from "jose";
import { Client, SITE, anon, lastLinkToken, newUser, resetDatabase, startApp, type TestApp } from "./helpers.ts";

const CLIENT_ID = "test-client.apps.googleusercontent.com";
const CLIENT_SECRET = "test-google-secret";

type Grant = { claims: Record<string, unknown>; challenge: string; key?: CryptoKey; aud?: string };

let t: TestApp;
let server: Server;
let base = "";
let signingKey: CryptoKey;
let publicJwk: JWK;
let issuer = "";
const grants = new Map<string, Grant>();

async function fakeGoogle() {
  const pair = await generateKeyPair("RS256", { extractable: true });
  signingKey = pair.privateKey as CryptoKey;
  publicJwk = { ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "RS256", use: "sig" };
  server = createServer(async (req, res) => {
    if (req.url === "/certs") {
      res.setHeader("content-type", "application/json");
      return res.end(JSON.stringify({ keys: [publicJwk] }));
    }
    if (req.url === "/token" && req.method === "POST") {
      let raw = "";
      for await (const chunk of req) raw += chunk;
      const form = new URLSearchParams(raw);
      const grant = grants.get(form.get("code") ?? "");
      const pkceOk = grant && createHash("sha256").update(form.get("code_verifier") ?? "").digest("base64url") === grant.challenge;
      if (!grant || !pkceOk || form.get("client_secret") !== CLIENT_SECRET || form.get("client_id") !== CLIENT_ID) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: "invalid_grant" }));
      }
      grants.delete(form.get("code")!);
      const idToken = await new SignJWT(grant.claims)
        .setProtectedHeader({ alg: "RS256", kid: "k1" })
        .setIssuer(issuer)
        .setAudience(grant.aud ?? CLIENT_ID)
        .setIssuedAt()
        .setExpirationTime("5m")
        .sign(grant.key ?? signingKey);
      res.setHeader("content-type", "application/json");
      return res.end(JSON.stringify({ id_token: idToken, access_token: "unused" }));
    }
    res.statusCode = 404;
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  issuer = base;
}

before(async () => {
  await resetDatabase();
  await fakeGoogle();
  t = await startApp({
    GOOGLE_CLIENT_ID: CLIENT_ID,
    GOOGLE_CLIENT_SECRET: CLIENT_SECRET,
    GOOGLE_AUTH_URL: `${base}/auth`,
    GOOGLE_TOKEN_URL: `${base}/token`,
    GOOGLE_JWKS_URL: `${base}/certs`,
    GOOGLE_ISSUER: base,
  });
});
after(async () => {
  await t.close();
  server.close();
});

/** Runs /start, plays Google with the given claims, returns the callback response. */
async function signIn(c: Client, claims: Record<string, unknown>, opts: { returnTo?: string; tamper?: (p: URLSearchParams, g: Grant) => void } = {}) {
  const start = await c.get(`/api/v1/auth/google/start${opts.returnTo ? `?returnTo=${encodeURIComponent(opts.returnTo)}` : ""}`);
  assert.equal(start.statusCode, 302);
  const to = new URL(start.headers.location as string);
  assert.equal(to.origin + to.pathname, `${base}/auth`);
  assert.equal(to.searchParams.get("code_challenge_method"), "S256");
  assert.equal(to.searchParams.get("redirect_uri"), `${SITE}/api/v1/auth/google/callback`);
  const code = `code-${Math.random().toString(36).slice(2)}`;
  const grant: Grant = { claims: { nonce: to.searchParams.get("nonce"), ...claims }, challenge: to.searchParams.get("code_challenge")! };
  const params = new URLSearchParams({ code, state: to.searchParams.get("state")! });
  opts.tamper?.(params, grant);
  grants.set(code, grant);
  return c.get(`/api/v1/auth/google/callback?${params}`);
}

const googleUser = (n: number, extra: Record<string, unknown> = {}) => ({
  sub: `10000000000000000${n}`,
  email: `g${n}@gmail.test`,
  email_verified: true,
  name: "Google Kişi",
  picture: "https://lh3.googleusercontent.com/a/photo123",
  ...extra,
});

const failed = (res: { statusCode: number; headers: Record<string, unknown> }) =>
  res.statusCode === 302 && res.headers.location === `${SITE}/giris?hata=google`;

describe("google sign-in", () => {
  test("first sign-in creates a verified account and signs in", async () => {
    const c = anon(t.app);
    const res = await signIn(c, googleUser(1), { returnTo: "/hesabim" });
    assert.equal(res.statusCode, 302);
    assert.equal(res.headers.location, `${SITE}/hesabim`);
    assert.ok(c.cookies.kie_at && c.cookies.kie_rt, "session cookies set");
    assert.equal(c.cookies.kie_g, undefined, "state cookie cleared");
    const me = await c.get("/api/v1/auth/me");
    assert.equal(me.statusCode, 200);
    const [u] = await t.owner`select u.email, u.email_verified_at, u.password_hash, p.display_name, p.avatar_url
      from auth.users u join profiles p on p.id = u.id where u.id = ${me.data.id}`;
    assert.equal(u.email, "g1@gmail.test");
    assert.ok(u.emailVerifiedAt);
    assert.equal(u.passwordHash, null);
    assert.equal(u.displayName, "Google Kişi");
    assert.equal(u.avatarUrl, "https://lh3.googleusercontent.com/a/photo123");
  });

  test("the same Google account signs in to the same user", async () => {
    const a = anon(t.app);
    await signIn(a, googleUser(2));
    const first = (await a.get("/api/v1/auth/me")).data.id;
    const b = anon(t.app);
    await signIn(b, googleUser(2, { email: "changed@gmail.test" }));
    assert.equal((await b.get("/api/v1/auth/me")).data.id, first);
    const [{ n }] = await t.owner`select count(*)::int as n from auth.identities where provider_user_id = ${googleUser(2).sub}`;
    assert.equal(n, 1);
  });

  test("links to an existing verified account and keeps its password", async () => {
    const existing = await newUser(t);
    const c = anon(t.app);
    await signIn(c, googleUser(3, { email: existing.email.toUpperCase() }));
    assert.equal((await c.get("/api/v1/auth/me")).data.id, existing.id);
    const login = await anon(t.app).post("/api/v1/auth/login", { email: existing.email, password: "Guclu-Sifre-2026" });
    assert.equal(login.statusCode, 200);
    assert.equal((await existing.get("/api/v1/auth/me")).statusCode, 200, "existing sessions kept");
  });

  test("linking to a never-verified account removes the squatter's password and sessions", async () => {
    const email = "victim@gmail.test";
    const squatter = anon(t.app);
    await squatter.post("/api/v1/auth/signup", { email, password: "Squatter-Sifre-1", name: "Squatter", region: "Girne" });
    const c = anon(t.app);
    await signIn(c, googleUser(4, { email }));
    const me = await c.get("/api/v1/auth/me");
    assert.equal(me.statusCode, 200);
    const [u] = await t.owner`select password_hash, email_verified_at from auth.users where email = ${email}`;
    assert.equal(u.passwordHash, null);
    assert.ok(u.emailVerifiedAt);
    assert.equal((await anon(t.app).post("/api/v1/auth/login", { email, password: "Squatter-Sifre-1" })).statusCode, 401);
    // Links e-mailed for the squatter's registration are void.
    const token = lastLinkToken(t, email, "/eposta-dogrula");
    assert.equal((await anon(t.app).post("/api/v1/auth/verify-email", { token })).statusCode, 400);
  });

  test("returnTo cannot leave the site", async () => {
    for (const evil of ["//evil.example/x", "https://evil.example", "/\\evil.example", "/api/v1/auth/logout"]) {
      const res = await signIn(anon(t.app), googleUser(5), { returnTo: evil });
      assert.equal(res.headers.location, `${SITE}/`, evil);
    }
  });

  test("a wrong state is refused", async () => {
    const c = anon(t.app);
    const res = await signIn(c, googleUser(6), { tamper: (p) => p.set("state", "x".repeat(43)) });
    assert.ok(failed(res));
    assert.equal(c.cookies.kie_at, undefined);
  });

  test("a callback without the state cookie (other browser, CSRF) is refused", async () => {
    const c = anon(t.app);
    const start = await c.get("/api/v1/auth/google/start");
    const to = new URL(start.headers.location as string);
    const code = "code-csrf";
    grants.set(code, { claims: { nonce: to.searchParams.get("nonce"), ...googleUser(7) }, challenge: to.searchParams.get("code_challenge")! });
    const other = anon(t.app);
    const res = await other.get(`/api/v1/auth/google/callback?code=${code}&state=${to.searchParams.get("state")}`);
    assert.ok(failed(res));
    assert.equal(other.cookies.kie_at, undefined);
  });

  test("a wrong nonce, an unverified e-mail, a foreign key or audience are refused", async () => {
    const otherKey = (await generateKeyPair("RS256")).privateKey as CryptoKey;
    const cases: [string, Parameters<typeof signIn>[2]["tamper"]][] = [
      ["nonce", (_p, g) => { g.claims.nonce = "other"; }],
      ["email_verified", (_p, g) => { g.claims.email_verified = false; }],
      ["key", (_p, g) => { g.key = otherKey; }],
      ["audience", (_p, g) => { g.aud = "someone-else.apps.googleusercontent.com"; }],
      ["pkce", (_p, g) => { g.challenge = "not-the-challenge"; }],
    ];
    for (const [label, tamper] of cases) {
      const c = anon(t.app);
      const res = await signIn(c, googleUser(8), { tamper });
      assert.ok(failed(res), label);
      assert.equal(c.cookies.kie_at, undefined, label);
    }
    const [{ n }] = await t.owner`select count(*)::int as n from auth.users where email = ${googleUser(8).email}`;
    assert.equal(n, 0);
  });

  test("the user cancelling at Google ends on the sign-in page", async () => {
    const c = anon(t.app);
    await c.get("/api/v1/auth/google/start");
    assert.ok(failed(await c.get("/api/v1/auth/google/callback?error=access_denied")));
  });

  test("non-Google avatar URLs are not stored", async () => {
    const c = anon(t.app);
    await signIn(c, googleUser(9, { picture: "https://evil.example/track.png", name: "x" }));
    const [p] = await t.owner`select display_name, avatar_url from profiles where id = ${(await c.get("/api/v1/auth/me")).data.id}`;
    assert.equal(p.avatarUrl, null);
    assert.equal(p.displayName, "Kullanıcı");
  });
});

describe("google sign-in disabled", () => {
  test("endpoints do not exist without client credentials", async () => {
    const off = await startApp();
    try {
      assert.equal((await anon(off.app).get("/api/v1/auth/google/start")).statusCode, 404);
      assert.equal((await anon(off.app).get("/api/v1/auth/google/callback?code=x&state=y")).statusCode, 404);
    } finally {
      await off.close();
    }
  });
});
