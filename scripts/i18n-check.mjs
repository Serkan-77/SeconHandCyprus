import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
let documentLoads = 0;
page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documentLoads++; });
mkdirSync('responsive-shots', { recursive: true });

// On narrow screens the language/theme controls live in the menu sheet.
async function control(testId) {
  const visible = page.getByTestId(testId).filter({ visible: true });
  if (await visible.count() === 0) {
    await page.getByRole('button', { name: /^(Menüyü aç|Open menu)$/ }).click();
    await visible.first().waitFor();
  }
  return visible.first();
}
async function closeMenu() {
  if (await page.getByRole('dialog').filter({ visible: true }).count()) await page.keyboard.press('Escape');
}
const toggle = async (testId) => { await (await control(testId)).click(); await closeMenu(); };

try {
  await page.goto(`${base}/giris`, { waitUntil: 'networkidle' });
  await page.getByLabel('E-posta', { exact: true }).fill('language-check@example.com');
  await page.getByLabel('Şifre', { exact: true }).fill('sample-not-submitted');
  const loadsBeforeToggle = documentLoads;
  await toggle('language-toggle');
  await page.getByRole('heading', { name: 'Welcome back', exact: true }).waitFor();
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  assert.equal(await page.getByLabel('Email', { exact: true }).inputValue(), 'language-check@example.com');
  assert.equal(await page.getByLabel('Password', { exact: true }).inputValue(), 'sample-not-submitted');
  assert.equal(documentLoads, loadsBeforeToggle, 'language toggle must not reload the document');
  await toggle('theme-toggle');
  assert.match(await page.locator('html').getAttribute('class'), /dark/);
  await toggle('language-toggle');
  await page.getByRole('heading', { name: 'Tekrar hoş geldin', exact: true }).waitFor();
  assert.match(await page.locator('html').getAttribute('class'), /dark/);
  await toggle('language-toggle');
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Welcome back', exact: true }).waitFor();
  assert.match(await page.locator('html').getAttribute('class'), /dark/);
  console.log('PASS: instant toggle, preserved fields, independent theme, reload persistence');

  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.locator('a[href="/yardim"]').filter({ visible: true }).first().click();
  await page.waitForURL('**/yardim');
  await page.getByRole('heading', { level: 1 }).first().waitFor();
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  await page.goto(`${base}/destek`, { waitUntil: 'networkidle' });
  await page.getByLabel('Subject', { exact: true }).selectOption({ label: 'Listing issue' });
  assert.equal(await page.getByLabel('Subject', { exact: true }).inputValue(), 'İlan sorunu');
  await toggle('language-toggle');
  assert.equal(await page.getByLabel('Konu', { exact: true }).inputValue(), 'İlan sorunu');
  await toggle('language-toggle');
  console.log('PASS: client navigation and stable form option values');

  const routes = ['/', '/kategori', '/ilanlar', '/magazalar', '/giris', '/kayit', '/konum', '/yardim', '/destek', '/hakkimizda', '/kosullar', '/gizlilik', '/cerez-politikasi', '/one-cikar', '/sifre-yenile', '/yeni-sifre', '/giris-gerekli', '/hesap-kisitlandi', '/cevrimdisi', '/yonetim/giris', '/missing-i18n-check'];
  for (const route of routes) {
    await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('html').getAttribute('lang'), 'en', route);
    assert.ok(await page.getByTestId('language-toggle').count() >= 1, route);
    const text = await page.locator('main').innerText();
    // Log remaining Turkish text for review; user content and place names are expected.
    const leftovers = text.split('\n').map(s => s.trim()).filter(s => /[çğıöşüÇĞİÖŞÜ]/.test(s));
    if (leftovers.length) console.log(`REVIEW ${route}: ${JSON.stringify(leftovers)}`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `overflow at ${route}`);
    console.log(`PASS: ${route}`);
  }

  for (const width of [320, 375, 390, 640, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${base}/`, { waitUntil: 'networkidle' });
    for (const locale of ['en', 'tr']) {
      if (await page.locator('html').getAttribute('lang') !== locale) await toggle('language-toggle');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${width}/${locale} overflow`);
      const language = await (await control('language-toggle')).boundingBox();
      const theme = await (await control('theme-toggle')).boundingBox();
      assert.ok(language && theme && Math.abs(language.y - theme.y) < 2, 'controls should be adjacent');
      assert.ok(language.width >= 44 && theme.width >= 44 && theme.height >= 44, 'touch targets');
      assert.ok(theme.x + theme.width <= width, 'controls within viewport');
      if (width === 390 || width === 1440) await page.screenshot({ path: `responsive-shots/i18n-${width}-${locale}.png` });
      await closeMenu();
    }
    await page.screenshot({ path: `responsive-shots/i18n-${width}.png`, fullPage: false });
    console.log(`PASS: responsive ${width}px`);
  }
  assert.deepEqual(errors, []);
  console.log('PASS: no browser runtime errors');
} finally {
  await browser.close();
}
