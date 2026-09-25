// End-to-end smoke test against a running dev server and the seeded database.
//
//   npm run dev          (in another terminal)
//   npm run e2e
//
// Walks through the main guest, buyer, seller and admin flows and fails on any
// broken step or browser console error.

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const PASSWORD = process.env.SEED_PASSWORD;
const DOMAIN = "demo.kibrisikinciel.test";
const OUT = process.env.E2E_OUT ?? "e2e-screens";
const STARTED_AT = new Date(Date.now() - 60 * 1000).toISOString();
if (!PASSWORD) throw new Error("SEED_PASSWORD gerekli (.env.local)");

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const results = [];
const consoleErrors = [];

async function newPage() {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "tr-TR" });
  const page = await context.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error" && !/favicon|Download the React DevTools|status of 404/.test(msg.text())) {
      consoleErrors.push(`${page.url()} → ${msg.text().slice(0, 200)}`);
    }
  });
  page.on("pageerror", (err) => consoleErrors.push(`${page.url()} → ${err.message.slice(0, 200)}`));
  return page;
}

async function step(name, fn) {
  try {
    await fn();
    results.push(["✓", name]);
  } catch (e) {
    results.push(["✗", `${name}: ${e.message.split("\n")[0].slice(0, 160)}`]);
  }
}

async function shot(page, name) {
  // caret: "initial" — the default ("hide") injects caret-color styles into the
  // page, which React reports as a hydration mismatch if it lands mid-hydration.
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false, caret: "initial" });
}

async function login(page, user) {
  await page.goto(`${BASE}/giris`);
  await page.getByLabel("E-posta adresi").fill(`${user}@${DOMAIN}`);
  await page.getByLabel("Şifre").fill(PASSWORD);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/giris"), { timeout: 20000 }), page.getByRole("button", { name: "Giriş yap" }).click()]);
}

// P0-07: no public verification badge while there is no SMS/OTP.
async function expectNoVerifiedBadge(page) {
  for (const text of ["Doğrulandı", "Doğrulanmış iletişim bilgileri"]) {
    if (await page.getByText(text, { exact: true }).count()) throw new Error(`herkese açık "${text}" rozeti görünüyor`);
  }
}

function expectText(page, text) {
  return page.getByText(text, { exact: false }).first().waitFor({ timeout: 15000 });
}

// ---------------------------------------------------------------- guest
const guest = await newPage();
let listingPath = "";
let sellerPath = "";

await step("Ana sayfa ilanları gösteriyor", async () => {
  await guest.goto(BASE);
  await expectText(guest, "Yeni keşifler");
  const cards = await guest.locator("article").count();
  if (cards < 4) throw new Error(`yalnızca ${cards} kart`);
  await shot(guest, "01-ana-sayfa");
});

await step("Eski kategori adresi temiz URL'ye yönleniyor", async () => {
  await guest.goto(`${BASE}/ilanlar?kategori=mobilya`);
  await guest.waitForURL(/\/kategori\/mobilya$/);
  await expectText(guest, "Mobilya ilanları");
  await shot(guest, "02-mobilya");
});

await step("Arama", async () => {
  await guest.goto(`${BASE}/ilanlar?q=bisiklet`);
  await expectText(guest, "Şehir bisikleti");
});

await step("Boş arama sonucu", async () => {
  await guest.goto(`${BASE}/ilanlar?q=zzzyokboyleilan`);
  await expectText(guest, "Sonuç bulunamadı");
});

await step("Fiyat sıralaması", async () => {
  await guest.goto(`${BASE}/ilanlar?sirala=artan&birim=TL`);
  const prices = await guest.locator("article strong").allTextContents();
  const nums = prices.map((p) => Number(p.replace(/\D/g, "")));
  if (nums.some((n, i) => i > 0 && n < nums[i - 1])) throw new Error(`sıralama bozuk: ${nums.join(",")}`);
});

await step("İlan detayı", async () => {
  await guest.goto(`${BASE}/ilanlar?q=berjer`);
  await guest.locator("article a").first().click();
  await guest.waitForURL(/\/ilan\//);
  listingPath = new URL(guest.url()).pathname;
  await expectText(guest, "Biraz da hikâyesi");
  await expectText(guest, "Satıcıya mesaj gönder");
  await expectNoVerifiedBadge(guest);
  await shot(guest, "03-ilan-detay");
});

await step("Satıcı profili ve yorumlar", async () => {
  await guest.locator('a[href^="/satici/"]').first().click();
  await guest.waitForURL(/\/satici\//);
  sellerPath = new URL(guest.url()).pathname;
  await expectText(guest, "Aktif ilanları");
  await expectNoVerifiedBadge(guest);
  await guest.goto(`${BASE}${sellerPath}/yorumlar`);
  await expectText(guest, "Değerlendirmeler");
  await expectNoVerifiedBadge(guest);
  await shot(guest, "04-satici-yorumlar");
});

await step("Korumalı sayfa misafiri yönlendiriyor", async () => {
  await guest.goto(`${BASE}/hesabim`);
  await guest.waitForURL(/giris-gerekli/);
});

await step("Admin paneli misafiri yönlendiriyor", async () => {
  await guest.goto(`${BASE}/yonetim`);
  await guest.waitForURL(/yonetim\/giris/);
});

await step("Statik sayfalar", async () => {
  for (const path of ["/kategori", "/yardim", "/destek", "/kosullar", "/gizlilik", "/cerez-politikasi", "/hakkimizda", "/konum", "/sitemap.xml", "/robots.txt", "/manifest.webmanifest", "/opengraph-image", "/kategori/mobilya/opengraph-image"]) {
    const res = await guest.goto(`${BASE}${path}`);
    if (!res || res.status() >= 400) throw new Error(`${path} → ${res?.status()}`);
  }
});

await step("SEO: canonical, yapılandırılmış veri ve sitemap", async () => {
  await guest.goto(`${BASE}${listingPath}`);
  const canonical = await guest.locator('link[rel="canonical"]').getAttribute("href");
  if (!canonical?.endsWith(listingPath)) throw new Error(`canonical: ${canonical}`);
  const types = await guest.$$eval('script[type="application/ld+json"]', (els) => els.flatMap((e) => [].concat(JSON.parse(e.textContent)).map((d) => d["@type"])));
  for (const t of ["Product", "BreadcrumbList"]) if (!types.includes(t)) throw new Error(`${t} yok: ${types}`);
  const og = await guest.locator('meta[property="og:image"]').first().getAttribute("content");
  if (!og) throw new Error("og:image yok");
  await guest.goto(`${BASE}/ilanlar?q=berjer`);
  const robots = await guest.locator('meta[name="robots"]').getAttribute("content");
  if (!robots?.includes("noindex")) throw new Error(`arama sayfası indekslenebilir: ${robots}`);
  const sitemap = await (await guest.request.get(`${BASE}/sitemap.xml`)).text();
  if (!sitemap.includes("/kategori/mobilya") || !sitemap.includes("/ilan/")) throw new Error("sitemap eksik");
});

await step("Ödeme sayfaları kaldırıldı, ads.txt AdSense yokken 404", async () => {
  for (const path of ["/one-cikar", "/premium", "/odeme/ozet", "/yonetim/paketler", "/ads.txt"]) {
    const res = await guest.request.get(`${BASE}${path}`, { maxRedirects: 0 });
    if (![404, 307, 308].includes(res.status())) throw new Error(`${path} → ${res.status()}`);
  }
});

await step("404 sayfası", async () => {
  const res = await guest.goto(`${BASE}/ilan/boyle-bir-ilan-yok`);
  if (res?.status() !== 404) throw new Error(`status ${res?.status()}`);
});

// ---------------------------------------------------------------- buyer
const buyer = await newPage();

await step("Alıcı girişi (ece)", async () => {
  await login(buyer, "ece");
  await expectText(buyer, "Ece");
});

await step("Güvenlik başlıkları ve nonce'lu CSP (P1-15)", async () => {
  const res = await buyer.request.get(`${BASE}/`);
  const h = res.headers();
  const csp = h["content-security-policy"] ?? "";
  const nonce = csp.match(/'nonce-([^']+)'/)?.[1];
  if (!nonce) throw new Error(`CSP'de nonce yok: ${csp.slice(0, 80)}`);
  if (/script-src[^;]*'unsafe-inline'/.test(csp)) throw new Error("script-src 'unsafe-inline' içeriyor");
  for (const d of ["frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'"]) {
    if (!csp.includes(d)) throw new Error(`CSP'de ${d} yok`);
  }
  const html = await res.text();
  const scriptNonces = [...html.matchAll(/<script\b[^>]*\snonce="([^"]+)"/g)].map((m) => m[1]);
  if (!scriptNonces.length || scriptNonces.some((n) => n !== nonce)) throw new Error("script nonce'ları CSP ile eşleşmiyor");
  const expected = { "x-content-type-options": "nosniff", "x-frame-options": "DENY", "referrer-policy": "strict-origin-when-cross-origin" };
  for (const [k, v] of Object.entries(expected)) if (h[k] !== v) throw new Error(`${k}: ${h[k]}`);
  if (!h["permissions-policy"]?.includes("camera=()")) throw new Error("Permissions-Policy eksik");
  if (h["x-powered-by"]) throw new Error("X-Powered-By gönderiliyor");
  const second = (await (await buyer.request.get(`${BASE}/`)).headers())["content-security-policy"];
  if (second === csp) throw new Error("nonce her istekte değişmiyor");
});

await step("Açık yönlendirme engelli: /giris?returnTo=/\\evil (P1-03)", async () => {
  // A signed-in user opening /giris is redirected to returnTo by the proxy.
  for (const target of ["/\\evil.example", "/%5Cevil.example", "//evil.example", "https://evil.example"]) {
    await buyer.goto(`${BASE}/giris?returnTo=${encodeURIComponent(target)}`);
    const host = new URL(buyer.url()).host;
    if (host !== new URL(BASE).host) throw new Error(`${target} → ${buyer.url()}`);
  }
  await buyer.goto(`${BASE}/giris?returnTo=${encodeURIComponent("/hesabim/favoriler")}`);
  await buyer.waitForURL(/\/hesabim\/favoriler/);
});

await step("Hesabım özeti", async () => {
  await buyer.goto(`${BASE}/hesabim`);
  await expectText(buyer, "Merhaba, Ece");
  await shot(buyer, "05-hesabim");
});

await step("Favoriye ekleme kalıcı", async () => {
  await buyer.goto(`${BASE}${listingPath}`);
  const btn = buyer.getByRole("button", { name: /Favori/ }).first();
  const before = await btn.getAttribute("aria-pressed");
  await btn.click();
  await buyer.waitForTimeout(1500);
  await buyer.reload();
  const after = await buyer.getByRole("button", { name: /Favori/ }).first().getAttribute("aria-pressed");
  if (before === after) throw new Error(`durum değişmedi (${before})`);
  // restore
  await buyer.getByRole("button", { name: /Favori/ }).first().click();
  await buyer.waitForTimeout(1200);
});

await step("Favoriler sayfası", async () => {
  await buyer.goto(`${BASE}/hesabim/favoriler`);
  await expectText(buyer, "Bir kenara ayırdıkların");
});

await step("Mesajlar ve mesaj gönderme", async () => {
  await buyer.goto(`${BASE}/mesajlar`);
  await buyer.locator('a[href^="/mesajlar?c="]').first().click();
  await buyer.waitForURL(/\/mesajlar\?c=/);
  const text = `Test mesajı ${Date.now()}`;
  await buyer.getByLabel("Mesaj", { exact: true }).fill(text);
  await buyer.getByRole("button", { name: /Gönder/ }).click();
  await expectText(buyer, text);
  await expectNoVerifiedBadge(buyer);
  await buyer.reload();
  await expectText(buyer, text);
  await shot(buyer, "06-mesajlar");
});

await step("Bildirim merkezi", async () => {
  await buyer.goto(`${BASE}/hesabim/bildirimler`);
  await expectText(buyer, "Bildirim merkezi");
});

await step("Ayarlar ve doğrulama sayfaları", async () => {
  await buyer.goto(`${BASE}/hesabim/ayarlar`);
  await expectText(buyer, "Bildirim tercihleri");
  await buyer.goto(`${BASE}/hesabim/dogrulama`);
  await expectText(buyer, "Profil güveni");
});

// The test listing carries a script-breaking payload in its title and
// description so the JSON-LD regression step below can check real pages.
const XSS = "</script><script>alert(1)</script>";
let newListingKey = "";
let newListingTitle = "";
await step("İlan verme sihirbazı (fotoğraf yükleme dahil)", async () => {
  newListingKey = `E2E test lambası ${Date.now() % 100000}`;
  newListingTitle = `${newListingKey} ${XSS}`;
  await buyer.goto(`${BASE}/ilan-ver/fotograflar`);
  await buyer.locator('input[type="file"]').setInputFiles("public/images/demo-chair.jpg");
  await buyer.getByText("1 / 10 fotoğraf eklendi").waitFor({ timeout: 30000 });
  await buyer.getByRole("button", { name: "Devam et" }).click();
  await buyer.waitForURL(/detaylar/);
  await buyer.getByLabel("Başlık").fill(newListingTitle);
  await buyer.locator("main form select").first().selectOption("ev-aletleri");
  await buyer.getByLabel("Açıklama").fill(`Otomatik test ile oluşturuldu. ${XSS}`);
  await buyer.getByRole("button", { name: "Devam et" }).click();
  await buyer.waitForURL(/fiyat-konum/);
  await buyer.getByLabel("Fiyat").fill("750");
  await buyer.getByRole("button", { name: "Devam et" }).click();
  await buyer.waitForURL(/onizleme/);
  await shot(buyer, "07-onizleme");
  await buyer.getByRole("button", { name: "İlanı yayına gönder" }).click();
  await buyer.waitForURL(/yayinda/, { timeout: 20000 });
  await buyer.goto(`${BASE}/hesabim/ilanlar?sekme=inceleme`);
  await expectText(buyer, newListingTitle);
});

// ---------------------------------------------------------------- admin
const admin = await newPage();

await step("Yönetici girişi", async () => {
  await admin.goto(`${BASE}/yonetim/giris`);
  await admin.getByLabel("E-posta").fill(`admin@${DOMAIN}`);
  await admin.getByLabel("Şifre").fill(PASSWORD);
  await admin.getByRole("button", { name: "Giriş yap" }).click();
  await admin.waitForURL(`${BASE}/yonetim`, { timeout: 20000 });
  await expectText(admin, "Genel bakış");
  await shot(admin, "08-yonetim");
});

await step("İlan onaylama", async () => {
  await admin.goto(`${BASE}/yonetim/ilanlar`);
  await admin.getByText(newListingTitle).waitFor({ timeout: 15000 });
  await admin.locator("tr", { hasText: newListingTitle }).getByRole("link", { name: "İncele" }).click();
  await admin.getByRole("button", { name: "Onayla ve yayınla" }).click();
  await expectText(admin, "yayına alındı");
});

let newListingPath = "";
await step("Onaylanan ilan herkese açık", async () => {
  // Search strips "(" and ")", so look the listing up by its plain prefix.
  await guest.goto(`${BASE}/ilanlar?q=${encodeURIComponent(newListingKey)}`);
  const card = guest.locator("article", { hasText: newListingKey });
  await card.waitFor({ timeout: 15000 });
  newListingPath = (await card.locator('a[href^="/ilan/"]').first().getAttribute("href")) ?? "";
});

await step("JSON-LD XSS regresyonu: başlık, açıklama ve satıcı adı (P0-01)", async () => {
  // Give the seller a script-breaking display name for the duration of the check.
  await buyer.goto(`${BASE}/hesabim/duzenle`);
  const nameField = buyer.getByLabel("Görünen ad");
  const originalName = await nameField.inputValue();
  // The field has maxLength=40, so keep the hostile name short enough to survive intact.
  const hostileName = `E2E ${XSS}`;
  const saveName = async (value) => {
    await buyer.goto(`${BASE}/hesabim/duzenle`);
    await nameField.fill(value);
    const filled = await nameField.inputValue();
    if (filled !== value) throw new Error(`görünen ad alanı değeri kırptı: ${filled}`);
    await buyer.getByRole("button", { name: "Kaydet" }).click();
    await expectText(buyer, "Profilin kaydedildi.");
  };

  let alerted = false;
  const onDialog = async (dialog) => {
    alerted = true;
    await dialog.dismiss();
  };
  guest.on("dialog", onDialog);

  await saveName(hostileName);
  try {
    if (!newListingPath) throw new Error("test ilanının adresi bulunamadı");
    await guest.goto(`${BASE}${newListingPath}`);
    const ownSellerPath = await guest.locator('a[href^="/satici/"]').first().getAttribute("href");
    if (!ownSellerPath) throw new Error("test ilanının satıcı adresi bulunamadı");
    const pages = [
      [newListingPath, [newListingTitle, `Otomatik test ile oluşturuldu. ${XSS}`, hostileName]],
      [ownSellerPath, [hostileName]],
      [`/ilanlar?q=${encodeURIComponent(newListingKey)}`, [newListingTitle]],
    ];
    for (const [path, expected] of pages) {
      // Raw server HTML, before the browser gets a chance to repair anything.
      const html = await (await guest.request.get(`${BASE}${path}`)).text();
      if (html.includes(XSS)) throw new Error(`${path}: ham HTML'de kaçışsız payload var`);
      const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
      if (!blocks.length) throw new Error(`${path}: JSON-LD bulunamadı`);
      // Every block must still be valid JSON that round-trips the original text.
      const strings = JSON.stringify(blocks.map((b) => JSON.parse(b)));
      for (const value of expected) {
        if (!strings.includes(JSON.stringify(value).slice(1, -1))) {
          throw new Error(`${path}: JSON-LD beklenen metni içermiyor: ${value.slice(0, 40)}`);
        }
      }
      await guest.goto(`${BASE}${path}`);
      await guest.waitForLoadState("networkidle");
    }
    if (alerted) throw new Error("payload tarayıcıda çalıştı (alert açıldı)");
  } finally {
    guest.off("dialog", onDialog);
    await saveName(originalName);
  }
});

// Two-sided meeting confirmation. ece (the `buyer` page) is the seller of the
// test listing here; mert opens the conversation as the buyer.
const E2E_RATING = "E2E değerlendirme";
let meetingConversationId = null;
let meetingSellerId = null;
await step("Buluşma onayı iki taraflı; puan ancak iki onaydan sonra (P0-04)", async () => {
  if (!newListingPath) throw new Error("test ilanının adresi bulunamadı");
  const mert = await newPage();
  await login(mert, "mert");
  const rateButton = (page) => page.getByRole("button", { name: "Değerlendirme bırak" });
  const confirm = async (page) => {
    await page.getByRole("button", { name: "Buluşmayı onayla" }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: "Buluşmayı onayla" }).click();
  };

  // 1. The buyer opens a conversation and writes.
  await mert.goto(`${BASE}${newListingPath}`);
  await mert.getByRole("button", { name: "Satıcıya mesaj gönder" }).click();
  await mert.waitForURL(/\/mesajlar\?c=/, { timeout: 20000 });
  meetingConversationId = new URL(mert.url()).searchParams.get("c");
  await mert.getByLabel("Mesaj", { exact: true }).fill("E2E buluşma testi");
  await mert.getByRole("button", { name: /Gönder/ }).click();
  await expectText(mert, "E2E buluşma testi");

  // 2. No rating before any confirmation.
  await mert.getByRole("button", { name: "Buluşmayı onayla" }).first().waitFor({ timeout: 15000 });
  if (await rateButton(mert).count()) throw new Error("onay yokken değerlendirme butonu görünüyor");

  // 3-4. The buyer confirms; still no rating.
  await confirm(mert);
  await expectText(mert, "Sen buluşmayı onayladın. Karşı tarafın onayı bekleniyor.");
  if (await rateButton(mert).count()) throw new Error("tek onayla değerlendirme butonu görünüyor");

  // 5. The seller sees it and confirms too; the rating form opens for them.
  await buyer.goto(`${BASE}/mesajlar?c=${meetingConversationId}`);
  await expectText(buyer, "Karşı taraf buluşmayı onayladı.");
  await confirm(buyer);
  await buyer.getByRole("button", { name: "Değerlendirmeyi gönder" }).waitFor({ timeout: 15000 });
  await buyer.keyboard.press("Escape");

  // 6. Both sides see the two-sided confirmation.
  await expectText(buyer, "Buluşma iki taraf tarafından onaylandı.");
  await mert.reload();
  await expectText(mert, "Buluşma iki taraf tarafından onaylandı.");

  // 7. The buyer rates the seller.
  await rateButton(mert).click();
  await mert.getByLabel("Yorum (opsiyonel)").fill(E2E_RATING);
  await mert.getByRole("button", { name: "Değerlendirmeyi gönder" }).click();
  await expectText(mert, "Değerlendirmen gönderildi");

  // 8. No second rating: the button is gone and the database refuses a direct insert.
  await mert.reload();
  await expectText(mert, "Buluşma iki taraf tarafından onaylandı.");
  if (await rateButton(mert).count()) throw new Error("ikinci değerlendirme butonu görünüyor");
  const api = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false },
  });
  const { data: auth } = await api.auth.signInWithPassword({ email: `mert@${DOMAIN}`, password: PASSWORD });
  const { data: conv } = await api.from("conversations").select("seller_id").eq("id", meetingConversationId).single();
  meetingSellerId = conv?.seller_id ?? null;
  const { error } = await api.from("ratings").insert({
    rater_id: auth.user.id,
    ratee_id: meetingSellerId,
    conversation_id: meetingConversationId,
    score: 1,
    comment: E2E_RATING,
  });
  await api.auth.signOut();
  if (error?.code !== "23505") throw new Error(`ikinci puan reddedilmedi: ${error?.code ?? "kaydedildi"}`);
});

await step("Satıcıya onay bildirimi gitti", async () => {
  await buyer.goto(`${BASE}/hesabim/bildirimler`);
  await expectText(buyer, `${newListingTitle} artık aramalarda görünüyor`);
});

await step("Yönetim alt sayfaları", async () => {
  for (const [path, text] of [
    ["/yonetim/kullanicilar", "Kullanıcı yönetimi"],
    ["/yonetim/sikayetler", "Şikayet kuyruğu"],
    ["/yonetim/dogrulama", "Manuel telefon incelemesi"],
    ["/yonetim/destek", "Destek talepleri"],
    ["/yonetim/kategoriler", "Kategori yönetimi"],
    ["/yonetim/duyurular", "Duyuru oluştur"],
  ]) {
    await admin.goto(`${BASE}${path}`);
    await expectText(admin, text);
  }
});

await step("Normal kullanıcı admin paneline giremez", async () => {
  await buyer.goto(`${BASE}/yonetim`);
  await buyer.waitForURL(/yonetim\/giris/);
});

await step("Test ilanını temizle", async () => {
  await buyer.goto(`${BASE}/hesabim/ilanlar`);
  await buyer.locator("article", { hasText: newListingTitle }).getByRole("link", { name: "Yönet" }).click();
  await buyer.getByRole("button", { name: "İlanı sil" }).first().click();
  await buyer.getByRole("dialog").getByRole("button", { name: "İlanı sil" }).click();
  await buyer.waitForURL(/\/hesabim\/ilanlar$/, { timeout: 15000 });
});

// ---------------------------------------------------------------- mobile
await step("Mobil görünümde yatay taşma yok", async () => {
  const context = await browser.newContext({ viewport: { width: 375, height: 800 } });
  const page = await context.newPage();
  for (const path of ["/", "/ilanlar", listingPath, "/kategori", "/giris"]) {
    await page.goto(`${BASE}${path}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 1) throw new Error(`${path} ${overflow}px taşıyor`);
  }
  await page.goto(BASE);
  await page.screenshot({ path: `${OUT}/09-mobil.png` });
});

await browser.close();

// Remove chat messages the run left in the demo conversations.
if (process.env.SUPABASE_SECRET_KEY) {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
  await db.from("messages").delete().like("body", "Test mesajı %");
  await db.from("listings").delete().like("title", "E2E test %");
  // Ratings outlive their conversation, and the meeting step leaves two notifications.
  await db.from("ratings").delete().eq("comment", E2E_RATING);
  if (meetingConversationId) await db.from("notifications").delete().eq("link", `/mesajlar?c=${meetingConversationId}`);
  if (meetingSellerId) {
    await db.from("notifications").delete().eq("link", `/satici/${meetingSellerId}/yorumlar`).gte("created_at", STARTED_AT);
  }
}

console.log("\n" + results.map(([s, n]) => `${s} ${n}`).join("\n"));
if (consoleErrors.length) {
  console.log(`\nKonsol hataları (${consoleErrors.length}):`);
  [...new Set(consoleErrors)].slice(0, 15).forEach((e) => console.log("  - " + e));
}
const failed = results.filter(([s]) => s === "✗").length;
console.log(`\n${results.length - failed}/${results.length} adım geçti.`);
process.exit(failed || consoleErrors.length ? 1 : 0);
