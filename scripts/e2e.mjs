// Browser end-to-end test of the marketplace's critical path on the new
// stack. WRITES DATA: only runs against a local development site with the
// demo accounts from `npm --prefix api run seed`.
//
//   E2E_PASSWORD=<SEED_PASSWORD> npm run e2e            (web on :3000, API on :4000)
//
// Seller (phone-sized screen) lists an item with two photos through the
// wizard → admin approves it → buyer (desktop) finds it, messages the seller
// → seller replies and the buyer sees it live (WebSocket) → both confirm the
// meeting → buyer rates the seller. Screenshots of a failure go to
// e2e-screens/.
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { chromium } from "playwright";

const base = (process.env.E2E_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname)) {
  console.error("e2e writes data: only runs against localhost.");
  process.exit(1);
}
const password = process.env.E2E_PASSWORD;
if (!password) {
  console.error("E2E_PASSWORD (the SEED_PASSWORD used for the demo accounts) is required.");
  process.exit(1);
}
const DOMAIN = "demo.kibrisikincielcim.test";
const sharp = createRequire(new URL("../api/package.json", import.meta.url))("sharp");
const photo = async (hue) => ({
  name: `foto-${hue}.jpg`,
  mimeType: "image/jpeg",
  buffer: await sharp({ create: { width: 1200, height: 900, channels: 3, background: { r: hue, g: 140, b: 255 - hue } } }).jpeg().toBuffer(),
});

mkdirSync("e2e-screens", { recursive: true });
const browser = await chromium.launch();
const errors = [];
let current = "setup";
const step = (name) => {
  current = name;
  console.log(`· ${name}`);
};

async function session(email, viewport) {
  const context = await browser.newContext({ viewport, locale: "tr-TR" });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(`${email}: ${e.message}`));
  await page.goto(`${base}/giris`);
  await page.getByLabel("E-posta", { exact: true }).fill(email);
  await page.getByLabel("Şifre", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/giris"));
  return page;
}

/** Waits until the text is visible (lists may hold hidden copies on small screens). */
const seen = (page, text, timeout) => page.getByText(text).filter({ visible: true }).first().waitFor({ timeout });

const unique = `E2E roman seti ${Date.now().toString(36)}`;
let seller, admin, buyer;
try {
  step("sign in: seller (390px), admin, buyer (1280px)");
  seller = await session(`satici@${DOMAIN}`, { width: 390, height: 844 });
  admin = await session(`admin@${DOMAIN}`, { width: 1280, height: 900 });
  buyer = await session(`alici@${DOMAIN}`, { width: 1280, height: 900 });

  step("wizard: category");
  await seller.goto(`${base}/ilan-ver`);
  const fresh = seller.getByRole("button", { name: /Yeni ilana başla|Baştan başla/ });
  if (await fresh.count()) await fresh.first().click();
  await seller.getByLabel("Kategori ara").fill("Roman");
  await seller.getByRole("button", { name: /Roman & Edebiyat/ }).first().click();

  step("wizard: photos");
  await seller.locator('input[type="file"]').first().setInputFiles([await photo(40), await photo(200)]);
  await seller.getByRole("button", { name: "Fotoğraf 2 kaldır" }).waitFor({ timeout: 30_000 });
  await seller.getByRole("button", { name: "Devam" }).click();

  step("wizard: details");
  await seller.locator("#title").fill(unique);
  await seller.getByText("Az kullanılmış", { exact: true }).first().click();
  await seller.locator("#description").fill("Uçtan uca test ilanı. Beş kitap, temiz.");
  await seller.getByRole("button", { name: "Devam" }).click();

  step("wizard: price and region");
  await seller.locator("#price").fill("250");
  await seller.locator("#city").selectOption("Girne");
  await seller.getByRole("button", { name: "Devam" }).click();

  step("wizard: publish");
  await seller.getByRole("button", { name: "İlanı yayınla" }).click();
  await seller.getByRole("heading", { name: "İlanın incelemeye gönderildi" }).waitFor({ timeout: 30_000 });

  step("admin: approve");
  await admin.goto(`${base}/yonetim/ilanlar?durum=pending`);
  const row = admin.locator("li, tr, article").filter({ hasText: unique }).first();
  await row.waitFor();
  await row.getByRole("button", { name: "Onayla", exact: true }).click();
  await admin.getByText("İlan yayına alındı.").first().waitFor();

  step("buyer: search and open");
  await buyer.goto(`${base}/ilanlar?q=${encodeURIComponent(unique)}`);
  await buyer.locator(`a[href^="/ilan/"]`).filter({ hasText: unique }).first().click();
  await buyer.waitForURL(/\/ilan\//);
  await buyer.getByRole("heading", { name: unique }).waitFor();
  const images = await buyer.locator('img[src*="/media/l/"]').count();
  if (images < 1) throw new Error("listing page shows no uploaded photo");

  step("buyer: message the seller");
  await buyer.getByRole("button", { name: "Satıcıya mesaj gönder" }).first().click();
  await buyer.waitForURL(/\/mesajlar\//);
  const conversationUrl = buyer.url();
  await buyer.getByPlaceholder("Mesajını yaz…").fill("Merhaba, kitaplar duruyor mu?");
  await buyer.getByRole("button", { name: "Gönder", exact: true }).click();
  await seen(buyer, "Merhaba, kitaplar duruyor mu?");

  step("seller: reply; buyer receives it live");
  await seller.goto(conversationUrl);
  await seen(seller, "Merhaba, kitaplar duruyor mu?");
  await seller.getByPlaceholder("Mesajını yaz…").fill("Evet, yarın Girne'de görüşebiliriz.");
  await seller.getByRole("button", { name: "Gönder", exact: true }).click();
  await seen(buyer, "Evet, yarın Girne'de görüşebiliriz.", 10_000); // no reload: WebSocket

  step("both confirm the meeting");
  for (const page of [buyer, seller]) {
    await page.getByRole("button", { name: "Buluşmayı onayla" }).first().click();
    await page.getByRole("button", { name: "Evet, buluştuk" }).click();
    await page.getByRole("button", { name: "Evet, buluştuk" }).waitFor({ state: "hidden" });
  }

  await seen(buyer, "Buluşma iki taraf tarafından onaylandı.", 10_000); // live, no reload

  step("buyer rates the seller");
  await buyer.getByRole("button", { name: "Değerlendir", exact: true }).first().click();
  await buyer.getByRole("radio", { name: "5 yıldız" }).click();
  await buyer.getByPlaceholder("Buluşma nasıl geçti? Ürün anlatıldığı gibi miydi?").fill("Kitaplar anlatıldığı gibiydi.");
  await buyer.getByRole("button", { name: "Değerlendirmeyi gönder" }).click();
  await buyer.getByText("Değerlendirdin").first().waitFor();

  if (errors.length) throw new Error(`browser errors:\n  ${errors.join("\n  ")}`);
  console.log("\nPASS: list → approve → find → message → live reply → meeting → rating");
} catch (e) {
  console.error(`\nFAIL at "${current}": ${e.message.split("\n")[0]}`);
  for (const [name, page] of [["seller", seller], ["admin", admin], ["buyer", buyer]]) {
    if (page) await page.screenshot({ path: `e2e-screens/fail-${name}.png`, fullPage: true }).catch(() => {});
  }
  process.exitCode = 1;
} finally {
  await browser.close();
}
