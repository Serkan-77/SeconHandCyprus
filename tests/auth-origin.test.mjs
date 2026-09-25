// P1-04: auth e-mail and OAuth links come from NEXT_PUBLIC_SITE_URL, never
// from the request's Host / X-Forwarded-Host headers.
//
//   npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Code only: the file's comments are allowed to mention the headers they avoid.
const AUTH = readFileSync(fileURLToPath(new URL("../src/lib/actions/auth.ts", import.meta.url)), "utf8")
  .split(/\r?\n/)
  .filter((line) => !line.trim().startsWith("//"))
  .join("\n");

test("auth actions do not read request headers to build URLs", () => {
  assert.doesNotMatch(AUTH, /from "next\/headers"/);
  assert.doesNotMatch(AUTH, /x-forwarded-host|x-forwarded-proto|\.get\("host"\)/i);
  for (const option of ["emailRedirectTo", "redirectTo"]) {
    for (const line of AUTH.split("\n").filter((l) => l.includes(`${option}:`))) {
      assert.match(line, /authCallbackUrl\(/, line.trim());
    }
  }
});

test("absoluteUrl uses the configured site URL", async () => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://www.example-site.test/";
  const { absoluteUrl, SITE } = await import("../src/lib/site.ts");
  assert.equal(SITE.url, "https://www.example-site.test");
  assert.equal(absoluteUrl("/auth/callback?next=%2Fkurulum"), "https://www.example-site.test/auth/callback?next=%2Fkurulum");
});
