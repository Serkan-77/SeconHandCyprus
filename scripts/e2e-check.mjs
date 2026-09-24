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
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
}

async function login(page, user) {
  await page.goto(`${BASE}/giris`);
  await page.getByLabel("E-posta adresi").fill(`${user}@${DOMAIN}`);
  await page.getByLabel("Şifre").fill(PASSWORD);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/giris"), { timeout: 20000 }), page.getByRole("button", { name: "Giriş yap" }).click()]);
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

await step("Kategori filtresi", async () => {
  await guest.goto(`${BASE}/ilanlar?kategori=mobilya`);
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
  await shot(guest, "03-ilan-detay");
});

await step("Satıcı profili ve yorumlar", async () => {
  await guest.locator('a[href^="/satici/"]').first().click();
  await guest.waitForURL(/\/satici\//);
  sellerPath = new URL(guest.url()).pathname;
  await expectText(guest, "Aktif ilanları");
  await guest.goto(`${BASE}${sellerPath}/yorumlar`);
  await expectText(guest, "Değerlendirmeler");
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
  for (const path of ["/kategori", "/yardim", "/destek", "/kosullar", "/gizlilik", "/konum", "/sitemap.xml"]) {
    const res = await guest.goto(`${BASE}${path}`);
    if (!res || res.status() >= 400) throw new Error(`${path} → ${res?.status()}`);
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

let newListingTitle = "";
await step("İlan verme sihirbazı (fotoğraf yükleme dahil)", async () => {
  newListingTitle = `E2E test lambası ${Date.now() % 100000}`;
  await buyer.goto(`${BASE}/ilan-ver/fotograflar`);
  await buyer.locator('input[type="file"]').setInputFiles("public/images/demo-chair.jpg");
  await buyer.getByText("1 / 10 fotoğraf eklendi").waitFor({ timeout: 30000 });
  await buyer.getByRole("button", { name: "Devam et" }).click();
  await buyer.waitForURL(/detaylar/);
  await buyer.getByLabel("Başlık").fill(newListingTitle);
  await buyer.locator("main form select").first().selectOption("ev-aletleri");
  await buyer.getByLabel("Açıklama").fill("Otomatik test ile oluşturuldu.");
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

await step("Onaylanan ilan herkese açık", async () => {
  await guest.goto(`${BASE}/ilanlar?q=${encodeURIComponent(newListingTitle)}`);
  await guest.locator("article", { hasText: newListingTitle }).waitFor({ timeout: 15000 });
});

await step("Satıcıya onay bildirimi gitti", async () => {
  await buyer.goto(`${BASE}/hesabim/bildirimler`);
  await expectText(buyer, `${newListingTitle} artık aramalarda görünüyor`);
});

await step("Yönetim alt sayfaları", async () => {
  for (const [path, text] of [
    ["/yonetim/kullanicilar", "Kullanıcı yönetimi"],
    ["/yonetim/sikayetler", "Şikayet kuyruğu"],
    ["/yonetim/dogrulama", "Doğrulama incelemesi"],
    ["/yonetim/destek", "Destek talepleri"],
    ["/yonetim/kategoriler", "Kategori yönetimi"],
    ["/yonetim/paketler", "Paket ve fiyatlandırma"],
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
}

console.log("\n" + results.map(([s, n]) => `${s} ${n}`).join("\n"));
if (consoleErrors.length) {
  console.log(`\nKonsol hataları (${consoleErrors.length}):`);
  [...new Set(consoleErrors)].slice(0, 15).forEach((e) => console.log("  - " + e));
}
const failed = results.filter(([s]) => s === "✗").length;
console.log(`\n${results.length - failed}/${results.length} adım geçti.`);
process.exit(failed || consoleErrors.length ? 1 : 0);
