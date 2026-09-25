// P1-03: open redirect through returnTo / next.
//
//   npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { safeInternalPath } from "../src/lib/safeRedirect.ts";

const accepted = ["/", "/ilanlar", "/hesabim?x=1", "/ilan/berjer-10640#galeri", "/yeni-sifre?token=expired", "/ilanlar?q=%C3%A7ay"];

const rejected = [
  "//evil.com",
  "/\\evil.com",
  "\\\\evil.com",
  "/%5cevil.com",
  "/%5Cevil.com",
  "/%255cevil.com",
  "/%2f%2fevil.com",
  "%2F%2Fevil.com",
  "https://evil.com",
  "http:evil.com",
  "javascript:alert(1)",
  "JaVaScRiPt:alert(1)",
  "data:text/html,x",
  "evil.com",
  "/\r\nSet-Cookie: x=1",
  "/%0d%0aLocation: https://evil.com",
  "/\u0000",
  "/\t/evil.com",
  "",
  " /ilanlar",
  "/" + "a".repeat(3000),
  "/%E0%A4%A",
];

test("internal paths are accepted unchanged", () => {
  for (const path of accepted) assert.equal(safeInternalPath(path), path, path);
});

test("external, scheme-relative, backslash, encoded and control-character targets fall back", () => {
  for (const path of rejected) assert.equal(safeInternalPath(path), "/", JSON.stringify(path));
});

test("non-string input and a custom fallback", () => {
  for (const value of [null, undefined, 42, {}, ["/ilanlar"]]) assert.equal(safeInternalPath(value), "/");
  assert.equal(safeInternalPath("//evil.com", "/giris"), "/giris");
});
