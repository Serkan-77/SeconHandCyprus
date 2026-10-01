// Read-only smoke test for a deployed site: SAFE TO RUN AGAINST PRODUCTION.
//
//   npm run smoke                                   (uses NEXT_PUBLIC_SITE_URL)
//   SMOKE_BASE_URL=https://www.kibrisikincielcim.com npm run smoke
//   SMOKE_BASE_URL=http://127.0.0.1:3100 npm run smoke   (on the server, behind Caddy)
//
// What it does: plain GET requests to public pages, files, the public API
// and one uploaded image, plus requests that must be refused without a
// session. It never signs in, never writes, never uploads, and does not touch
// rate-limited actions (no sign-in attempts, no WhatsApp lookups). The write
// probes carry no session and no CSRF header, so they are refused before any
// handler runs, even if something were broken.
//
// Needs: NEXT_PUBLIC_SITE_URL (or SMOKE_BASE_URL). No secrets are used.
// Exit code: 0 all passed, 1 a check failed.

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
await check("Ortam: public değişkenler geçerli (SITE_URL, WS_URL, gizli anahtar yok)", () => {
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
await check("CSP: nonce + strict-dynamic, unsafe-inline/eval yok, frame-ancestors none, Supabase yok", () => {
  const csp = home?.res.headers.get("content-security-policy") ?? fail("CSP başlığı yok");
  const dir = Object.fromEntries(csp.split(";").map((d) => d.trim().split(/\s+/)).filter((p) => p[0]).map(([k, ...v]) => [k, v]));
  const script = dir["script-src"] ?? fail("script-src yok");
  if (!script.some((v) => v.startsWith("'nonce-"))) fail("script-src nonce yok");
  if (!script.includes("'strict-dynamic'")) fail("strict-dynamic yok");
  if (script.includes("'unsafe-inline'") || script.includes("'unsafe-eval'")) fail("script-src unsafe-inline/eval içeriyor");
  if (!(dir["frame-ancestors"] ?? []).includes("'none'")) fail("frame-ancestors 'none' değil");
  if (!(dir["object-src"] ?? []).includes("'none'")) fail("object-src 'none' değil");
  if (/supabase\.co/.test(csp)) fail("CSP hâlâ Supabase içeriyor");
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
  ["/hesabim", "/giris"],
  ["/mesajlar", "/giris"],
  ["/ilan-ver", "/giris"],
  ["/hesabim/favoriler", "/giris"],
  ["/yonetim", "/yonetim/giris"],
]) {
  await check(`Anonim ${path} → ${target} yönlendirmesi`, async () => {
    const res = await get(path);
    const location = new URL(res.headers.get("location") ?? "", BASE);
    if (res.status < 300 || res.status >= 400 || location.pathname !== target) fail(`HTTP ${res.status} → ${location.pathname}`);
    if (target === "/giris" && location.searchParams.get("returnTo") !== path) fail(`returnTo ${location.searchParams.get("returnTo")}`);
    if (location.origin !== new URL(BASE).origin) fail(`başka origine yönlendirme: ${location.origin}`);
  });
}
await check("Açık yönlendirme yok (returnTo dış adres)", async () => {
  const res = await get("/giris?returnTo=https%3A%2F%2Fevil.example%2F");
  if (res.status >= 300 && res.status < 400 && /evil\.example/.test(res.headers.get("location") ?? "")) fail("dış adrese yönlendirdi");
});

// ------------------------------------------------------------------ API (anonymous, read-only)
const api = (path, init) => get(`/api/v1${path}`, init);
let sample = null;
await check("Sayfalar Supabase'e bağlanmıyor", () => {
  if (/supabase\.co/.test(home?.html ?? "")) fail("ana sayfa supabase.co adresi içeriyor");
});
await check("API: kategori ağacı ve yayındaki ilanlar okunabiliyor", async () => {
  const tax = await api("/taxonomy");
  if (tax.status !== 200) fail(`taxonomy HTTP ${tax.status}`);
  const { categories = [] } = await tax.json();
  if (!categories.length) fail("kategori yok (migration uygulanmamış olabilir)");
  const res = await api("/listings?sayfa=1");
  if (res.status !== 200) fail(`listings HTTP ${res.status}`);
  const body = await res.json();
  sample = (body.listings ?? body.items ?? [])[0] ?? null;
  return `${categories.length} kategori, ${sample ? "örnek ilan var" : "henüz yayında ilan yok"}`;
});
await check("Görsel: /media üzerinden WebP, nosniff, uzun önbellek", async () => {
  const url = sample?.image?.md;
  if (!url) return "atlandı: görselli ilan yok";
  const res = await fetch(new URL(url, BASE), { headers: { "user-agent": "kie-production-smoke/1.0" } });
  if (res.status !== 200) fail(`HTTP ${res.status}`);
  if (res.headers.get("content-type") !== "image/webp") fail(`content-type ${res.headers.get("content-type")}`);
  if (res.headers.get("x-content-type-options") !== "nosniff") fail("nosniff yok");
  if (!/immutable/.test(res.headers.get("cache-control") ?? "")) fail("immutable önbellek yok");
});
await check("Görsel: upload dizini dışına çıkılamıyor", async () => {
  for (const path of ["/media/../.env", "/media/%2e%2e/%2e%2e/etc/passwd", "/media/l/2026/01/x/sm.webp"]) {
    const res = await get(path);
    if (res.status === 200) fail(`${path} → 200`);
  }
});
await check("API: oturumsuz özel uçlar 401", async () => {
  const open = [];
  for (const path of ["/me", "/me/favorites", "/conversations", "/admin/dashboard", "/me/notifications"]) {
    const res = await api(path);
    if (res.status !== 401) open.push(`${path} → ${res.status}`);
  }
  if (open.length) fail(open.join(", "));
});
await check("API: oturumsuz / CSRF başlıksız yazmalar reddediliyor", async () => {
  const codes = [];
  for (const [path, body] of [["/listings", { title: "smoke" }], ["/me/delete", {}], ["/conversations", {}]]) {
    const res = await api(path, { method: "POST", headers: { "content-type": "application/json", origin: "https://evil.example" }, body: JSON.stringify(body) });
    if (res.status < 400 || res.status >= 500) fail(`${path} → ${res.status}`);
    codes.push(res.status);
  }
  return codes.join(", ");
});
await check("İç sağlık uçları dışarıya kapalı (Caddy)", async () => {
  if (LOCAL) return "atlandı: yerel adres";
  const res = await get("/health/ready");
  if (res.status !== 404) fail(`HTTP ${res.status}`);
});
await check("API yanıtları: Server/X-Powered-By sızmıyor", async () => {
  const res = await api("/taxonomy");
  if (res.headers.get("x-powered-by")) fail("X-Powered-By var");
  if (/fastify|node/i.test(res.headers.get("server") ?? "")) fail(`Server: ${res.headers.get("server")}`);
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
