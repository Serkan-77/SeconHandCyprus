# Supabase → yeni sistem: veri taşıma, canlıya geçiş ve geri dönüş

Bu belge, canlı sitenin (Vercel + Supabase) verisinin VDS üzerindeki yeni
yığına taşınmasını ve alan adının geçişini adım adım anlatır.

**Değişmez kurallar**

* Supabase'teki hiçbir kaynak silinmez. Proje en az 30 gün olduğu gibi kalır
  (geri dönüş ve eski görsel adresleri için).
* DNS, yeni sistem doğrulanmadan ve **açık onay** alınmadan değişmez.
* İçe aktarma Supabase'e **yazmaz**: tek bir `REPEATABLE READ, READ ONLY`
  transaction ile tutarlı bir anlık görüntü okur.

## 1. Neler taşınır

| Veri | Nasıl |
|---|---|
| Hesaplar (`auth.users`) | id, e-posta (küçük harf), doğrulama zamanı, son giriş, oluşturma zamanı; **bcrypt şifre hash'leri olduğu gibi**. İlk girişte Argon2id'ye çevrilir: kullanıcılar aynı şifreyle girer |
| Google bağlantıları | `auth.identities` (Google) → aynı Google hesabıyla doğrudan giriş |
| Profiller, iletişim | aynı id'lerle; `profile_private.email` artık yalnız `auth.users`'ta |
| Kategoriler | yeni kategori ağacı korunur; eski kategoriler **slug ile eşlenir**, yeni ağaçta olmayan admin kategorileri eski id'leriyle eklenir |
| İlanlar | id, ref_no, slug (eski URL'ler aynen çalışır), tüm alanlar ve zamanlar; `details` → `attributes` (anahtarlar uyumlu) |
| Fotoğraflar, avatarlar | Supabase Storage'dan indirilir, API'nin görüntü hattından geçer (WebP sm/md/lg, EXIF silinir); Google avatar adresleri olduğu gibi kalır |
| Favoriler, engellemeler, sohbetler, mesajlar, buluşma onayları, değerlendirmeler, şikayetler, yaptırımlar, doğrulama talepleri, bildirimler, duyurular, destek talepleri | aynı id ve zamanlarla, birebir |

**Taşınmayanlar:** açık oturumlar (herkes bir kez yeniden giriş yapar),
oran sınırı sayaçları, Supabase'in e-postayla gönderdiği eski bağlantılar
(`/auth/callback` bunları anlaşılır bir sayfaya yönlendirir), orijinal
fotoğraf dosyaları (yalnız işlenmiş WebP'ler).

**Yeni kısıtlara uyarlama** (rapora uyarı olarak yazılır): 2 karakterden kısa
görünen ad → "Kullanıcı"; tanınmayan bölge → boş; 5 karakterden kısa yaptırım
gerekçesi → "(eski kayıt)" eki; uzun ret/çözüm notları kısaltılır. Bunlar
dışında yeni şemaya uymayan bir satır içe aktarmayı **durdurur** (tablo ve id
ile), hiçbir şey yazılmaz.

## 2. Araçlar

| Araç | Ne yapar |
|---|---|
| `api/scripts/supabase-import.ts` (`dist/supabase-import.js`) | içe aktarma; `--dry-run` her şeyi yapıp geri alır |
| `api/scripts/supabase-verify.ts` (`dist/supabase-verify.js`) | kaynakla hedefi birincil anahtar ve içerik hash'iyle karşılaştırır (mesaj gövdeleri, ilan metinleri, fiyatlar, şifre hash'leri, buluşma onayları, puanlar, roller), dosyaların diskte olduğunu ve sequence'ları kontrol eder |
| `migration/rehearsal/rehearse.sh` | eski şema + uç durumlu sahte veriyle uçtan uca yerel prova: dry run → içe aktarma → doğrulama → gerçek API ile 23 uygulama kontrolü |
| `deploy/ops/reset-db.sh` | sunucudaki provadan sonra veritabanını boşaltır (önce güvenlik dökümü) |

İçe aktarma işlemi:

1. kaynaktan anlık görüntü
2. görseller (durum dosyası sayesinde kaldığı yerden devam eder; tekrar çalıştırmada işlenmiş görseller yeniden kullanılır)
3. tek transaction'da veri; tetikleyiciler kapalı (`session_replication_role = replica`), çünkü bunlar koruma ve yan etkilerdir (bildirim üretmezler)
4. sequence'lar ileri alınır
5. **veritabanındaki tüm yabancı anahtarlar tek tek doğrulanır**, ancak sonra COMMIT

Hedefte hesap varsa çalışmayı reddeder.

## 3. Yerel prova

```bash
docker compose -f docker-compose.dev.yml up -d
(cd api && npm ci)
bash migration/rehearsal/rehearse.sh
```

Son durum (2026-10-01): **geçti**. 6 hesap, 7 ilan, 7 fotoğraf (1 eksik
dosya ve 1 bozuk dosya raporlandı), tüm tablolar birebir; bcrypt girişi →
Argon2id; eski slug'la ilan; admin kategorisi eşleme; RLS ve değerlendirme
kuralları; admin paneli. Aynı içe aktarma, üretim imajı içinde
(`docker compose run … api node dist/supabase-import.js`) de denendi.

## 4. Gerçek veriyle prova (sunucuda, DNS değişmeden)

Gerekenler:
* Supabase veritabanı bağlantı adresi: Dashboard → Connect → **Session pooler**
  (IPv4), sonuna `?sslmode=require`
* Storage'ın herkese açık adresi: `https://<proje-ref>.supabase.co/storage/v1/object/public`
* Yeni sistem DEPLOYMENT.md §1–5'e göre geçici alan adında çalışıyor

```bash
cd /srv/kibrisikincielcim/app
DC="docker compose -f deploy/docker-compose.yml --env-file /srv/kibrisikincielcim/.env"
sudo mkdir -p /srv/kibrisikincielcim/backups/import && sudo chown 1000:1000 /srv/kibrisikincielcim/backups/import

# Gizli değerler kabuk geçmişine yazılmaz:
read -rs SOURCE_DATABASE_URL; export SOURCE_DATABASE_URL
export TARGET_DATABASE_URL="postgres://postgres:$(sudo grep ^POSTGRES_SUPERUSER_PASSWORD= /srv/kibrisikincielcim/.env | cut -d= -f2-)@db:5432/kibrisikincielcim"
export STORAGE_SOURCE="https://<proje-ref>.supabase.co/storage/v1/object/public"
export IMPORT_STATE=/import/state.json
RUN="$DC run --rm --no-deps -e SOURCE_DATABASE_URL -e TARGET_DATABASE_URL -e STORAGE_SOURCE -e IMPORT_STATE -v /srv/kibrisikincielcim/backups/import:/import api"

$RUN node dist/supabase-import.js --dry-run --report=/import/dry-run.json   # görseller işlenir, veri geri alınır
$RUN node dist/supabase-import.js --report=/import/report.json
$RUN node dist/supabase-verify.js
```

Sonra geçici alan adında admin hesabıyla kontrol: ilan sayıları, birkaç ilan
sayfası ve fotoğraf, bir sohbet, admin paneli. `report.json`'daki uyarıları
oku (eksik/bozuk fotoğraflar, eşlenen kategoriler).

Prova bitince veritabanını boşalt (fotoğraflar ve durum dosyası kalır, final
içe aktarma onları yeniden kullanır):

```bash
sudo bash deploy/ops/reset-db.sh --yes-delete-all-data
```

## 5. Canlıya geçiş (cutover)

Önerilen zaman: trafiğin en düşük olduğu saat. Süre: veri miktarına göre
~30–60 dk, siteye yazma bu sürede kapalıdır.

**T-1 gün**
1. DNS'te `kibrisikincielcim.com` ve `www` kayıtlarının TTL'ini 300 sn'ye indir.
2. Eski sitede duyuru: "<saat>'te birkaç dakikalık bakım".
3. `.env`: `SITE_URL=https://www.kibrisikincielcim.com`,
   `EXTRA_ORIGINS=https://yeni.kibrisikincielcim.com` (geçici alan adı test için
   çalışmaya devam eder), varsa Google değişkenleri; `$DC up -d --build`.
4. Google Cloud OAuth istemcisine yeni yönlendirme adresini ekle (DEPLOYMENT.md §8).
5. Sunucu dışı yedek hedefi hazır mı (BACKUP_RESTORE.md).

**T0 — yazmayı dondur (⚠ Supabase'te geri alınabilir değişiklik, onay gerekir)**

Önce mevcut yetkileri kaydet (geri dönüşte birebir bunlar uygulanır):

```sql
select grantee, table_name, string_agg(privilege_type, ',') from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated') group by 1, 2 order by 2, 1;
select p.oid::regprocedure, array(select r from unnest(array['anon','authenticated']) r where has_function_privilege(r, p.oid, 'execute'))
from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef;
```

Sonra, site okunabilir kalır ama yazma reddedilir:

```sql
revoke insert, update, delete on all tables in schema public from anon, authenticated;
-- Tablo yetkisinden bağımsız yazan SECURITY DEFINER fonksiyonlar:
revoke execute on function public.delete_my_account(), public.admin_delete_user(uuid),
  public.send_announcement(text, text, text), public.increment_listing_view(uuid),
  public.get_listing_whatsapp(uuid) from anon, authenticated, public;
```

(Fonksiyon imzaları yukarıdaki sorgunun çıktısıyla karşılaştırılmalı.)
Dashboard → Authentication → Sign In / Providers: "Allow new users to sign up"
kapat. Dondurma sırasında Storage'a yüklenen dosyalar hiçbir ilana bağlanamaz
ve taşınmaz; eski sitede şifre sıfırlayan bir kullanıcı yeni sistemde eski
şifresiyle girer (ya da yeniden sıfırlar). Geri almak için §6.

**T0 + birkaç dakika — final içe aktarma**

```bash
$RUN node dist/supabase-import.js --report=/import/final.json   # yalnız yeni görseller işlenir
$RUN node dist/supabase-verify.js                                # OK olmalı
$DC up -d
sudo systemctl start kie-backup.service                          # ilk yedek
SMOKE_BASE_URL=https://yeni.kibrisikincielcim.com NEXT_PUBLIC_SITE_URL=https://www.kibrisikincielcim.com node scripts/production-smoke.mjs
```

**DNS (⚠ açık onay gerekir)**
1. `deploy/Caddyfile`'daki production bloklarını aç, `caddy validate`, `systemctl reload caddy`.
2. `@` ve `www` A kayıtlarını VDS IP'sine çevir (Vercel kayıtları/projesi silinmez).
3. Caddy sertifikaları DNS yayılınca otomatik alır (birkaç dakika).

**T+ doğrulama**
* `SMOKE_BASE_URL=https://www.kibrisikincielcim.com npm run smoke` → 36/36
* Gerçek hesapla giriş (eski şifre), ilan ver, mesaj gönder, admin onayı
* `journalctl -u kie-healthcheck`, `docker compose logs api` ilk saatlerde izlenir
* Search Console: sitemap yeniden gönder (URL'ler aynı)
* `kie-restore-test.service`'i bir kez elle çalıştır

## 6. Geri dönüş planı

| Ne zaman | Yapılacak | Veri kaybı |
|---|---|---|
| DNS değişmeden önce | Supabase'te yazmayı aç (aşağıda); yeni sistem hiç yayına çıkmadı | yok |
| DNS değiştikten sonra, ilk saatler | DNS'i Vercel'e geri çevir; Supabase'te yazmayı aç | yeni sistemde geçişten sonra yazılanlar (yeni ilan, mesaj, kayıt) eski sitede yoktur. Gerekirse `created_at > geçiş zamanı` olan kayıtlar yeni veritabanından dökülüp elle aktarılır; otomatik ters senkron **yoktur** |
| Günler sonra | Önerilmez; ileriye doğru düzelt | — |

Supabase'te yazmayı yeniden açmak: T0'da kaydedilen yetki listesini birebir
geri uygula. Supabase'in varsayılanı (RLS kısıtlar, yetkiler açıktır):

```sql
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant execute on function public.delete_my_account(), public.admin_delete_user(uuid),
  public.send_announcement(text, text, text), public.increment_listing_view(uuid),
  public.get_listing_whatsapp(uuid) to authenticated;
-- anon için: kaydedilen listede anon'un execute yetkisi olanlar (ör. increment_listing_view) geri verilir.
```

ve "Allow new users to sign up" tekrar açılır.

Geri dönüşte kullanıcı şifreleri etkilenmez: yeni sistemde Argon2id'ye çevrilen
hash'ler Supabase'teki bcrypt'i değiştirmez. Yeni sistemde şifresini değiştiren
kullanıcı eski sitede eski şifresini kullanır.

## 7. Geçişten sonra

* Supabase projesi **silinmez**; en az 30 gün (tercihen ücretsiz plana
  düşürülüp) duraklatılmadan bekler. Silme ayrı bir karardır.
* Vercel projesi ve alan adı ayarları silinmez; geri dönüş için hazır kalır.
* `.env.local.supabase-backup` gibi yerel kopyalar güvenli biçimde saklanır
  ya da silinir.
