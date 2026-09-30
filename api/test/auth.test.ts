// Authentication: sign-up, verification, sign-in, sessions, refresh
// rotation and reuse detection, password reset, CSRF, rate limits,
// enumeration resistance and the Supabase bcrypt import path.
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { Client, anon, lastLinkToken, newUser, resetDatabase, startApp, type TestApp } from "./helpers.ts";

let t: TestApp;
before(async () => {
  await resetDatabase();
  t = await startApp();
});
after(async () => t?.close());

const PASSWORD = "Guclu-Sifre-2026";

describe("sign-up and verification", () => {
  test("new account must verify its e-mail before signing in", async () => {
    const c = anon(t.app);
    const email = "verifyme@example.test";
    const r = await c.post("/api/v1/auth/signup", { email, password: PASSWORD, name: "Ayşe" });
    assert.equal(r.statusCode, 200);
    const login = await c.post("/api/v1/auth/login", { email, password: PASSWORD });
    assert.equal(login.statusCode, 403);
    assert.equal(login.data.error.code, "email_not_verified");
    const token = lastLinkToken(t, email, "/eposta-dogrula");
    const v = await c.post("/api/v1/auth/verify-email", { token });
    assert.equal(v.statusCode, 200);
    assert.ok(c.cookies.kie_at && c.cookies.kie_rt, "verification signs in with cookies");
    assert.ok(!("accessToken" in v.data), "web responses never contain tokens");
    const again = await anon(t.app).post("/api/v1/auth/verify-email", { token });
    assert.equal(again.statusCode, 400, "verification links work once");
  });

  test("sign-up with a registered address answers the same and e-mails the owner", async () => {
    const u = await newUser(t);
    const before = t.app.deps.mailer.outbox.length;
    const r = await anon(t.app).post("/api/v1/auth/signup", { email: u.email, password: "Baska-Sifre-99", name: "Saldırgan" });
    assert.equal(r.statusCode, 200);
    assert.deepEqual(r.data, { ok: true, verificationSent: true });
    const mail = t.app.deps.mailer.outbox.slice(before).find((m) => m.to === u.email);
    assert.ok(mail && /zaten/i.test(mail.subject));
    // The existing password still works; the attempt changed nothing.
    const login = await anon(t.app).post("/api/v1/auth/login", { email: u.email, password: PASSWORD });
    assert.equal(login.statusCode, 200);
  });

  test("weak and short passwords are refused", async () => {
    const c = anon(t.app);
    assert.equal((await c.post("/api/v1/auth/signup", { email: "w1@example.test", password: "1234567", name: "Ali" })).statusCode, 422);
    assert.equal((await c.post("/api/v1/auth/signup", { email: "w2@example.test", password: "12345678", name: "Ali" })).statusCode, 422);
  });

  test("passwords are stored as Argon2id", async () => {
    const u = await newUser(t);
    const [row] = await t.owner<{ passwordHash: string }[]>`select password_hash from auth.users where id = ${u.id}`;
    assert.match(row.passwordHash, /^\$argon2id\$/);
  });
});

describe("sign-in", () => {
  test("wrong password and unknown e-mail get the same answer", async () => {
    const u = await newUser(t);
    const a = await anon(t.app).post("/api/v1/auth/login", { email: u.email, password: "wrong-password" });
    const b = await anon(t.app).post("/api/v1/auth/login", { email: "nobody@example.test", password: "wrong-password" });
    assert.equal(a.statusCode, 401);
    assert.equal(b.statusCode, 401);
    assert.deepEqual(a.data, b.data);
  });

  test("repeated failures for one account are rate limited", async () => {
    const u = await newUser(t);
    let last = 0;
    for (let i = 0; i < 9; i++) last = (await anon(t.app).post("/api/v1/auth/login", { email: u.email, password: `nope-${i}-xx` })).statusCode;
    assert.equal(last, 429);
    const correct = await anon(t.app).post("/api/v1/auth/login", { email: u.email, password: PASSWORD });
    assert.equal(correct.statusCode, 429, "even the right password waits out the lock");
  });

  test("a Supabase bcrypt hash signs in and is upgraded to Argon2id", async () => {
    const [user] = await t.owner<{ id: string }[]>`
      insert into auth.users (email, password_hash, email_verified_at)
      values ('legacy@example.test', ${await bcrypt.hash("Eski-Sifre-2025", 10)}, now()) returning id`;
    await t.owner`insert into profiles (id, display_name) values (${user.id}, 'Eski Üye')`;
    await t.owner`insert into profile_private (id) values (${user.id})`;
    const res = await anon(t.app).post("/api/v1/auth/login", { email: "legacy@example.test", password: "Eski-Sifre-2025" });
    assert.equal(res.statusCode, 200);
    const [row] = await t.owner<{ passwordHash: string }[]>`select password_hash from auth.users where id = ${user.id}`;
    assert.match(row.passwordHash, /^\$argon2id\$/);
  });
});

describe("sessions", () => {
  test("refresh rotates the token; replaying an old one revokes the session", async () => {
    const u = await newUser(t);
    const firstRefresh = u.cookies.kie_rt;
    const r1 = await u.post("/api/v1/auth/refresh");
    assert.equal(r1.statusCode, 200);
    assert.notEqual(u.cookies.kie_rt, firstRefresh);
    // Move the used token out of the grace window, then replay it.
    await t.owner`update auth.refresh_tokens set used_at = now() - interval '5 minutes' where used_at is not null`;
    const thief = new Client(t.app);
    thief.cookies.kie_rt = firstRefresh;
    const replay = await thief.post("/api/v1/auth/refresh");
    assert.equal(replay.statusCode, 401);
    // The legitimate holder is signed out too: the session is burned.
    const me = await u.get("/api/v1/auth/me");
    assert.equal(me.statusCode, 401);
    const r2 = await u.post("/api/v1/auth/refresh");
    assert.equal(r2.statusCode, 401);
  });

  test("sign-out ends the session immediately, even with a still-valid access token", async () => {
    const u = await newUser(t);
    const token = u.cookies.kie_at;
    assert.equal((await u.post("/api/v1/auth/logout")).statusCode, 200);
    const stale = new Client(t.app);
    stale.cookies.kie_at = token;
    assert.equal((await stale.get("/api/v1/auth/me")).statusCode, 401);
  });

  test("sign out everywhere ends every session", async () => {
    const u = await newUser(t);
    const other = new Client(t.app);
    const login = await other.post("/api/v1/auth/login", { email: u.email, password: PASSWORD });
    assert.equal(login.statusCode, 200);
    assert.equal((await u.post("/api/v1/auth/logout-all")).statusCode, 200);
    assert.equal((await other.get("/api/v1/auth/me")).statusCode, 401);
  });

  test("mobile clients get tokens in the body and use Bearer", async () => {
    const u = await newUser(t);
    const m = new Client(t.app);
    const login = await m.post("/api/v1/auth/login", { email: u.email, password: PASSWORD, client: "mobile" });
    assert.equal(login.statusCode, 200);
    assert.ok(login.data.accessToken && login.data.refreshToken);
    assert.equal(Object.keys(m.cookies).length, 0, "no cookies for mobile");
    m.bearer = login.data.accessToken;
    assert.equal((await m.get("/api/v1/auth/me")).statusCode, 200);
    const refreshed = await anon(t.app).post("/api/v1/auth/refresh", { client: "mobile", refreshToken: login.data.refreshToken });
    assert.equal(refreshed.statusCode, 200);
    assert.notEqual(refreshed.data.refreshToken, login.data.refreshToken);
  });

  test("a forged or foreign-signed token is rejected", async () => {
    const c = new Client(t.app);
    c.bearer = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4Iiwic2lkIjoieSJ9.invalid";
    assert.equal((await c.get("/api/v1/auth/me")).statusCode, 401);
  });
});

describe("password reset", () => {
  test("reset works once, signs out other sessions and does not reveal accounts", async () => {
    const u = await newUser(t);
    const unknown = await anon(t.app).post("/api/v1/auth/password-reset", { email: "ghost@example.test" });
    const known = await anon(t.app).post("/api/v1/auth/password-reset", { email: u.email });
    assert.equal(unknown.statusCode, 200);
    assert.deepEqual(unknown.data, known.data);
    const token = lastLinkToken(t, u.email, "/yeni-sifre");
    const c = anon(t.app);
    const done = await c.post("/api/v1/auth/password-reset/confirm", { token, password: "Yeni-Sifre-2026!" });
    assert.equal(done.statusCode, 200);
    assert.equal((await u.get("/api/v1/auth/me")).statusCode, 401, "old sessions are revoked");
    const reuse = await anon(t.app).post("/api/v1/auth/password-reset/confirm", { token, password: "Baska-Sifre-2026!" });
    assert.equal(reuse.statusCode, 400);
    assert.equal((await anon(t.app).post("/api/v1/auth/login", { email: u.email, password: "Yeni-Sifre-2026!" })).statusCode, 200);
  });

  test("changing the password needs the current one", async () => {
    const u = await newUser(t);
    const bad = await u.post("/api/v1/auth/password", { current: "wrong", password: "Yepyeni-Sifre-1" });
    assert.equal(bad.statusCode, 403);
    const ok = await u.post("/api/v1/auth/password", { current: PASSWORD, password: "Yepyeni-Sifre-1" });
    assert.equal(ok.statusCode, 200);
  });
});

describe("CSRF", () => {
  test("cookie requests without the CSRF header are refused", async () => {
    const u = await newUser(t);
    const res = await t.app.inject({
      method: "POST",
      url: "/api/v1/auth/logout-all",
      headers: { cookie: `kie_at=${u.cookies.kie_at}` },
    });
    assert.equal(res.statusCode, 403);
    assert.equal((await u.get("/api/v1/auth/me")).statusCode, 200, "nothing happened");
  });

  test("requests from a foreign origin are refused", async () => {
    const u = await newUser(t);
    const res = await u.post("/api/v1/auth/logout-all", {}, { origin: "https://evil.example" });
    assert.equal(res.statusCode, 403);
  });

  test("login CSRF is covered too", async () => {
    const res = await t.app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email: "a@b.cd", password: "x" } });
    assert.equal(res.statusCode, 403);
  });
});

describe("responses", () => {
  test("errors never leak internals", async () => {
    const res = await anon(t.app).get("/api/v1/listings/00000000-0000-0000-0000-000000000000/related");
    assert.equal(res.statusCode, 404);
    assert.deepEqual(Object.keys(res.data), ["error"]);
    const bad = await anon(t.app).get("/api/v1/users/not-a-uuid");
    assert.equal(bad.statusCode, 400);
    assert.ok(!/postgres|sql|stack|at /i.test(bad.body));
  });

  test("API responses are not cacheable and carry a request id", async () => {
    const res = await anon(t.app).get("/api/v1/listings");
    assert.equal(res.headers["cache-control"], "no-store");
    assert.ok(res.headers["x-request-id"]);
  });
});
