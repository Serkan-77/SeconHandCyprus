// P1-13: database-writing scripts run only against the explicit development project.
//
//   npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { destructiveScriptProblems, projectRef } from "../scripts/lib/dev-guard.mjs";

const dev = {
  ALLOW_DESTRUCTIVE_TESTS: "1",
  DEV_SUPABASE_PROJECT_REF: "devref123",
  NEXT_PUBLIC_SUPABASE_URL: "https://devref123.supabase.co",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
};

test("the explicit development setup passes", () => {
  assert.equal(projectRef(dev.NEXT_PUBLIC_SUPABASE_URL), "devref123");
  assert.deepEqual(destructiveScriptProblems(dev), []);
});

test("each missing condition blocks the script on its own", () => {
  const cases = [
    [{ ALLOW_DESTRUCTIVE_TESTS: undefined }, /açıkça izin/],
    [{ ALLOW_DESTRUCTIVE_TESTS: "true" }, /açıkça izin/],
    [{ DEV_SUPABASE_PROJECT_REF: undefined }, /tanımlı değil/],
    [{ DEV_SUPABASE_PROJECT_REF: "prodref999" }, /eşleşmiyor/],
    [{ NEXT_PUBLIC_SUPABASE_URL: "https://example.com" }, /Supabase proje adresi değil/],
    [{ NEXT_PUBLIC_SITE_URL: "https://www.kibrisikinciel.example" }, /localhost değil/],
    [{ NEXT_PUBLIC_SITE_URL: undefined }, /localhost değil/],
    [{ NODE_ENV: "production" }, /production/],
    [{ VERCEL_ENV: "production" }, /production/],
  ];
  for (const [override, re] of cases) {
    const problems = destructiveScriptProblems({ ...dev, ...override });
    assert.ok(problems.some((p) => re.test(p)), `${JSON.stringify(override)} → ${problems}`);
  }
});

test("seed, e2e, security and integration call the guard before touching the database", () => {
  for (const [file, name] of [["seed", "seed"], ["e2e-check", "e2e"], ["security-check", "security"], ["integration-check", "integration"], ["security-p1-check", "security-p1"]]) {
    const src = readFileSync(fileURLToPath(new URL(`../scripts/${file}.mjs`, import.meta.url)), "utf8");
    const guard = src.indexOf(`assertDevDatabase("${name}")`);
    assert.ok(guard > 0, `${file}: guard call missing`);
    for (const use of ["createClient(", "chromium.launch(", "signInWithPassword("]) {
      const at = src.indexOf(use);
      if (at >= 0) assert.ok(guard < at, `${file}: ${use} runs before the guard`);
    }
  }
});
