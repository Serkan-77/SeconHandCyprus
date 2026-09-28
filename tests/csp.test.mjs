// P1-15: Content-Security-Policy built in src/proxy.ts.
//
//   npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCsp, createNonce } from "../src/lib/csp.ts";

const SUPABASE = "https://abcdefghijklmnop.supabase.co";
const base = { nonce: "bm9uY2U=", supabaseUrl: SUPABASE, dev: false, https: true, ads: false };

function directives(csp) {
  return Object.fromEntries(
    csp.split(";").map((d) => d.trim()).filter(Boolean).map((d) => {
      const [name, ...values] = d.split(/\s+/);
      return [name, values];
    }),
  );
}

test("production policy: nonce + strict-dynamic, no inline or eval scripts", () => {
  const d = directives(buildCsp(base));
  assert.deepEqual(d["script-src"], ["'self'", "'nonce-bm9uY2U='", "'strict-dynamic'"]);
  assert.ok(!d["script-src"].includes("'unsafe-inline'"));
  assert.ok(!d["script-src"].includes("'unsafe-eval'"));
  assert.deepEqual(d["object-src"], ["'none'"]);
  assert.deepEqual(d["frame-ancestors"], ["'none'"]);
  assert.deepEqual(d["frame-src"], ["'none'"]);
  assert.deepEqual(d["base-uri"], ["'self'"]);
  assert.ok("upgrade-insecure-requests" in d);
});

test("Supabase REST/Realtime, Google OAuth form chain and avatars are allowed", () => {
  const d = directives(buildCsp(base));
  assert.ok(d["connect-src"].includes(SUPABASE));
  assert.ok(d["connect-src"].includes("wss://abcdefghijklmnop.supabase.co"));
  assert.ok(d["form-action"].includes(SUPABASE));
  assert.ok(d["form-action"].includes("https://accounts.google.com"));
  assert.ok(d["img-src"].includes("https://lh3.googleusercontent.com"));
});

test("development adds only unsafe-eval; http sites skip upgrade-insecure-requests", () => {
  const d = directives(buildCsp({ ...base, dev: true, https: false }));
  assert.ok(d["script-src"].includes("'unsafe-eval'"));
  assert.ok(!d["script-src"].includes("'unsafe-inline'"));
  assert.ok(!("upgrade-insecure-requests" in d));
});

test("AdSense hosts appear only when ads are enabled", () => {
  const off = buildCsp(base);
  const on = directives(buildCsp({ ...base, ads: true }));
  assert.ok(!off.includes("googlesyndication"));
  assert.ok(on["script-src"].includes("https://pagead2.googlesyndication.com"));
  assert.ok(on["frame-src"].includes("https://googleads.g.doubleclick.net"));
  assert.ok(on["frame-src"].includes("https://fundingchoicesmessages.google.com"));
  assert.ok(on["connect-src"].includes("https://fundingchoicesmessages.google.com"));
  assert.ok(!off.includes("fundingchoices"));
});

test("nonces are random, base64 and 128-bit", () => {
  const seen = new Set();
  for (let i = 0; i < 50; i++) {
    const n = createNonce();
    assert.match(n, /^[A-Za-z0-9+/]{22}==$/);
    seen.add(n);
  }
  assert.equal(seen.size, 50);
});
