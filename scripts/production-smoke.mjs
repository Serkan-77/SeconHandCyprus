// Read-only smoke test for a deployed site: SAFE TO RUN AGAINST PRODUCTION.
//
//   npm run smoke                       (uses the environment variables already set)
//   node --env-file=.env.production.local scripts/production-smoke.mjs
//   SMOKE_BASE_URL=https://example.com npm run smoke
//
// What it does: plain GET requests to public pages and files, plus anonymous
// reads through the Supabase publishable key. It never signs in, never writes
// or deletes rows, never uploads files, never creates notifications and does
// not touch rate limits (no sign-in attempts, no WhatsApp lookups). The two
// RPC probes (create_listing, delete_my_account) are called without a session:
// both refuse before doing anything, so they cannot write even when broken.
//
// Needs: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
// NEXT_PUBLIC_SITE_URL (the site to test; SMOKE_BASE_URL overrides it, e.g.
// a local `next start` of a production build). No secret key is used.
// Exit code: 0 all passed, 1 a check failed.

import { createClient } from "@supabase/supabase-js";
import { publicEnvProblems } from "../src/lib/envCheck.ts";

const env = process.env;
const BASE = (env.SMOKE_BASE_URL || env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
if (!BASE) {
  console.error("SMOKE_BASE_URL veya NEXT_PUBLIC_SITE_URL tanımlı olmalı.");
  process.exit(1);
}
const base = new URL(BASE);
const LOCAL = ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
const HTTPS = base.protocol === "https:";
const SITE = (env.NEXT_PUBLIC_SITE_URL || BASE).replace(/\/$/, "");
const ADS_ON = env.NEXT_PUBLIC_ADSENSE_CMP_READY === "1";

const results = [];
async function check(name, fn) {
  try {
    const note = await fn();
    results.push(["✓", note ? `${name} (${note})` : name]);
  } catch (e) {
    results.push(["✗", `${name}: ${e.message}`]);
  }
}
const fail = (msg) => {
  throw new Error(msg);
};
const get = (path, init = {}) =>
  fetch(`${BASE}${path}`, { redirect: "manual", ...init, headers: { "user-agent": "kie-production-smoke/1.0", ...(init.headers ?? {}) } });
async function page(path) {
  const res = await get(path);
  if (res.status !== 200) fail(`HTTP ${res.status}`);
  if (!(res.headers.get("content-type") ?? "").includes("text/html")) fail(`content-type ${res.headers.get("content-type")}`);
  return { res, html: await res.text() };
}
const jsonLdBlocks = (html) =>
  [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));

// ------------------------------------------------------------------ environment
await check("Ortam: public değişkenler geçerli (Supabase URL/anahtar, SITE_URL)", () => {
  const problems = publicEnvProblems(env);
  if (problems.length) fail(problems.join("; "));
  if (!LOCAL && !SITE.startsWith("https://")) fail("NEXT_PUBLIC_SITE_URL https olmalı");
});
await check("Ortam: yıkıcı test anahtarı kapalı (ALLOW_DESTRUCTIVE_TESTS)", () => {
  if (!LOCAL && env.ALLOW_DESTRUCTIVE_TESTS === "1") fail("production ortamında ALLOW_DESTRUCTIVE_TESTS=1");
  return env.ALLOW_DESTRUCTIVE_TESTS === "1" ? "yerel test, açık" : "kapalı";
});

// ------------------------------------------------------------------ pages
for (const path of ["/", "/ilanlar", "/ilanlar?q=bisiklet", "/gizlilik", "/kosullar", "/cerez-politikasi", "/hakkimizda", "/yardim", "/destek"]) {
  await check(`Sayfa ${path} → 200`, async () => {
    await page(path);
  });
}
await check("Bilinmeyen sayfa → 404", async () => {
  const res = await get("/bu-sayfa-yok-smoke");
  if (res.status !== 404) fail(`HTTP ${res.status}`);
});

// ------------------------------------------------------------------ security headers / CSP
let home = null;
await check("Güvenlik başlıkları (nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy, HSTS)", async () => {
  home = await page("/");
  const h = home.res.headers;
  const missing = [];
  if (h.get("x-content-type-options") !== "nosniff") missing.push("nosniff");
  if (h.get("x-frame-options") !== "DENY") missing.push("X-Frame-Options");
  if (!h.get("referrer-policy")) missing.push("Referrer-Policy");
  if (!h.get("permissions-policy")) missing.push("Permissions-Policy");
  if (h.get("x-powered-by")) missing.push("X-Powered-By görünüyor");
  if (HTTPS && !h.get("strict-transport-security")) missing.push("HSTS");
  if (missing.length) fail(missing.join(", "));
  return HTTPS ? "HSTS var" : "http: HSTS beklenmez";
});
await check("CSP: nonce + strict-dynamic, unsafe-inline/eval yok, frame-ancestors none, Supabase izinli", () => {
  const csp = home?.res.headers.get("content-security-policy") ?? fail("CSP başlığı yok");
  const dir = Object.fromEntries(csp.split(";").map((d) => d.trim().split(/\s+/)).filter((p) => p[0]).map(([k, ...v]) => [k, v]));
  const script = dir["script-src"] ?? fail("script-src yok");
  if (!script.some((v) => v.startsWith("'nonce-"))) fail("script-src nonce yok");
  if (!script.includes("'strict-dynamic'")) fail("strict-dynamic yok");
  if (script.includes("'unsafe-inline'") || script.includes("'unsafe-eval'")) fail("script-src unsafe-inline/eval içeriyor");
  if (!(dir["frame-ancestors"] ?? []).includes("'none'")) fail("frame-ancestors 'none' değil");
  if (!(dir["object-src"] ?? []).includes("'none'")) fail("object-src 'none' değil");
  const supabase = new URL(env.NEXT_PUBLIC_SUPABASE_URL).origin;
  if (!(dir["connect-src"] ?? []).includes(supabase)) fail("connect-src Supabase'i içermiyor");
  if (!ADS_ON && /googlesyndication|doubleclick/.test(csp)) fail("reklam kapalıyken CSP reklam alan adları içeriyor");
  return "style-src 'unsafe-inline' bilinen (P2)";
});
await check("CSP nonce: sayfadaki her çalıştırılabilir <script> nonce taşıyor", () => {
  const nonce = /'nonce-([^']+)'/.exec(home.res.headers.get("content-security-policy"))?.[1];
  const scripts = [...home.html.matchAll(/<script\b([^>]*)>/g)].map((m) => m[1]).filter((a) => !/type="application\/(ld\+)?json"/.test(a));
  const bad = scripts.filter((a) => !a.includes(`nonce="${nonce}"`));
  if (bad.length) fail(`${bad.length}/${scripts.length} script nonce'suz`);
  return `${scripts.length} script`;
});
await check("Canonical adres NEXT_PUBLIC_SITE_URL ile aynı origin", () => {
  const href = /<link[^>]*rel="canonical"[^>]*href="([^"]+)"/.exec(home.html)?.[1] ?? fail("canonical yok");
  if (new URL(href, SITE).origin !== new URL(SITE).origin) fail(`canonical ${href}`);
});
await check("JSON-LD (ana sayfa) geçerli JSON", () => `${jsonLdBlocks(home.html).length} blok`);

// ------------------------------------------------------------------ ads
await check(`Reklam: CMP_READY=${ADS_ON ? "1 → reklam açık" : "kapalı → reklam scripti yok"}`, () => {
  const hasScript = /pagead2\.googlesyndication\.com/.test(home.html);
  if (!ADS_ON && hasScript) fail("CMP hazır değilken AdSense scripti sayfada");
  if (ADS_ON && !hasScript) fail("CMP_READY=1 ama AdSense scripti yok");
});

// ------------------------------------------------------------------ robots / sitemap / manifest
await check("robots.txt: sitemap adresi ve özel alanlar kapalı", async () => {
  const res = await get("/robots.txt");
  if (res.status !== 200) fail(`HTTP ${res.status}`);
  const text = await res.text();
  if (!text.includes(`Sitemap: ${SITE}/sitemap.xml`)) fail("Sitemap satırı SITE_URL ile eşleşmiyor");
  for (const p of ["/yonetim", "/hesabim", "/mesajlar"]) if (!text.includes(`Disallow: ${p}`)) fail(`Disallow ${p} yok`);
});
await check("sitemap.xml: geçerli ve tüm adresler SITE_URL altında", async () => {
  const res = await get("/sitemap.xml");
  if (res.status !== 200) fail(`HTTP ${res.status}`);
  const xml = await res.text();
  if (!xml.includes("<urlset")) fail("urlset yok");
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const foreign = locs.filter((l) => !l.startsWith(`${SITE}/`) && l !== SITE);
  if (!locs.length || foreign.length) fail(`${locs.length} adres, ${foreign.length} yabancı`);
  return `${locs.length} adres`;
});
await check("manifest.webmanifest geçerli JSON", async () => {
  const res = await get("/manifest.webmanifest");
  if (res.status !== 200) fail(`HTTP ${res.status}`);
  const m = await res.json();
  if (!m.name || !m.start_url) fail("name/start_url yok");
});

// ------------------------------------------------------------------ anonymous access to private areas
for (const [path, target] of [
  ["/hesabim", "/giris-gerekli"],
  ["/mesajlar", "/giris-gerekli"],
  ["/ilan-ver", "/giris-gerekli"],
  ["/yonetim", "/yonetim/giris"],
]) {
  await check(`Anonim ${path} → ${target} yönlendirmesi`, async () => {
    const res = await get(path);
    const location = res.headers.get("location") ?? "";
    if (res.status < 300 || res.status >= 400 || new URL(location, BASE).pathname !== target) fail(`HTTP ${res.status} → ${location || "-"}`);
  });
}

// ------------------------------------------------------------------ Supabase (anonymous, read-only)
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
let sample = null;
await check("Supabase: kategoriler ve yayındaki ilanlar okunabiliyor", async () => {
  const { data: categories, error } = await db.from("categories").select("slug").limit(50);
  if (error) fail(`kategoriler: ${error.message}`);
  if (!categories.length) fail("kategori yok (0001 uygulanmamış olabilir)");
  const { data: listings, error: e2 } = await db.from("listings").select("slug, status").eq("status", "active").limit(1);
  if (e2) fail(`ilanlar: ${e2.message}`);
  sample = listings[0] ?? null;
  return `${categories.length} kategori, ${sample ? "örnek ilan var" : "henüz yayında ilan yok"}`;
});
await check("Supabase: anonim kullanıcı yayında olmayan ilanları ve özel tabloları göremez", async () => {
  const leaks = [];
  const { data: hidden } = await db.from("listings").select("id").neq("status", "active").limit(1);
  if (hidden?.length) leaks.push("yayında olmayan ilan");
  for (const table of ["profile_private", "support_tickets", "notifications", "reports", "sanctions", "verification_requests", "messages", "conversations", "rate_limit_events"]) {
    const { data } = await db.from(table).select("*").limit(1);
    if (data?.length) leaks.push(table);
  }
  if (leaks.length) fail(`okunabildi: ${leaks.join(", ")}`);
});
await check("Supabase: oturumsuz yazma RPC'leri reddediliyor (create_listing, delete_my_account)", async () => {
  const create = await db.rpc("create_listing", {
    p_key: "00000000-0000-4000-8000-000000000000", p_category: "x", p_title: "smoke", p_description: "", p_price: 1,
    p_currency: "TL", p_city: "Girne", p_district: "", p_condition: "Sıfır", p_negotiable: false, p_photos: ["x/y.jpg"],
  });
  if (!create.error) fail("create_listing oturumsuz çalıştı");
  const del = await db.rpc("delete_my_account");
  if (!del.error) fail("delete_my_account oturumsuz çalıştı");
  return `${create.error.code ?? "-"}, ${del.error.code ?? "-"}`;
});
await check("İlan detay sayfası ve JSON-LD (Product)", async () => {
  if (!sample) return "atlandı: yayında ilan yok";
  const { html } = await page(`/ilan/${sample.slug}`);
  const types = jsonLdBlocks(html).flatMap((b) => [b["@type"], ...(b["@graph"] ?? []).map((g) => g["@type"])]);
  if (!types.includes("Product")) fail(`JSON-LD türleri: ${types.join(", ") || "yok"}`);
  return types.join(", ");
});

console.log(`\nProduction smoke (salt okuma) — ${BASE}`);
for (const [mark, name] of results) console.log(` ${mark} ${name}`);
const failed = results.filter(([m]) => m === "✗").length;
console.log(`\n${results.length - failed}/${results.length} kontrol geçti.`);
process.exit(failed ? 1 : 0);
