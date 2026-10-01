// P1-12: fail fast on a missing or invalid public environment in production,
// and never ship a secret in a NEXT_PUBLIC_ variable.
//
//   npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { assertPublicEnv, looksLikeSecretKey, publicEnvProblems } from "../src/lib/envCheck.ts";

const good = { NEXT_PUBLIC_SITE_URL: "https://www.kibrisikincielcim.com" };
const jwt = (payload) => `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify(payload)).replace(/=+$/, "")}.sig`;

test("a complete production environment passes", () => {
  assert.deepEqual(publicEnvProblems(good), []);
  assert.doesNotThrow(() => assertPublicEnv(good, true));
  assert.doesNotThrow(() => assertPublicEnv({ NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }, true));
  assert.doesNotThrow(() => assertPublicEnv({ ...good, NEXT_PUBLIC_WS_URL: "wss://www.kibrisikincielcim.com/api/v1/ws" }, true));
});

test("production refuses missing or malformed values", () => {
  const cases = [
    [{ NEXT_PUBLIC_SITE_URL: undefined }, /SITE_URL tanımlı değil/],
    [{ NEXT_PUBLIC_SITE_URL: "kibrisikincielcim.com" }, /http\(s\) adresi değil/],
    [{ NEXT_PUBLIC_SITE_URL: "ftp://kibrisikincielcim.com" }, /http\(s\) adresi değil/],
    [{ NEXT_PUBLIC_SITE_URL: "http://kibrisikincielcim.com" }, /https olmalı/],
    [{ NEXT_PUBLIC_SITE_URL: "https://kibrisikincielcim.com/tr" }, /yalnızca origin/],
    [{ ...good, NEXT_PUBLIC_WS_URL: "https://x.example" }, /ws\(s\) adresi değil/],
  ];
  for (const [env, re] of cases) assert.throws(() => assertPublicEnv(env, true), re, JSON.stringify(env));
});

test("outside production an incomplete environment is allowed (dev ergonomics)", () => {
  assert.doesNotThrow(() => assertPublicEnv({}, false));
  assert.doesNotThrow(() => assertPublicEnv({ NEXT_PUBLIC_SITE_URL: "http://example.com" }, false));
});

test("secrets in public variables are refused everywhere", () => {
  const leaks = [
    { ...good, NEXT_PUBLIC_JWT_SECRET: "x".repeat(40) },
    { ...good, NEXT_PUBLIC_INTERNAL_API_TOKEN: "abc" },
    { ...good, NEXT_PUBLIC_SMTP_PASSWORD: "abc" },
    { ...good, NEXT_PUBLIC_ANYTHING: "sb_secret_abc" },
    { ...good, NEXT_PUBLIC_KEY: jwt({ role: "service_role" }) },
  ];
  for (const env of leaks) {
    assert.throws(() => assertPublicEnv(env, false), /gizli/, JSON.stringify(Object.keys(env)));
    assert.throws(() => assertPublicEnv(env, true), /gizli/);
  }
  const problems = publicEnvProblems({ ...good, NEXT_PUBLIC_JWT_SECRET: "hunter2-hunter2" });
  assert.ok(problems.every((p) => !p.includes("hunter2")), "messages never contain values");
});

test("secret key detection", () => {
  assert.equal(looksLikeSecretKey("sb_secret_abc"), true);
  assert.equal(looksLikeSecretKey(jwt({ role: "service_role" })), true);
  assert.equal(looksLikeSecretKey(jwt({ role: "anon" })), false);
  assert.equal(looksLikeSecretKey("sb_publishable_abc"), false);
  assert.equal(looksLikeSecretKey(undefined), false);
});
