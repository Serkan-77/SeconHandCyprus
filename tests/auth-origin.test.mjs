// P1-04: links in auth e-mails come from the configured site URL, never from
// the request's Host / X-Forwarded-Host headers (which a client can forge).
// The behaviour itself is tested against the running API in api/test; this
// keeps the rule visible in the source.
//
//   npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Code only: comments may mention the headers they avoid.
const code = (path) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8")
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");

test("the API's auth module builds links from config, not request headers", () => {
  const auth = code("../api/src/modules/auth.ts");
  assert.doesNotMatch(auth, /x-forwarded-host|x-forwarded-proto|headers\.host|hostname/i);
  assert.match(auth, /const link = \(path: string\) => `\$\{config\.siteOrigin\}\$\{path\}`/);
  for (const line of auth.split("\n").filter((l) => /emails\.(verify|passwordReset|alreadyRegistered)\(/.test(l))) {
    assert.match(line, /link\(/, line.trim());
  }
});

test("absoluteUrl uses the configured site URL", async () => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://www.example-site.test/";
  const { absoluteUrl, SITE } = await import("../src/lib/site.ts");
  assert.equal(SITE.url, "https://www.example-site.test");
  assert.equal(absoluteUrl("/eposta-dogrula?token=x"), "https://www.example-site.test/eposta-dogrula?token=x");
});
