# Mimari

Kıbrıs İkinci Elcim v2, Supabase'in yerini alan, tamamen bize ait bir yığın
üzerinde çalışır: tek bir VDS üzerinde Docker ile **Next.js web**, **Fastify
API** ve **PostgreSQL 17**; önlerinde host üzerinde çalışan **Caddy**.

```
                 İnternet (80/443)
                        │
                ┌───────▼────────┐  host: TLS, HTTP/3, sıkıştırma, erişim logu
                │     Caddy      │
                └─┬─────┬──────┬─┘
        /api/*    │     │      │  /media/*  (diskten doğrudan, değişmez önbellek)
   (WebSocket     │     │ else │
    dahil)        │     │      └──────────► /srv/kibrisikincielcim/uploads
       127.0.0.1:4100   127.0.0.1:3100
          ┌───────▼─┐  ┌▼────────┐
          │   api   │◄─┤   web   │  SSR sırasında http://api:4000 (iç ağ)
          │ Fastify │  │ Next.js │
          └────┬────┘  └─────────┘
               │ ağ "db" (internal: dışarı rota yok, port yayınlanmaz)
          ┌────▼─────┐
          │ Postgres │  veri: /srv/kibrisikincielcim/data/postgres
          └──────────┘
```

* Tarayıcı her şeyi **tek origin** üzerinden görür (`/api`, `/media`, sayfalar).
  CORS hiç açılmaz; oturum çerezleri `SameSite=Lax`, `HttpOnly`, `Secure`.
* Mobil uygulama (gelecek) aynı API'yi `Authorization: Bearer` ile kullanır.
* `/srv/gezeceyik-kibris/` başka bir projedir; bu yığın ona dokunmaz, ağı ve
  dizinleri ayrıdır (`kibrisikincielcim-network`, `/srv/kibrisikincielcim`).

## Bileşenler

| Klasör | Ne | Notlar |
|---|---|---|
| `src/` | Next.js 16 web (App Router, `src/proxy.ts`) | Sayfalar sunucuda API'den okur; istemci bileşenleri `/api/v1` çağırır |
| `api/` | Fastify 5 modüler monolit | `src/modules/*`: auth, google, taxonomy, listings, uploads, conversations, users, me, admin, realtime, health |
| `shared/` | Web ve API'nin ortak kodu | sabitler, zod şemaları, özellik (attribute) motoru |
| `db/migrations/` | SQL migration'ları (0001–0006) | `kie_owner` uygular; checksum kaydı tutulur, değişen dosya reddedilir |
| `db/init/` | İlk kurulumda roller ve veritabanı | Şifreler ortamdan gelir |
| `deploy/` | Dockerfile'lar, compose, Caddy, ops scriptleri | bkz. DEPLOYMENT.md, BACKUP_RESTORE.md |
| `migration/` | Supabase → PostgreSQL provası | bkz. MIGRATION.md |

## Kararlar

| # | Karar | Neden |
|---|---|---|
| 1 | Fastify modüler monolit | 6 GB RAM'li kutuda düşük bellek; web ve mobil tek API |
| 2 | `postgres.js` + elle yazılmış parametreli SQL, ORM yok | Güvenlik modeli tetikleyici/RLS/kısıtlarda; ORM bunu gizlerdi |
| 3 | RLS ve guard tetikleyicileri Supabase'ten birebir taşındı | API kontrollerinin arkasında ikinci savunma hattı |
| 4 | İki rol: `kie_owner` (şema, migration), `kie_app` (çalışma zamanı, RLS uygulanır, DDL yok) | En az yetki |
| 5 | Her istek bir transaction: `app.user_id`, `app.role` (`anon`/`user`/`system`) ayarlanır | Politikalar `app.uid()` ile çalışır |
| 6 | Argon2id; Supabase bcrypt hash'leri ilk girişte doğrulanıp yeniden hash'lenir | Kullanıcılar şifrelerini korur |
| 7 | JWT erişim (15 dk) + dönen opak yenileme anahtarı (yalnız hash saklanır), tekrar kullanımda oturum iptal (20 sn tolerans) | Çalınan yenileme anahtarı işe yaramaz |
| 8 | Realtime: `pg_notify('app_events')` → API `LISTEN` → kullanıcı başına WebSocket | Alıcıları veritabanı hesaplar; istemci başkasının kanalına abone olamaz |
| 9 | Görseller: sharp ile çöz → WebP sm/md/lg, EXIF/GPS silinir, orijinal saklanmaz | Disk sınırlı, güvenli; `ObjectStore` arayüzü S3'e hazır |
| 10 | Kategori ağacı; özellik tanımları ilişkisel (miras, override, gizleme); değerler JSONB + GIN | Boş kolon yığını olmadan büyür |
| 11 | Arama: katlanmış (`search_text`) kolon + pg_trgm | Redis/Elastic yok; bu ölçekte yeterli |
| 12 | Kuyruk/Redis yok; periyodik işler API içinde (`jobs.ts`) | Basitlik; tek API süreci |

## Veri modeli (özet)

* `auth.users` (e-posta, hash, doğrulama), `auth.identities` (Google),
  `auth.sessions` / `auth.refresh_tokens` / `auth.one_time_tokens` / `auth.attempts`
* `profiles` (herkese açık), `profile_private` (telefon; yalnız sahibi ve admin)
* `categories` (ağaç), `category_attributes`, `regions`
* `listings` (+ `attributes` JSONB, `search_text`), `listing_images`, `uploads`
* `favorites`, `blocks`, `conversations`, `messages`, `ratings`
* `reports`, `sanctions`, `verification_requests`, `notifications`,
  `announcements`, `support_tickets`, `admin_audit_log`, `rate_limit_events`

İş kuralları veritabanındadır (Supabase'teki gibi): ilan kotası, fotoğraf
sınırı, moderasyon durumu, buluşma onayı ve değerlendirme koşulları, mesaj
kısıtları, oran sınırları. API bunları ayrıca kontrol eder; veritabanı son
sözdür.

## İstek akışı

1. Caddy isteği alır. `/api/*` API'ye, `/media/*` diske, gerisi Next'e gider.
2. Next sayfası sunucuda `API_INTERNAL_URL` (http://api:4000) üzerinden okur;
   tarayıcının IP'sini `x-kie-internal` + `x-kie-client-ip` başlıklarıyla iletir
   (yalnızca `INTERNAL_API_TOKEN` doğruysa güvenilir).
3. API: istek kimliği → istemci IP → CSRF kontrolü → oturum çözümü → IP başı
   genel sınır (600 istek / 5 dk) → modül → transaction içinde SQL (RLS).
4. Yazma olayları tetikleyicilerle `pg_notify` üretir; API ilgili kullanıcıların
   WebSocket'lerine iletir (mesaj, okundu, sohbet, bildirim).

## Periyodik işler (API içinde)

| Sıklık | İş |
|---|---|
| 30 dk | Sahipsiz yüklemeleri temizle |
| 60 dk | Eski giriş denemelerini sil |
| 6 saat | Süresi dolmuş oturumları ve tek kullanımlık anahtarları sil |

Yedekler ve sağlık kontrolü host üzerinde systemd zamanlayıcılarıyla çalışır
(bkz. BACKUP_RESTORE.md).

## Kaynak bütçesi

| Servis | Bellek sınırı |
|---|---|
| db | 1 GB (`shared_buffers=256MB`) |
| api | 512 MB |
| web | 768 MB |

Toplam ≈ 2,3 GB; kutudaki diğer proje için yer bırakır.
