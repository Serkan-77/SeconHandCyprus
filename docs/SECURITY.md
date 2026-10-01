# Güvenlik

Bu belge v2 yığınının (Next.js + Fastify API + PostgreSQL, VDS üzerinde)
güvenlik modelini ve bunu doğrulayan testleri anlatır. Bir açık bulursan
herkese açık bir kanal yerine doğrudan proje sahibine yaz.

## Ağ ve sunucu

* Dışarıya yalnızca **Caddy** açıktır (80/443). UFW'de yalnız 22/80/443 açık
  olmalıdır (kurulumda `ufw status` ile doğrulanır, bkz. DEPLOYMENT.md);
  Fail2Ban SSH'ı korur. Docker'ın yayınladığı portlar UFW'yi atlar; bu yüzden
  uygulama portları yalnız `127.0.0.1`'e bağlanır.
* `web` ve `api` yalnızca `127.0.0.1`'e yayınlanır (3100, 4100).
* **PostgreSQL hiçbir porta yayınlanmaz**; `db` ağı `internal: true` (dışarı
  rota yok). Yalnızca `api` ve `migrate` erişir. Doğrulama: `docker ps` çıktısında
  db için `5432/tcp` (eşleme yok) görünmeli.
* `/health*` uçları Caddy'de 404 döner; yalnız host üzerinden okunur.
* Konteynerler root olmayan `node` kullanıcısıyla çalışır; bellek sınırları
  ve log rotasyonu tanımlıdır.

## Kimlik doğrulama

| Konu | Uygulama |
|---|---|
| Şifre | Argon2id. Supabase'ten gelen bcrypt hash'leri ilk başarılı girişte Argon2id'ye çevrilir |
| Oturum | 15 dk JWT erişim anahtarı + dönen opak yenileme anahtarı; yalnız SHA-256 saklanır |
| Çalıntı yenileme anahtarı | Kullanılmış anahtar tekrar gelirse oturum iptal edilir (eşzamanlı sekmeler için 20 sn tolerans) |
| Web | `kie_at` / `kie_rt` çerezleri: `HttpOnly`, `Secure`, `SameSite=Lax` |
| Mobil | `{"client":"mobile"}` → anahtarlar gövdede; `Authorization: Bearer` |
| E-posta doğrulama / şifre sıfırlama | Tek kullanımlık, hash'li, süreli anahtarlar; yeni istek eskileri geçersiz kılar |
| Şifre sıfırlama | Tüm oturumları kapatır ve "şifren değişti" e-postası gönderir |
| Hesap sayımı (enumeration) | Kayıt, sıfırlama ve yeniden gönderme kayıtlı/kayıtsız adres için aynı yanıtı verir |
| Kaba kuvvet | IP başına ve e-posta başına sınırlar (`auth.attempts`), bilinmeyen hesapta da sabit süreli kontrol |
| Google ile giriş | Yetkilendirme kodu + PKCE; durum/nonce imzalı, yola özel kısa ömürlü çerezde; ID token Google anahtarlarıyla doğrulanır (issuer, audience, nonce, süre, `email_verified`). Hiç doğrulanmamış bir hesaba bağlanırken o hesabın şifresi silinir ve bekleyen bağlantıları geçersiz olur (pre-hijack) |

## Yetkilendirme

* Her API isteği bir transaction içinde `kie_app` rolüyle çalışır ve
  `app.user_id` / `app.role` ayarlanır. **Satır düzeyi güvenlik (RLS)** tüm
  kullanıcı tablolarında açıktır; politikalar Supabase'tekilerin birebir
  karşılığıdır.
* Guard tetikleyicileri, istemcinin değiştirmemesi gereken alanları korur
  (ilan durumu, satıcı, buluşma onayı, değerlendirme koşulları, mesaj gönderen).
* Admin işlemleri hem API'de (`role = 'admin'`) hem veritabanında kontrol edilir
  ve `admin_audit_log`'a yazılır.
* `profile_private` (telefon) yalnız sahibine ve admine görünür; e-posta yalnız
  `auth.users`'tadır. WhatsApp numarası sadece ilan sahibi izin verdiyse,
  oturum açmış kullanıcıya ve oran sınırıyla verilir.

## CSRF ve istekler

* Çerezle kimliği doğrulanan her yazma isteği `X-KIE-CSRF: 1` başlığı taşımalı ve
  `Origin` izinli listede olmalı (`SITE_URL` + `EXTRA_ORIGINS`). Basit bir HTML
  formu bu başlığı ekleyemez. Bearer istekleri çerez kullanmadığı için muaftır.
* WebSocket: çerezle bağlanılıyorsa `Origin` kontrol edilir; mobil istemci ilk
  mesajda anahtar gönderir. En büyük mesaj 4 KB; istemci yalnız dinler.
* IP başına genel sınır: 600 istek / 5 dk. İş sınırları (ilan, mesaj, şikayet,
  destek, doğrulama talebi…) veritabanında `rate_limit_events` ile uygulanır.

## Yüklemeler

* Dosya adına ve bildirilen MIME tipine güvenilmez; libvips ile çözülemeyen
  her şey reddedilir (SVG, HTML, PDF, bozuk dosya). Kabul: JPEG, PNG, WebP, AVIF.
* En fazla 12 MB, 40 megapiksel (sıkıştırma bombası koruması), animasyon yok.
* Çıktı her zaman yeniden kodlanmış WebP (sm/md/lg); EXIF, GPS, XMP silinir;
  orijinal saklanmaz.
* Anahtarlar sunucuda üretilir (`l/YYYY/MM/<uuid>`), regex ile doğrulanır; dizin
  dışına çıkılamaz. Caddy yalnızca bu desene uyan yolları sunar ve
  `nosniff` + `Content-Security-Policy: default-src 'none'; sandbox` ekler.
* İlan fotoğrafı ve avatar yalnızca çağıranın kendi yüklemesi olabilir
  (veritabanı tetikleyicisi).

## Tarayıcı güvenliği

* CSP: istek başına nonce + `strict-dynamic`; `unsafe-inline`/`unsafe-eval`
  yok (script için); `frame-ancestors 'none'`, `object-src 'none'`,
  `base-uri 'self'`, `form-action 'self'`. Supabase alan adları kaldırıldı.
* HSTS (2 yıl, alt alan adları), `X-Frame-Options: DENY`, `nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, kısıtlı `Permissions-Policy`.
* Açık yönlendirme yok: `returnTo` yalnız site içi yollar.

## Gizli bilgiler ve loglar

* Hiçbir gizli bilgi repoda yoktur. Sunucuda `/srv/kibrisikincielcim/.env`
  (`chmod 600`); şablon `deploy/.env.example`.
* `NEXT_PUBLIC_*` değişkenlerine gizli bilgi konursa build hata verir
  (`src/lib/envCheck.ts`).
* Loglarda `authorization`, `cookie`, `set-cookie` ve iç başlık gizlenir; sorgu
  dizeleri loglanmaz; mesaj gövdeleri, şifreler, anahtarlar ve e-posta
  adresleri loglanmaz. Migration araçları kayıtları yalnız id ile anar.
* Yedekler `umask 077` ile yazılır (yalnız root okur).

## Testler

| Paket | Ne doğrular |
|---|---|
| `api/test/auth.test.ts` | kayıt, doğrulama, giriş, yenileme dönüşü ve tekrar kullanım, sıfırlama, sayım, sınırlar, bcrypt → Argon2id |
| `api/test/google.test.ts` | durum/CSRF, nonce, imza anahtarı, audience, PKCE, açık yönlendirme, hesap bağlama, pre-hijack |
| `api/test/listings.test.ts` | RLS ile ilan görünürlüğü, kota, moderasyon, özellik doğrulama, sahiplik |
| `api/test/messaging.test.ts` | sohbet erişimi, engelleme, buluşma onayı, değerlendirme kuralları |
| `api/test/admin.test.ts` | admin yetkisi, yaptırımlar, şikayetler, denetim kaydı |
| `api/test/uploads.test.ts` | tip/boyut/bomba reddi, EXIF silme, yol kaçışı, sahiplik |
| `api/test/realtime.test.ts` | WebSocket kimlik doğrulama, origin, yalnız alıcıya iletim |
| `scripts/production-smoke.mjs` | canlı sitede salt okuma: başlıklar, CSP, 401'ler, CSRF, medya, yönlendirmeler |

Çalıştırma: `npm run test:api` (geliştirme PostgreSQL'i gerekir), `npm test`,
`npm run smoke`.

## Hesap silme ve kanıt koruma

Ayarlar → "Hesabımı sil" (`POST /api/v1/me/delete`, şifreli hesaplarda şifre
onayı istenir) eski sistemdeki davranışın aynısıdır (`delete_my_account`):

* Kısıtlı veya askıdaki hesap kendini silemez (destekten itiraz edebilir).
* Silinir: hesap, profil, iletişim bilgileri, ilanlar ve fotoğrafları (diskten
  de), favoriler, bildirimler, engellemeler, doğrulama talepleri, verdiği ve
  aldığı değerlendirmeler, oran sınırı kayıtları.
* Destek taleplerindeki e-posta anonimleştirilir; talep metni kalır.
* Karşı tarafın sohbetleri ve mesajları **korunur** (olası dolandırıcılık
  kanıtı): silinen kişinin kimlik alanları `NULL` olur, karşı taraf
  "Silinmiş kullanıcı" görür ve o sohbete yazamaz.
* Şikayetler ve yaptırım geçmişi silinmez; şikayet anındaki ilan bilgisinin
  kopyası saklanır.

Bu teknik davranıştır; hukuki uyumluluk değerlendirmesi değildir.
