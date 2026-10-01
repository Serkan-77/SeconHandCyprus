// Responsive and runtime check of the running site (development / staging).
//
//   npm run responsive              (BASE_URL defaults to http://localhost:3000)
//   RESPONSIVE_EMAIL=… RESPONSIVE_PASSWORD=… npm run responsive
//
// Visits public pages as a guest and account pages signed in, at phone,
// tablet and desktop widths. Reports horizontal overflow, page errors and
// failed requests, and writes screenshots to responsive-shots/ (ignored by
// git). Read-only: it signs in but never submits a form that changes data.
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const EMAIL = process.env.RESPONSIVE_EMAIL ?? "admin@demo.kibrisikincielcim.test";
const PASSWORD = process.env.RESPONSIVE_PASSWORD ?? "demo-sifre-2026";
const WIDTHS = (process.env.WIDTHS ?? "360,390,768,1024,1440").split(",").map(Number);
const OUT = "responsive-shots";

const problems = [];
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();

async function discover() {
  const r = await fetch(`${BASE}/api/v1/listings?pageSize=1`).then((x) => x.json());
  const slug = r.items[0]?.slug;
  const seller = r.items[0]?.seller.id;
  return { slug, seller };
}

async function check(context, path, label, expectStatus = 200) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && !/favicon|Download the React DevTools/.test(m.text()) && !(expectStatus === 404 && /404/.test(m.text())) && errors.push(`console: ${m.text().slice(0, 160)}`));
  page.on("response", (res) => res.status() >= 500 && errors.push(`${res.status()} ${res.url()}`));
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: width < 768 ? 800 : 900 });
    const res = await page.goto(BASE + path, { waitUntil: "load", timeout: 45000 }).catch((e) => ({ status: () => 0, e }));
    await page.waitForTimeout(700);
    if (!res || res.status() !== expectStatus) problems.push(`${label} ${path} @${width}: HTTP ${res?.status?.()}`);
    const over = await page.evaluate(() => {
      const w = document.documentElement.clientWidth;
      if (document.documentElement.scrollWidth <= w + 1) return null;
      const bad = [...document.querySelectorAll("body *")]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.right > w + 1 && getComputedStyle(el).position !== "fixed" && !el.closest(".overflow-x-auto, .no-scrollbar, [class*='overflow-x']");
        })
        .slice(0, 3)
        .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 4).join(".")}`);
      return { by: document.documentElement.scrollWidth - w, bad };
    });
    if (over) problems.push(`${label} ${path} @${width}: overflow ${over.by}px ${over.bad.join(" | ")}`);
    const name = `${label}${path.replace(/[^a-z0-9]+/gi, "_")}_${width}.png`.replace(/_+/g, "_");
    await page.screenshot({ path: `${OUT}/${name}`, fullPage: false });
  }
  for (const e of new Set(errors)) problems.push(`${label} ${path}: ${e}`);
  await page.close();
}

const { slug, seller } = await discover();
const guest = await browser.newContext({ colorScheme: "light", locale: "tr-TR" });
for (const p of [
  "/",
  "/ilanlar",
  "/ilanlar?q=iphone",
  "/kategori",
  "/kategori/elektronik",
  "/kategori/cep-telefonu",
  slug && `/ilan/${slug}`,
  seller && `/satici/${seller}`,
  "/magazalar",
  "/giris",
  "/kayit",
  "/sifre-yenile",
  "/konum",
  "/destek",
  "/yardim",
  "/hakkimizda",
].filter(Boolean)) {
  await check(guest, p, "guest");
}
await check(guest, "/bulunmayan-sayfa", "guest", 404);

const user = await browser.newContext({ colorScheme: "dark", locale: "tr-TR" });
const login = await user.request.post(`${BASE}/api/v1/auth/login`, {
  headers: { "x-kie-csrf": "1", origin: BASE },
  data: { email: EMAIL, password: PASSWORD },
});
if (!login.ok()) {
  problems.push(`login failed: ${login.status()} (set RESPONSIVE_EMAIL / RESPONSIVE_PASSWORD)`);
} else {
  const convs = await user.request.get(`${BASE}/api/v1/conversations`, { headers: { "x-kie-csrf": "1" } }).then((r) => r.json()).catch(() => ({ conversations: [] }));
  for (const p of [
    "/hesabim",
    "/hesabim/ilanlar",
    "/hesabim/favoriler",
    "/hesabim/ayarlar",
    "/hesabim/bildirimler",
    "/hesabim/magaza",
    "/hesabim/dogrulama",
    "/mesajlar",
    convs.conversations?.[0] && `/mesajlar/${convs.conversations[0].id}`,
    "/ilan-ver",
    "/yonetim",
    "/yonetim/ilanlar",
    "/yonetim/kullanicilar",
    "/yonetim/kategoriler",
    "/yonetim/sikayetler",
    "/yonetim/kayitlar",
  ].filter(Boolean)) {
    await check(user, p, "user");
  }
}

await browser.close();
if (problems.length) {
  console.log(`${problems.length} problem(s):\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log(`No overflow or runtime errors at ${WIDTHS.join(", ")} px. Screenshots in ${OUT}/.`);
