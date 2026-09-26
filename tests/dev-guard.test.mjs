// P1-13: database-writing scripts run only against the explicit development project.
//
//   npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
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
  for (const [file, name] of [["seed", "seed"], ["e2e-check", "e2e"], ["security-check", "security"], ["integration-check", "integration"], ["security-p1-check", "security-p1"], ["responsive-check", "responsive"]]) {
    const src = readFileSync(fileURLToPath(new URL(`../scripts/${file}.mjs`, import.meta.url)), "utf8");
    const guard = src.indexOf(`assertDevDatabase("${name}")`);
    assert.ok(guard > 0, `${file}: guard call missing`);
    for (const use of ["createClient(", "chromium.launch(", "signInWithPassword("]) {
      const at = src.indexOf(use);
      if (at >= 0) assert.ok(guard < at, `${file}: ${use} runs before the guard`);
    }
  }
});

// Production-like environments, without any real production connection: the
// Supabase host below is never contacted because the guard stops first.
const GUARDED = ["seed", "e2e-check", "security-check", "security-p1-check", "integration-check", "responsive-check"];
const prodLike = {
  NEXT_PUBLIC_SUPABASE_URL: "https://prodlikeref0000000000.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_placeholder",
  NEXT_PUBLIC_SITE_URL: "https://www.example.com",
  SUPABASE_SECRET_KEY: "sb_secret_placeholder",
  SEED_PASSWORD: "placeholder",
};
const scenarios = [
  ["production env, no opt-in", prodLike],
  ["opt-in and matching ref, but https site", { ...prodLike, ALLOW_DESTRUCTIVE_TESTS: "1", DEV_SUPABASE_PROJECT_REF: "prodlikeref0000000000" }],
  ["everything local, but NODE_ENV=production", {
    ...prodLike, NEXT_PUBLIC_SITE_URL: "http://localhost:3000", ALLOW_DESTRUCTIVE_TESTS: "1",
    DEV_SUPABASE_PROJECT_REF: "prodlikeref0000000000", NODE_ENV: "production",
  }],
];
for (const [label, env] of scenarios) {
  test(`every database-writing script refuses to start: ${label}`, () => {
    for (const script of GUARDED) {
      const run = spawnSync(process.execPath, [fileURLToPath(new URL(`../scripts/${script}.mjs`, import.meta.url))], {
        env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, ...env },
        encoding: "utf8",
        timeout: 30000,
      });
      assert.equal(run.status, 2, `${script}: exit ${run.status}
${run.stderr}`);
      assert.match(run.stderr, /yalnızca development projesinde çalışır/);
      assert.ok(!run.stderr.includes("placeholder"), `${script}: printed a secret value`);
    }
  });
}

test("production smoke script is read-only", () => {
  const src = readFileSync(fileURLToPath(new URL("../scripts/production-smoke.mjs", import.meta.url)), "utf8");
  for (const call of [".insert(", ".update(", ".delete(", ".upsert(", ".upload(", ".remove(", "signIn", "method:", "SUPABASE_SECRET_KEY"]) {
    assert.ok(!src.includes(call), `production-smoke uses ${call}`);
  }
  assert.ok(!src.includes("assertDevDatabase"), "smoke must not need the dev guard");
});
