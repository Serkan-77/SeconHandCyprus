// P0-07: without SMS/OTP there is no public "verified" badge.
//
//   npm test
//
// phone_verified only means an admin manually reviewed a number, so public
// components and pages must neither read it nor show verification wording.
// The user's own trust centre (/hesabim), the admin panel (/yonetim) and the
// design-system showcase (/sistem) are out of scope.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PRIVATE_DIRS = ["src/app/yonetim", "src/app/hesabim", "src/app/sistem", "src/components/admin"];
const FORBIDDEN = [/phone_?verified/i, /Doğrulandı/, /Doğrulanmış/, /doğrulanmış satıcı/i, /verified seller/i];

function sourceFiles(dir) {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(tsx?|mjs)$/.test(entry.name) ? [path] : [];
  });
}

const publicFiles = [...sourceFiles("src/app"), ...sourceFiles("src/components")]
  .map((p) => relative(ROOT, join(ROOT, p)).replaceAll("\\", "/"))
  .filter((p) => !PRIVATE_DIRS.some((dir) => p.startsWith(`${dir}/`)));

test("there are public files to check", () => {
  assert.ok(publicFiles.some((p) => p.endsWith("SellerCard.tsx")));
  assert.ok(publicFiles.some((p) => p.endsWith("SellerHeader.tsx")));
  assert.ok(publicFiles.some((p) => p.endsWith("ChatView.tsx")));
});

test("no public component or page shows a verification badge or reads phone_verified", () => {
  const hits = [];
  for (const file of publicFiles) {
    readFileSync(join(ROOT, file), "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (FORBIDDEN.some((re) => re.test(line))) hits.push(`${file}:${i + 1}: ${line.trim()}`);
      });
  }
  assert.deepEqual(hits, []);
});
