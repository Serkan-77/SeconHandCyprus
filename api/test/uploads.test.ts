// Upload pipeline: only real images, re-encoded, metadata stripped, bounded
// size, owner-scoped, safe to serve.
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { anon, newUser, resetDatabase, startApp, testJpeg, type TestApp } from "./helpers.ts";
import { ImageRejected, processImage } from "../src/storage/images.ts";

let t: TestApp;
before(async () => {
  await resetDatabase();
  t = await startApp();
});
after(async () => t?.close());

describe("accepted images", () => {
  test("a JPEG becomes three WebP sizes without EXIF/GPS", async () => {
    const u = await newUser(t);
    const res = await u.upload(await testJpeg(3000, 2000));
    assert.equal(res.statusCode, 200, res.body);
    assert.match(res.data.key, /^l\/\d{4}\/\d{2}\/[0-9a-f-]{36}$/);
    for (const size of ["sm", "md", "lg"]) {
      const file = await anon(t.app).get(`/media/${res.data.key}/${size}.webp`);
      assert.equal(file.statusCode, 200);
      assert.equal(file.headers["content-type"], "image/webp");
      assert.equal(file.headers["x-content-type-options"], "nosniff");
      const meta = await sharp(file.rawPayload).metadata();
      assert.equal(meta.format, "webp");
      assert.equal(meta.exif, undefined, "EXIF (incl. GPS) removed");
      assert.ok(Math.max(meta.width!, meta.height!) <= { sm: 400, md: 800, lg: 1600 }[size]!);
    }
  });

  test("avatars are square", async () => {
    const u = await newUser(t);
    const res = await u.upload(await testJpeg(900, 600), "avatar");
    assert.equal(res.statusCode, 200);
    const file = await anon(t.app).get(`/media/${res.data.key}/md.webp`);
    const meta = await sharp(file.rawPayload).metadata();
    assert.equal(meta.width, meta.height);
  });

  test("a PNG declared as JPEG is judged by its content", async () => {
    const u = await newUser(t);
    const png = await sharp({ create: { width: 500, height: 500, channels: 3, background: "#123456" } }).png().toBuffer();
    assert.equal((await u.upload(png, "listing", "x.jpg", "image/jpeg")).statusCode, 200);
  });
});

describe("refused files", () => {
  test("non-images, SVG and HTML are refused even with an image name and type", async () => {
    const u = await newUser(t);
    const cases = [
      Buffer.from("<?php system($_GET['c']); ?>"),
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect width="500" height="500"/></svg>'),
      Buffer.from("<html><script>alert(1)</script></html>"),
      Buffer.from("MZ\x90\x00\x03\x00\x00\x00"),
      Buffer.alloc(0),
    ];
    for (const body of cases) {
      const res = await u.upload(body, "listing", "photo.jpg", "image/jpeg");
      assert.ok([400, 422].includes(res.statusCode), `${res.statusCode}: ${body.subarray(0, 12).toString()}`);
    }
  });

  test("tiny, extreme-ratio and oversized files are refused", async () => {
    const u = await newUser(t);
    assert.equal((await u.upload(await testJpeg(100, 100))).statusCode, 422);
    assert.equal((await u.upload(await testJpeg(3000, 300))).statusCode, 422);
    const big = Buffer.concat([await testJpeg(800, 600), Buffer.alloc(13 * 1024 * 1024)]);
    assert.equal((await u.upload(big)).statusCode, 413);
  });

  test("a decompression bomb is refused", async () => {
    const u = await newUser(t);
    // 10000 × 10000 pixels of one colour compresses to a small PNG.
    const bomb = await sharp({ create: { width: 10000, height: 10000, channels: 3, background: "#000000" } }).png({ compressionLevel: 9 }).toBuffer();
    const res = await u.upload(bomb, "listing", "bomb.png", "image/png");
    assert.equal(res.statusCode, 422);
  });

  test("anonymous uploads are refused", async () => {
    assert.equal((await anon(t.app).upload(await testJpeg())).statusCode, 401);
  });

  test("legacy mode (Supabase import only) relaxes size, never decoding", async () => {
    const small = await testJpeg(100, 100);
    await assert.rejects(processImage(small, "listing"), ImageRejected);
    const out = await processImage(small, "listing", { legacy: true });
    assert.deepEqual(out.variants.map((v) => v.name), ["sm.webp", "md.webp", "lg.webp"]);
    await assert.rejects(processImage(Buffer.from("<svg onload=alert(1)>"), "listing", { legacy: true }), ImageRejected);
    const bomb = await sharp({ create: { width: 10000, height: 10000, channels: 3, background: "#000000" } }).png({ compressionLevel: 9 }).toBuffer();
    await assert.rejects(processImage(bomb, "listing", { legacy: true }), ImageRejected);
  });
});

describe("serving", () => {
  test("media paths cannot escape the upload directory", async () => {
    for (const path of [
      "/media/../../etc/passwd",
      "/media/l/2026/10/..%2F..%2F..%2Fetc%2Fpasswd/sm.webp",
      "/media/l/2026/10/00000000-0000-0000-0000-000000000000/../../../../package.json",
      "/media/%2e%2e/%2e%2e/secret/sm.webp",
      "/media/l/2026/10/00000000-0000-0000-0000-000000000000/sm.webp%00.html",
    ]) {
      const res = await anon(t.app).get(path);
      assert.ok([400, 404].includes(res.statusCode), `${path} → ${res.statusCode}`);
      assert.ok(!res.body.includes("root:") && !res.body.includes('"dependencies"'));
    }
  });

  test("unattached uploads can be discarded by their owner only", async () => {
    const a = await newUser(t);
    const b = await newUser(t);
    const res = await a.upload(await testJpeg());
    await b.post("/api/v1/uploads/discard", { key: res.data.key });
    assert.equal((await anon(t.app).get(`/media/${res.data.key}/sm.webp`)).statusCode, 200, "someone else cannot discard it");
    await a.post("/api/v1/uploads/discard", { key: res.data.key });
    assert.equal((await anon(t.app).get(`/media/${res.data.key}/sm.webp`)).statusCode, 404);
  });

  test("avatar must be the caller's own avatar upload", async () => {
    const a = await newUser(t);
    const b = await newUser(t);
    const own = await a.upload(await testJpeg(600, 600), "avatar");
    const theirs = await b.upload(await testJpeg(600, 600), "avatar");
    assert.equal((await a.patch("/api/v1/me/profile", { name: "Ayşe", region: "", avatar: theirs.data.key })).statusCode, 403);
    assert.equal((await a.patch("/api/v1/me/profile", { name: "Ayşe", region: "", avatar: "https://evil.example/x.png" })).statusCode, 403);
    assert.equal((await a.patch("/api/v1/me/profile", { name: "Ayşe", region: "", avatar: own.data.key })).statusCode, 200);
  });
});
