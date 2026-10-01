// P1-15: Content-Security-Policy built in src/proxy.ts.
//
//   npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCsp, createNonce } from "../src/lib/csp.ts";

const base = { nonce: "bm9uY2U=", dev: false, https: true, ads: false };

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

test("same-origin API and realtime; no third-party data hosts by default", () => {
  const d = directives(buildCsp(base));
  assert.deepEqual(d["connect-src"], ["'self'"]);
  assert.deepEqual(d["form-action"], ["'self'"]);
  assert.ok(d["img-src"].includes("https://lh3.googleusercontent.com"));
  assert.ok(!buildCsp(base).includes("supabase"));
});

test("a separate realtime origin and Google sign-in are added only when configured", () => {
  const d = directives(buildCsp({ ...base, connect: ["ws://localhost:4000/api/v1/ws"], googleSignIn: true }));
  assert.ok(d["connect-src"].includes("ws://localhost:4000"));
  assert.ok(d["form-action"].includes("https://accounts.google.com"));
  const bad = directives(buildCsp({ ...base, connect: ["not a url"] }));
  assert.deepEqual(bad["connect-src"], ["'self'"]);
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
