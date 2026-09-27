# Production deployment

Bu rehber, Kıbrıs İkinci El web uygulamasını (Next.js + Supabase) production'a
güvenli biçimde çıkarmak için gereken adımları anlatır. Kısa sıra için
[LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md) dosyasına bak.

**MANUAL** ile işaretli adımlar Supabase, Google veya hosting panelinde elle
yapılır. Repo bu adımları otomatik yapmaz.

---

## 1. Temel kurallar

- Production için **yeni ve boş** bir Supabase projesi aç. Development projesini
  (demo kullanıcılar, demo ilanlar, test verisi) production olarak **kullanma**,
  kopyalama ya da taşıma.
- Production veritabanında `npm run seed`, `npm run e2e`, `npm run security`,
  `npm run integration` ve `npm run responsive` **asla** çalıştırılmaz. Bu
  scriptler veri yazar veya siler; ayrıntılar için bkz. [§ 5](#5-production-verisi-ve-scriptler).
- Production'da çalıştırılabilecek tek test `npm run smoke`'tur. Salt okumadır;
  bkz. [§ 8](#8-production-smoke-test).
- Gerçek anahtarlar ve şifreler repoya girmez. `.env*` dosyaları `.gitignore`
  içindedir; yalnızca `.env.example` ve `.env.production.example` şablonları
  commit edilir.

---

## 2. Ortam değişkenleri

Tam şablon: [`.env.production.example`](../.env.production.example). Değerleri
hosting sağlayıcısının environment ayarlarına gir. **MANUAL**

| Değişken | Zorunlu | Açıklama |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | evet | Production Supabase projesinin `https://<ref>.supabase.co` adresi |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | evet | `sb_publishable_…` anahtarı. Tarayıcıya gider. Secret/service_role anahtar girilirse build hata verir. |
| `NEXT_PUBLIC_SITE_URL` | evet | `https://alan-adin` (yol yok, sonda `/` yok). Canonical, sitemap, robots ve auth e-posta linkleri bundan üretilir. |
| `NEXT_PUBLIC_CONTACT_EMAIL` | hayır | Yasal sayfalarda gösterilen iletişim adresi |
| `NEXT_PUBLIC_AUTH_GOOGLE` | hayır | `1` = Google ile giriş. Önce § 6'daki OAuth ayarları yapılmalı. |
| `NEXT_PUBLIC_AUTH_PHONE` | hayır | `1` = SMS ile giriş. SMS sağlayıcısı gerekir, varsayılan `0`. |
| `NEXT_PUBLIC_ADSENSE_CLIENT`, `…_SLOT_*` | hayır | AdSense. Bkz. § 9. |
| `NEXT_PUBLIC_ADSENSE_CMP_READY` | evet (`0`) | CMP kurulup test edilene kadar **`0`** kalmalı. |

Production'da **tanımlanmaması** gerekenler:

- `SUPABASE_SECRET_KEY`: Çalışan site hiçbir server secret'a ihtiyaç duymaz; bu
  anahtarı yalnızca yerel seed/test scriptleri kullanır.
- `SEED_PASSWORD`, `ALLOW_DESTRUCTIVE_TESTS`, `DEV_SUPABASE_PROJECT_REF`

Build ve çalışma zamanı doğrulaması (`src/lib/envCheck.ts`) şöyle davranır:

- Production build'de Supabase URL/anahtar veya `NEXT_PUBLIC_SITE_URL` eksik ya da
  hatalıysa build durur. `NEXT_PUBLIC_SITE_URL` localhost dışında `https` olmalıdır.
- Secret veya service_role anahtar bir `NEXT_PUBLIC_` değişkenine girilmişse her
  ortamda hata verir.
- Hata mesajları değerleri değil, yalnızca değişken adlarını içerir.

---

## 3. Supabase migration'ları (0001 → 0015)

SQL'i bu dokümandan değil, **repodaki dosyalardan** çalıştır:
`supabase/migrations/`. Her dosyayı açıp tüm içeriğini kopyala, Supabase
**SQL Editor → New query** içine yapıştır ve **Run**'a bas. **MANUAL**

Başlamadan önce tarayıcı adres çubuğunda **production** projesinin ref'ini gör
(`…/project/<production-ref>/…`). Development ref'ini görüyorsan dur.

- Sıra zorunludur: her dosya bir öncekine dayanır.
- Beklenen çıktı: `Success. No rows returned`.
- **Bir dosya hata verirse sonrakine geçme.** Hata metnini kaydet ve sorunu
  çözmeden devam etme. Her dosya tek transaction olarak çalışır; hata alan dosya
  geri alınır.
- Boş bir projede hiçbir migration veri silmez. "Yapısal" etiketi, mevcut
  tabloların kolon, kısıt, FK veya policy'lerini değiştirdiğini gösterir.

| # | Dosya | Amaç | Yapısal |
| --- | --- | --- | --- |
| 0001 | `0001_init.sql` | Tüm şema: tablolar, RLS policy'leri, tetikleyiciler, bildirimler, `listing-images` ve `avatars` bucket'ları, Storage policy'leri, Realtime (messages), kategori listesi. **Yalnızca boş projede bir kez** çalıştırılır. | evet (ilk kurulum) |
| 0002 | `0002_remove_packages.sql` | Kullanılmayan paket (ödeme) tablosunu kaldırır. | evet |
| 0003 | `0003_oauth_profiles.sql` | Google ile kayıtta ad ve avatarı sağlayıcıdan alır. | hayır |
| 0004 | `0004_revoke_notify_rpc.sql` | `notify()` fonksiyonunu anon ve authenticated için kapatır (sahte bildirim engeli). | izin |
| 0005 | `0005_protect_conversation_message_listing_fields.sql` | Konuşma, mesaj ve ilanlarda sunucunun yönettiği kolonları kilitler. | tetikleyici |
| 0006 | `0006_secure_meeting_confirmation_and_ratings.sql` | İki taraflı buluşma onayı; puan ancak iki onaydan sonra verilir; sunucu zaman damgası. | evet |
| 0007 | `0007_reset_phone_verification_on_change.sql` | Telefon değişince doğrulama bayrağı sıfırlanır. | tetikleyici |
| 0008 | `0008_moderation_integrity.sql` | İçeriği değişen ilan yeniden incelemeye düşer; kısıtlı kullanıcıların ilanı gizlenir ve işlemleri engellenir. | policy |
| 0009 | `0009_input_limits_and_validation.sql` | CHECK kısıtları, ilan başına 10 fotoğraf, satıcı başına 50 açık / günde 10 yeni ilan sınırı. | evet (kısıtlar) |
| 0010 | `0010_rate_limits.sql` | Mesaj, sohbet, şikayet, doğrulama, destek ve WhatsApp için sunucu tarafı hız sınırları (HTTP 429). | evet (yeni tablo) |
| 0011 | `0011_preserve_abuse_evidence.sql` | Şikayet ve yaptırım kayıtları silinmeye dayanıklı hale gelir (snapshot, FK `SET NULL`); mükerrer ve kendine şikayet engellenir. | **evet (FK, NOT NULL)** |
| 0012 | `0012_account_deletion_privacy.sql` | Hesap veya ilan silinince karşı tarafın konuşması korunur (FK `SET NULL`); destek e-postası anonimleşir. | **evet (FK, NOT NULL)** |
| 0013 | `0013_idempotent_listing_creation.sql` | Atomik ve tekrar denenebilir `create_listing` RPC'si; fotoğraf yolu sahibin klasöründe olmalı. | evet (kolon, index) |
| 0014 | `0014_realtime_admin_details_stores.sql` | Bildirimler Realtime'a eklenir; yönetici her kullanıcıyı/ilanı düzenleyip silebilir (`admin_delete_user`); ilan ek bilgileri (`listings.details`); mağaza hesapları (`profiles.account_type`, `store_*`). **Uygulama kodu bu migration'dan önce deploy edilmemeli.** | evet (kolon, policy, fonksiyon) |
| 0015 | `0015_listing_whatsapp_flag.sql` | `listing_accepts_whatsapp()`: ilan sayfası, numarayı göstermeden satıcının WhatsApp'a açık olup olmadığını öğrenir; kapalıysa buton gizlenir. | hayır (fonksiyon) |

### Migration sonrası doğrulama (salt okuma) **MANUAL**

SQL Editor'de çalıştır:

```sql
select
  (select count(*) from pg_tables where schemaname = 'public' and not rowsecurity) as tables_without_rls,
  has_function_privilege('anon', 'public.notify(uuid, text, text, text, text)', 'execute') as anon_notify,
  has_function_privilege('authenticated', 'public.notify(uuid, text, text, text, text)', 'execute') as authenticated_notify,
  has_function_privilege('authenticated', 'public.reset_phone_verification()', 'execute') as authenticated_reset_phone,
  has_function_privilege('authenticated', 'public.report_target_snapshot(uuid, uuid)', 'execute') as authenticated_report_snapshot,
  has_function_privilege('authenticated', 'public.enforce_rate_limit()', 'execute') as authenticated_rate_limit_trigger,
  has_function_privilege('anon', 'public.create_listing(uuid, text, text, text, numeric, text, text, text, text, boolean, text[])', 'execute') as anon_create_listing,
  has_function_privilege('authenticated', 'public.create_listing(uuid, text, text, text, numeric, text, text, text, text, boolean, text[])', 'execute') as authenticated_create_listing,
  (select count(*) from storage.buckets where id in ('listing-images', 'avatars') and public) as public_image_buckets,
  (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'
     and policyname in ('public read images', 'users upload to own folder', 'users update own files', 'users delete own files')) as storage_policies,
  (select count(*) from public.categories) as categories,
  (select count(*) from public.profiles) as profiles,
  exists (select 1 from pg_proc where proname = 'is_sanctioned') as m0008,
  exists (select 1 from pg_constraint where conname = 'listings_title_trimmed') as m0009,
  exists (select 1 from pg_class where relname = 'rate_limit_events') as m0010,
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'reports' and column_name = 'target_snapshot') as m0011,
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'messages' and column_name = 'sender_id' and is_nullable = 'YES') as m0012,
  exists (select 1 from pg_proc where proname = 'create_listing') as m0013;
```

Beklenen sonuç (boş proje):

| Sütun | Beklenen |
| --- | --- |
| `tables_without_rls` | `0` |
| `anon_notify`, `authenticated_notify` | `false` |
| `authenticated_reset_phone`, `authenticated_report_snapshot`, `authenticated_rate_limit_trigger` | `false` |
| `anon_create_listing` | `false` |
| `authenticated_create_listing` | `true` |
| `public_image_buckets` | `2` |
| `storage_policies` | `4` |
| `categories` | `9` |
| `profiles` | `0` (seed çalıştırılmadı) |
| `m0008` … `m0013` | hepsi `true` |

Bu sorgu, Supabase varsayılan yetkilerini taklit eden boş bir veritabanında
0001-0013'ün uygulanmasıyla denendi.

### Migration'ların bıraktığı önemli davranışlar

- **RLS** tüm `public` tablolarında açıktır. Kullanıcı yalnızca kendi özel
  verisini okur; admin işlemleri `is_admin()` ile korunur.
- **İstemciye kapalı SECURITY DEFINER fonksiyonlar:** `notify`,
  `reset_phone_verification`, `listing_images_moderation`, `enforce_rate_limit`,
  `guard_report_insert`, `report_target_snapshot`, `sanction_subject`.
  Bunları yalnızca tetikleyiciler çağırır.
- **İstemcinin çağırdığı RPC'ler** yetkiyi kendi içinde kontrol eder:
  - `send_announcement` yalnızca admin içindir.
  - `get_listing_whatsapp` giriş ister ve saatte 30 kez ile sınırlıdır.
  - `delete_my_account` yalnızca çağıranın hesabını siler; hesap kısıtlıysa reddeder.
  - `create_listing` yalnızca authenticated kullanıcılar içindir.
- **Hız sınırları** (0009/0010): aşılınca PostgREST HTTP 429 döner. Admin ve
  service role muaftır.
- **İlk admin hesabı:** Sitede normal kayıt ol, sonra SQL Editor'de
  `update public.profiles set role = 'admin' where id = (select id from auth.users where email = '<admin e-postası>');`
  sorgusunu çalıştır. Kullanıcılar kendi `role` alanını değiştiremez. **MANUAL**

---

## 4. Supabase production checklist (MANUAL)

### Auth

- [ ] **Site URL** = `https://<alan-adin>` (Authentication → URL Configuration)
- [ ] **Redirect URLs** allowlist'inde **yalnızca** `https://<alan-adin>/auth/callback**`
  bulunmalı. Kayıt onayı, şifre sıfırlama, e-posta değişikliği ve Google girişi
  hep bu callback'e gelir. localhost veya development adresleri **ekleme**.
- [ ] **Confirm email** açık (Authentication → Providers → Email)
- [ ] **Auth rate limits** gözden geçirilmiş: e-posta gönderimi, OTP ve giriş
  denemeleri (Authentication → Rate Limits). Uygulamadaki hız sınırları giriş ve
  kaydı kapsamaz.
- [ ] Gerekiyorsa **CAPTCHA** (hCaptcha/Turnstile) açık
- [ ] SMTP: production e-postaları için özel SMTP sağlayıcısı tanımlı.
  Supabase'in varsayılan SMTP'si düşük limitlidir.
- [ ] E-posta şablonlarındaki linkler Site URL'e gidiyor

### Google OAuth (Google ile giriş açılacaksa)

- [ ] Google Cloud Console → OAuth client → **Authorized redirect URI** =
  `https://<production-ref>.supabase.co/auth/v1/callback`
- [ ] Supabase → Authentication → Providers → Google: client id/secret girilmiş
- [ ] OAuth consent screen: uygulama adı, alan adı, gizlilik ve koşullar linkleri
- [ ] Ancak bunlardan sonra `NEXT_PUBLIC_AUTH_GOOGLE=1`

### Database

- [ ] 0001-0013 sırayla uygulandı ve § 3'teki doğrulama sorgusu beklenen sonucu verdi
- [ ] RLS tüm tablolarda açık (`tables_without_rls = 0`)
- [ ] `notify` anon ve authenticated için kapalı
- [ ] İstemciye kapalı definer fonksiyonların izinleri `false`
- [ ] `create_listing` yalnızca authenticated için açık
- [ ] **Seed çalıştırılmadı** (`profiles = 0` ilk kullanıcıdan önce)
- [ ] İlk admin rolü elle verildi

### Storage

- [ ] `listing-images` bucket'ı: public okuma, en fazla 8 MB, `image/jpeg`, `image/png`, `image/webp`
- [ ] `avatars` bucket'ı: public okuma, en fazla 2 MB, aynı MIME türleri
- [ ] `storage.objects` üzerinde 0001'deki 4 policy var:
  - herkes okur
  - kullanıcı yalnızca `<kendi id>/` klasörüne yükler, günceller ve siler
- [ ] Bucket'lar public olduğu için dosya adları tahmin edilemez UUID'dir;
  hassas belge yüklenmez.

### Backup ve izleme

- [ ] Plan dahilinde günlük yedek açık; mümkünse **PITR** (Point-in-Time Recovery)
- [ ] Bir yedekten geri dönüş denemesi (ayrı projeye) planlandı
- [ ] Hosting tarafında hata ve log izleme, uptime kontrolü

---

## 5. Production verisi ve scriptler

| Script | Ne yapar | Production |
| --- | --- | --- |
| `npm run seed` | Demo kullanıcıları ve ilanları siler, yeniden oluşturur | **YASAK** |
| `npm run e2e` | Tarayıcıyla uçtan uca akış; ilan, mesaj ve puan yazar ve siler | **YASAK** |
| `npm run security` (`security:p0` + `security:p1`) | Saldırı senaryoları; geçici hesap ve satır yazar ve siler | **YASAK** |
| `npm run integration` | Test konuşması yazar ve siler | **YASAK** |
| `npm run responsive` | Demo hesabıyla giriş yapar | **YASAK** |
| `npm run smoke` | Salt okuma kontrolleri | izinli |

Veritabanına yazan tüm scriptler `scripts/lib/dev-guard.mjs` ile korunur ve şu
koşulların **hepsi** sağlanmadan veritabanına bağlanmadan çıkar (exit 2):

1. `ALLOW_DESTRUCTIVE_TESTS=1`
2. Supabase proje ref'i `DEV_SUPABASE_PROJECT_REF` ile aynı
3. `NEXT_PUBLIC_SITE_URL` localhost
4. `NODE_ENV` / `VERCEL_ENV` production değil

`tests/dev-guard.test.mjs` bu scriptlerin her birini üç production benzeri
ortamla gerçekten başlatır ve hepsinin reddettiğini doğrular. Test hiçbir gerçek
sunucuya bağlanmaz.

Development'taki demo kullanıcılar (`@demo.kibrisikinciel.test`), demo ilanlar
ve test verisi production'a **taşınmaz**.

---

## 6. Build ve deploy

1. Hosting sağlayıcısında § 2'deki değişkenleri gir. **MANUAL**
2. `npm ci && npm run build`. Env hatalıysa build durur.
3. `npm run start` ile ya da sağlayıcının Next.js desteğiyle çalıştır.
4. Alan adını bağla. HTTPS zorunlu. HSTS, `NEXT_PUBLIC_SITE_URL` https olduğunda
   otomatik eklenir. **MANUAL**

Build öncesi yerel kontroller: `npm test`, `npm run typecheck`, `npm run lint`,
`npm audit`.

---

## 7. Güvenlik başlıkları ve CSP

- CSP her istekte yeni bir nonce ile `src/proxy.ts` içinde üretilir
  (`src/lib/csp.ts`).
  - `script-src`: yalnızca nonce'lu scriptler ve `'strict-dynamic'`.
    `'unsafe-inline'` yok; `'unsafe-eval'` yalnızca development'ta.
  - `connect-src` Supabase https/wss adresini, `img-src` Supabase Storage'ı ve
    Google avatarlarını içerir.
  - `form-action` Supabase'i ve `accounts.google.com`'u (Google OAuth) içerir.
  - `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`.
  - JSON-LD blokları çalıştırılmaz, nonce gerekmez.
  - AdSense alan adları yalnızca `NEXT_PUBLIC_ADSENSE_CMP_READY=1` iken eklenir.
- Statik başlıklar (`next.config.ts`):
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy`
  - HSTS (yalnızca production ve https)
  - `X-Powered-By` kapalı
- Bilinen konular (P2, blocker değil):
  - `style-src 'unsafe-inline'`: UI React `style` özelliklerini kullandığı için
    kaldı. Script enjeksiyonuna izin vermez.
  - Nonce CSP nedeniyle HTML sayfaları statik önbelleğe alınmaz.

---

## 8. Production smoke test

`scripts/production-smoke.mjs`: **production'da güvenle çalıştırılabilir, salt
okuma.**

- Giriş yapmaz, satır yazmaz veya silmez, dosya yüklemez, bildirim üretmez.
- Giriş denemesi veya WhatsApp sorgusu yapmadığı için hız sınırı tüketmez.
- Secret anahtar kullanmaz.

```bash
# production env değişkenleri ortamda tanımlıyken:
npm run smoke
# ya da yerel bir dosyadan (commit edilmez):
node --env-file=.env.production.local scripts/production-smoke.mjs
# farklı bir adresi test etmek için:
SMOKE_BASE_URL=https://alan-adin npm run smoke
```

Kontroller:

- Env geçerliliği ve `ALLOW_DESTRUCTIVE_TESTS` kapalı olması
- Ana sayfa, ilanlar, arama ve yasal sayfalar 200; bilinmeyen sayfa 404
- Güvenlik başlıkları ve CSP; her scriptte nonce
- Canonical adres, `robots.txt`, `sitemap.xml`, `manifest.webmanifest`
- Anonim kullanıcının `/hesabim`, `/mesajlar`, `/ilan-ver`, `/yonetim`
  sayfalarından girişe yönlendirilmesi
- Supabase anonim okuma (kategoriler, yayındaki ilanlar)
- Özel tabloların anonim kullanıcıya kapalı olması
- Oturumsuz `create_listing` ve `delete_my_account` çağrılarının reddi
- İlan sayfasındaki JSON-LD (`Product`)
- CMP kapalıyken AdSense scriptinin olmaması

Yayında ilan yoksa ilan sayfası kontrolü atlanır.

---

## 9. Google AdSense ve CMP

Reklamlar varsayılan olarak **kapalıdır**:

- `NEXT_PUBLIC_ADSENSE_CMP_READY=1` olmadan reklam scripti, reklam alanları ve
  reklam CSP alan adları devreye girmez.
- Yalnızca `NEXT_PUBLIC_ADSENSE_CLIENT` girilirse site incelemesi için meta
  etiketi ve `/ads.txt` yayınlanır.

Açma sırası (hepsi **MANUAL**):

1. AdSense'te Google sertifikalı bir **CMP** kur (Privacy & messaging → GDPR/EEA
   onay mesajı) ve yayınla.
2. Onay davranışını test et:
   - Onay vermeden reklam çerezi yazılmıyor.
   - Reddetme ve geri alma çalışıyor.
   - AEA/UK ziyaretçisi olarak da dene.
3. `NEXT_PUBLIC_ADSENSE_CLIENT` ve slot id'lerini production env'e gir, yeniden
   deploy et.
4. **En son** `NEXT_PUBLIC_ADSENSE_CMP_READY=1` yap, yeniden deploy et ve
   `npm run smoke` çalıştır. Reklam kontrolü "açık" olmalı.

CMP kurulmadan reklamları production'da açma.

---

## 10. Hesap silme ve veri davranışı (0012 sonrası)

Kullanıcı Ayarlar → "Hesabımı sil" dediğinde (`src/lib/accountDeletion.ts` →
`delete_my_account`) şunlar olur:

- Hesap kısıtlı veya askıdaysa işlem **reddedilir**. Kullanıcı destek talebiyle
  itiraz edebilir.
- Storage'da `listing-images/<id>/` ve `avatars/<id>/` altındaki tüm dosyalar
  silinir. Bu adım başarısız olursa hesap silinmez; kullanıcı tekrar dener.
- Şunlar kalıcı olarak silinir:
  - auth hesabı, profil ve özel iletişim bilgileri (e-posta, telefon)
  - ilanlar ve fotoğraf kayıtları
  - favoriler, bildirimler, engellemeler, doğrulama talepleri
  - verdiği ve aldığı değerlendirmeler, hız sınırı kayıtları
- Kullanıcının destek taleplerindeki e-posta adresi anonimleştirilir. Aynı
  adresle anonim açılmış talepler de buna dahildir. Talep metni saklanır.
- Karşı tarafın konuşması ve mesajları, iletişim geçmişi ve olası dolandırıcılık
  kanıtı olarak **korunur**:
  - silinen kişinin kimlik alanları (`buyer_id`/`seller_id`, `sender_id`,
    silinen ilanın `listing_id`'si) `NULL` olur
  - karşı taraf "Silinmiş kullanıcı" görür ve o konuşmaya yeni mesaj gönderilemez
- Hesap veya ilan hakkındaki şikayetler ve yaptırım geçmişi silinmez:
  - şikayet anındaki ilan bilgisinin kopyası saklanır
  - kimlik alanları `NULL` olur, yaptırımda `subject_user_id` kalır

Gizlilik bildirimi (`/gizlilik`), koşullar, yardım ve ayarlar sayfasındaki
metinler bu davranışa göre yazılmıştır. Bu doküman teknik davranışı anlatır;
hukuki uyumluluk değerlendirmesi değildir.

---

## 11. Launch sonrası manuel test

[LAUNCH_CHECKLIST.md → Manuel launch testi](LAUNCH_CHECKLIST.md#manuel-launch-testi)
