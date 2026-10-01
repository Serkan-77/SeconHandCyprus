# Kıbrıs İkinci Elcim

Kıbrıs için ikinci el alım-satım pazaryeri — www.kibrisikincielcim.com.
v2: Supabase'ten bağımsız, kendi sunucumuzda çalışan **Next.js web +
Fastify API + PostgreSQL**. Web mobil tarayıcılar dahil her cihazda çalışır;
aynı API ileride native mobil uygulamaya da hizmet eder.

Özellikler:

- kategori ağacı ve kategoriye özel özellikler (marka, model, beden, km…) ile filtreler
- adım adım ilan verme (taslak kaydı), moderasyon (admin onayı)
- arama, sıralama, vitrin; favoriler; mağaza sayfaları
- alıcı-satıcı mesajlaşması (WebSocket, anlık), iki taraflı buluşma onayı ve değerlendirme
- şikayet, engelleme, yaptırımlar, telefon/mağaza doğrulama talepleri
- yönetim paneli: ilanlar, kullanıcılar, şikayetler, kategoriler ve özellikler, duyurular, denetim kaydı
- e-posta/şifre ve isteğe bağlı Google ile giriş; Türkçe/İngilizce arayüz, koyu tema
- isteğe bağlı Google AdSense (CMP hazır olana kadar kapalı)

## Belgeler

| Belge | İçerik |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | bileşenler, kararlar, veri modeli, istek akışı |
| [docs/SECURITY.md](docs/SECURITY.md) | güvenlik modeli ve onu doğrulayan testler |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | VDS kurulumu, Caddy, güncelleme, loglar |
| [docs/PRODUCTION_RUNBOOK.md](docs/PRODUCTION_RUNBOOK.md) | canlı sistem: dağıtım, doğrulama, geri alma, arıza |
| [CLAUDE.md](CLAUDE.md) | mimari, kod haritası, değişiklik kuralları (geliştirici/AI hafızası) |
| [docs/BACKUP_RESTORE.md](docs/BACKUP_RESTORE.md) | yedekler, haftalık geri yükleme tatbikatı, felaket kurtarma |
| [docs/MIGRATION.md](docs/MIGRATION.md) | Supabase'ten veri taşıma, canlıya geçiş, geri dönüş planı |
| [docs/i18n.md](docs/i18n.md) | arayüz metinleri ve İngilizce katalog |
| [PROJECT_STATE.md](PROJECT_STATE.md) | güncel durum ve sıradaki adım |

> Bu Next.js sürümünde API'ler ve dosya yapısı eski sürümlerden farklıdır. Kod
> yazmadan önce `node_modules/next/dist/docs/` içindeki ilgili rehberi oku
> (bkz. `AGENTS.md`).

## Klasör yapısı

| Yol | İçerik |
|---|---|
| `src/app` | sayfalar (Türkçe URL'ler: `/ilanlar`, `/ilan/[slug]`, `/ilan-ver`, `/mesajlar`, `/hesabim`, `/yonetim` …) |
| `src/components` | UI kiti (`ui/`), arama, ilan, ilan verme, mesajlar, hesap, yönetim bileşenleri |
| `src/lib` | API istemcisi (`api/`), i18n, CSP, arama parametreleri, taslak, yardımcılar |
| `api/` | Fastify API: `src/modules/*`, `test/`, `scripts/` (seed, Supabase içe aktarma) |
| `shared/` | web ve API'nin ortak sabitleri, zod şemaları, özellik motoru |
| `db/` | `migrations/` (0001–0006), `init/` (roller) |
| `deploy/` | Dockerfile'lar, `docker-compose.yml`, `Caddyfile`, `ops/` (yedek, tatbikat, sağlık) |
| `migration/` | Supabase → PostgreSQL prova düzeneği |
| `supabase/migrations` | **eski** şema (yalnız referans ve içe aktarma provası için) |
| `tests/`, `scripts/` | web unit testleri; smoke, responsive ve dil kontrolleri |

## Yerel geliştirme

Gereksinimler: Node.js 24+, Docker.

```bash
npm ci && (cd api && npm ci)
docker compose -f docker-compose.dev.yml up -d          # PostgreSQL, 127.0.0.1:55432
cp api/.env.example api/.env                            # JWT_SECRET, INTERNAL_API_TOKEN, SEED_PASSWORD doldur
cp .env.example .env.local                              # INTERNAL_API_TOKEN aynı değer
npm --prefix api run migrate
npm --prefix api run seed                               # demo veri (admin/magaza/satici/alici@demo.kibrisikincielcim.test)
npm run dev:api                                         # API → http://localhost:4000
npm run dev                                             # web → http://localhost:3000
```

Yerelde e-postalar gönderilmez; doğrulama ve sıfırlama bağlantıları API
konsoluna yazılır (`MAIL_TRANSPORT=log`).

## Komutlar

| Komut | Açıklama |
|---|---|
| `npm run dev` / `dev:api` | web / API geliştirme sunucusu |
| `npm run build` | web production build |
| `npm run lint`, `npm run typecheck` | ESLint, `tsc` (API: `cd api && npx tsc --noEmit -p .`) |
| `npm test` | web unit testleri |
| `npm run test:api` | API testleri: güvenlik ve davranış (kendi `kie_test` veritabanını kurar) |
| `npm run test:all` | ikisi birden |
| `npm run responsive` | Playwright: 33 sayfa × 5 genişlik taşma kontrolü (çalışan dev sunucusu) |
| `npm run test:i18n` | Playwright: dil değiştirme, form koruma, tema, sayfalar |
| `npm run e2e` | Playwright: ilan ver → onay → mesaj → anlık yanıt → buluşma → değerlendirme (yerel, `E2E_PASSWORD` = seed şifresi; veri yazar) |
| `npm run smoke` | **salt okuma** canlı site kontrolü; production'da güvenli |
| `bash migration/rehearsal/rehearse.sh` | Supabase içe aktarma provası, uçtan uca |

## Production

Kısaca: VDS'te `docker compose -f deploy/docker-compose.yml --env-file
/srv/kibrisikincielcim/.env up -d --build`, host Caddy'de
`deploy/Caddyfile`, yedekler için systemd zamanlayıcıları. Ayrıntı
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md); canlıya geçiş
[docs/MIGRATION.md](docs/MIGRATION.md).

Gizli bilgiler hiçbir zaman repoya girmez: şablonlar `.env.example`,
`api/.env.example`, `deploy/.env.example`.
