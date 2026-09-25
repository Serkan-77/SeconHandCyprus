// P1-12: fail fast on a missing or invalid public environment in production.
//
//   npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { assertPublicEnv, looksLikeSecretKey, publicEnvProblems } from "../src/lib/envCheck.ts";

const good = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnop.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abc123",
  NEXT_PUBLIC_SITE_URL: "https://www.kibrisikinciel.example",
};
const jwt = (payload) => `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify(payload)).replace(/=+$/, "")}.sig`;

test("a complete production environment passes", () => {
  assert.deepEqual(publicEnvProblems(good), []);
  assert.doesNotThrow(() => assertPublicEnv(good, true));
  assert.doesNotThrow(() => assertPublicEnv({ ...good, NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }, true));
});

test("production refuses missing or malformed values", () => {
  const cases = [
    [{ ...good, NEXT_PUBLIC_SUPABASE_URL: undefined }, /SUPABASE_URL tanımlı değil/],
    [{ ...good, NEXT_PUBLIC_SUPABASE_URL: "not a url" }, /https adresi değil/],
    [{ ...good, NEXT_PUBLIC_SUPABASE_URL: "http://abc.supabase.co" }, /https adresi değil/],
    [{ ...good, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "" }, /PUBLISHABLE_KEY tanımlı değil/],
    [{ ...good, NEXT_PUBLIC_SITE_URL: undefined }, /SITE_URL tanımlı değil/],
    [{ ...good, NEXT_PUBLIC_SITE_URL: "kibrisikinciel.example" }, /http\(s\) adresi değil/],
    [{ ...good, NEXT_PUBLIC_SITE_URL: "ftp://kibrisikinciel.example" }, /http\(s\) adresi değil/],
    [{ ...good, NEXT_PUBLIC_SITE_URL: "http://kibrisikinciel.example" }, /https olmalı/],
    [{ ...good, NEXT_PUBLIC_SITE_URL: "https://kibrisikinciel.example/tr" }, /yalnızca origin/],
  ];
  for (const [env, re] of cases) assert.throws(() => assertPublicEnv(env, true), re, JSON.stringify(env));
});

test("outside production an unconfigured app is allowed (dev ergonomics)", () => {
  assert.doesNotThrow(() => assertPublicEnv({}, false));
  assert.doesNotThrow(() => assertPublicEnv({ ...good, NEXT_PUBLIC_SITE_URL: "http://example.com" }, false));
});

test("a secret key in a public variable is refused everywhere", () => {
  assert.ok(looksLikeSecretKey("sb_secret_abc"));
  assert.ok(looksLikeSecretKey(jwt({ role: "service_role" })));
  assert.ok(!looksLikeSecretKey(jwt({ role: "anon" })));
  assert.ok(!looksLikeSecretKey("sb_publishable_abc"));
  for (const production of [true, false]) {
    assert.throws(() => assertPublicEnv({ ...good, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_abc" }, production), /gizli/);
  }
});

test("problem messages never contain the values themselves", () => {
  const env = { NEXT_PUBLIC_SUPABASE_URL: "http://leak.example", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_LEAK", NEXT_PUBLIC_SITE_URL: "http://leak.example" };
  const text = publicEnvProblems(env).join("\n");
  assert.ok(!text.includes("leak.example") && !text.includes("LEAK"));
});
