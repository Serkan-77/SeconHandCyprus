# Kıbrıs İkinci El

Kıbrıs için ikinci el alım-satım pazaryeri. Bu repo bir **Next.js web
uygulamasıdır** ve mobil tarayıcılar dahil tüm cihazlarda çalışır. Native mobil
uygulama gelecek bir aşama olarak planlanmıştır ve bu repoda yer almaz.

Özellikler:

- ilan verme ve moderasyon (admin onayı)
- arama ve filtreler, favoriler
- alıcı-satıcı mesajlaşması (Realtime)
- iki taraflı buluşma onayı ve değerlendirme
- şikayet, engelleme ve yaptırımlar
- telefon doğrulama talebi, hesap silme
- yasal sayfalar
- isteğe bağlı Google AdSense (varsayılan kapalı)

## Stack

- **Next.js 16** (App Router, Server Actions, `src/proxy.ts`), **React 19**, **TypeScript**
- **Tailwind CSS 4**
- **Supabase**:
  - Postgres, RLS policy'leri, tetikleyiciler ve RPC'ler
  - Auth (e-posta/şifre, isteğe bağlı Google)
  - Storage (`listing-images`, `avatars`)
  - Realtime (mesajlar)
- **Zod** (sunucu tarafı doğrulama), **Playwright** (e2e)

> Bu Next.js sürümünde API'ler ve dosya yapısı eski sürümlerden farklıdır. Kod
> yazmadan önce `node_modules/next/dist/docs/` içindeki ilgili rehberi oku
> (bkz. `AGENTS.md`).

## Klasör yapısı

| Yol | İçerik |
| --- | --- |
| `src/app` | Sayfalar ve route'lar (Türkçe URL'ler: `/ilanlar`, `/ilan/[slug]`, `/mesajlar`, `/yonetim` …) |
| `src/lib` | Supabase istemcileri, server action'lar (`actions/`), doğrulama, CSP, env kontrolü |
| `src/components` | UI bileşenleri |
| `supabase/migrations` | Veritabanı şeması: `0001` → `0013`, sırayla uygulanır |
| `scripts` | Seed, e2e, güvenlik, integration ve production smoke scriptleri |
| `tests` | Unit testler (`node --test`) |
| `docs` | Production deployment rehberi ve launch checklist |

## Yerel kurulum

Gereksinimler: Node.js 24+ ve bir **development** Supabase projesi.

```bash
npm ci
cp .env.example .env.local        # değerleri development projesinden doldur
```

1. Development projesinin SQL Editor'ünde `supabase/migrations/0001` → `0013`'ü
   sırayla çalıştır. Repodaki dosyaları kullan; bir dosya hata verirse dur.
2. Demo veri istersen `.env.local`'e aşağıdakileri ekle ve `npm run seed`
   çalıştır. Seed demo kullanıcıları siler ve yeniden oluşturur:
   - `SUPABASE_SECRET_KEY`
   - `SEED_PASSWORD`
   - `ALLOW_DESTRUCTIVE_TESTS=1`
   - `DEV_SUPABASE_PROJECT_REF=<dev ref>`
3. Sunucuyu başlat: `npm run dev` → http://localhost:3000

### Ortam değişkenleri

- Yerel: [`.env.example`](.env.example)
- Production: [`.env.production.example`](.env.production.example)

Zorunlu olanlar:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SITE_URL`

Production build, bu değişkenler eksik veya hatalıysa ya da bir `NEXT_PUBLIC_`
değişkeninde secret anahtar varsa durur. `.env*` dosyaları commit edilmez;
yalnızca iki şablon repodadır.

## Komutlar

| Komut | Açıklama | Veri yazar mı? |
| --- | --- | --- |
| `npm run dev` / `build` / `start` | Geliştirme sunucusu, production build, production sunucusu | – |
| `npm run lint` | ESLint | – |
| `npm run typecheck` | `tsc --noEmit` | – |
| `npm test` | Unit testler | – |
| `npm run security` | `security:p0` + `security:p1`: RLS, yetki, moderasyon, hız sınırı ve kötüye kullanım senaryoları | **evet (dev)** |
| `npm run security:p0` / `security:p1` | Güvenlik testlerini ayrı ayrı çalıştırır | **evet (dev)** |
| `npm run integration` | Sohbet sayfalama ve gelen kutusu | **evet (dev)** |
| `npm run e2e` | Tarayıcıyla uçtan uca akış. Çalışan bir sunucu gerekir (`E2E_BASE_URL`, varsayılan localhost:3000). | **evet (dev)** |
| `npm run responsive` | Ekran görüntüleri ve taşma kontrolü (demo hesabı) | – (yalnızca dev) |
| `npm run seed` | Demo veriyi sıfırlar | **evet (dev)** |
| `npm run smoke` / `smoke:local` | Production smoke testi. **Salt okuma, production'da güvenli.** | hayır |

"Veri yazar" diye işaretli scriptler `scripts/lib/dev-guard.mjs` ile korunur.
Yalnızca şu koşulların hepsi sağlanırsa çalışırlar; aksi halde veritabanına
bağlanmadan çıkarlar:

- `ALLOW_DESTRUCTIVE_TESTS=1`
- Supabase proje ref'i `DEV_SUPABASE_PROJECT_REF` ile aynı
- `NEXT_PUBLIC_SITE_URL` localhost
- ortam production değil

Yazdıkları test verisini kendileri temizler.

## Güvenlik

- **Veritabanı kuralları:** Tüm tablolarda RLS açık. Kritik kolonlar tetikleyicilerle
  kilitli. Hız sınırları ve girdi kısıtları veritabanında da uygulanır.
  Ayrıntılar migration dosyalarının başındaki açıklamalarda.
- **CSP ve başlıklar:**
  - Her istekte nonce'lu CSP (`src/lib/csp.ts`, `src/proxy.ts`)
  - Güvenlik başlıkları `next.config.ts`'te
  - Açık yönlendirme koruması `src/lib/safeRedirect.ts`'te
- **Güvenlik testleri:** `npm run security` saldırı senaryolarını development
  veritabanına karşı gerçek API üzerinden dener:
  - başkasının ilanını ve verisini değiştirme veya okuma
  - admin işlemleri
  - Storage klasörleri
  - hız sınırları
  - kanıt koruma, hesap silme

## Production

- [docs/PRODUCTION_DEPLOYMENT.md](docs/PRODUCTION_DEPLOYMENT.md):
  - env
  - migration sırası ve doğrulama sorgusu
  - Supabase Auth/Storage/backup checklist'i
  - AdSense/CMP
  - hesap silme davranışı
- [docs/LAUNCH_CHECKLIST.md](docs/LAUNCH_CHECKLIST.md): adım adım launch sırası ve
  manuel launch testi

Google AdSense, sertifikalı bir CMP kurulup `NEXT_PUBLIC_ADSENSE_CMP_READY=1`
yapılana kadar kapalıdır.
