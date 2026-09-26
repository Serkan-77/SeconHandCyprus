import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { assertDevDatabase } from "./lib/dev-guard.mjs";

// Signs in as a seeded demo account: development project only (never spend
// sign-in attempts or look for demo data on production).
assertDevDatabase("responsive");

// Screenshots every main page on mobile/tablet/desktop in light and dark mode
// and flags horizontal overflow. Run with `npm run responsive` while the dev
// server is up; signs in as the seeded demo buyer so account pages render.
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const OUT_DIR = (process.env.RESPONSIVE_OUT ?? "responsive-shots") + "/";
mkdirSync(OUT_DIR, { recursive: true });

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
const { data: sample } = await db.from("listings").select("slug, seller_id").eq("status", "active").limit(1).single();

const viewports = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 820, height: 1180 },
  desktop: { width: 1440, height: 900 },
};

const pages = [
  "/",
  "/kategori",
  "/ilanlar",
  `/ilan/${sample.slug}`,
  `/satici/${sample.seller_id}`,
  "/giris",
  "/kayit",
  "/konum",
  "/ilan-ver/fotograflar",
  "/mesajlar",
  "/hesabim",
  "/hesabim/ilanlar",
  "/hesabim/favoriler",
  "/hesabim/ayarlar",
  "/yardim",
  "/destek",
  "/sistem",
];

const browser = await chromium.launch();

for (const [device, viewport] of Object.entries(viewports)) {
  for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({
      viewport,
      colorScheme: theme,
    });
    const page = await context.newPage();
    await page.goto(`${BASE}/giris`);
    await page.getByLabel("E-posta adresi").fill("ece@demo.kibrisikinciel.test");
    await page.getByLabel("Şifre").fill(process.env.SEED_PASSWORD);
    await page.getByRole("button", { name: "Giriş yap" }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/giris"));
    const errors = [];
    page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
    });

    for (const path of pages) {
      const name = path === "/" ? "home" : path.replace(/\//g, "_").replace(/^_/, "");
      try {
        await page.goto(`${BASE}${path}`, { waitUntil: "load", timeout: 15000 });
        await page.waitForTimeout(300);
        const hasOverflow = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        );
        const file = `${OUT_DIR}${device}-${theme}-${name}.png`;
        await page.screenshot({ path: file, fullPage: true });
        console.log(
          `${device}/${theme} ${path} -> ${hasOverflow ? "OVERFLOW!" : "ok"} (${file})`,
        );
      } catch (err) {
        console.log(`${device}/${theme} ${path} -> ERROR: ${err.message}`);
      }
    }

    if (errors.length) {
      console.log(`  console/page errors on ${device}/${theme}:`);
      for (const e of errors) console.log(`    ${e}`);
    }

    await context.close();
  }
}

await browser.close();
console.log("Done. Screenshots in", OUT_DIR);
