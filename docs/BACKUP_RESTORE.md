# Yedekleme ve geri yükleme

Scriptler `deploy/ops/` altında, zamanlayıcılar `deploy/ops/systemd/` altında.
Hepsi host üzerinde root olarak çalışır ve `/srv/kibrisikincielcim/` dışına
yazmaz.

## Ne, ne zaman

| Zamanlayıcı | Zaman | Script | İş |
|---|---|---|---|
| `kie-backup.timer` | her gece 03:30 | `backup.sh` | veritabanı dökümü + yüklemelerin anlık görüntüsü |
| `kie-restore-test.timer` | pazartesi 05:00 | `restore-test.sh` | en son yedeği geçici bir veritabanına geri yükleyip doğrular |
| `kie-healthcheck.timer` | 5 dakikada bir | `healthcheck.sh` | API, web, site, disk, yedek tazeliği, konteyner durumu |

## Yedeğin yapısı

```
/srv/kibrisikincielcim/backups/          (chmod 700, dosyalar 600)
  db/<YYYYMMDDTHHMMSSZ>/db.dump          pg_dump custom format, sıkıştırılmış
  db/<…>/manifest.txt                    migration listesi + checksum'lar, tablo satır sayıları
  db/<…>/SHA256SUMS
  uploads/<…>/                           rsync anlık görüntüsü; değişmeyen dosyalar
                                         bir öncekine hard link (yalnız yeni fotoğraflar yer kaplar)
  weekly/<…>/                            pazar yedeklerinin kopyası
  LAST_SUCCESS, LAST_RESTORE_TEST        son başarılı zamanlar (healthcheck okur)
```

* Saklama: `KEEP_DAILY=7`, `KEEP_WEEKLY=4`.
* Disk: yedek başlamadan gereken yer tahmin edilir; boş alan `MIN_FREE_MB`
  (3 GB) altına inecekse önce eski günlükler silinir (en az 2 kalır), yine
  yetmezse yedek hiç başlamaz ve hata verir.
* Döküm `pg_restore --list` ile okunabilirliği kontrol edilmeden "başarılı"
  sayılmaz.
* `flock` aynı anda iki yedeği engeller.

## Sunucu dışı kopya (önerilir)

Yedekler varsayılan olarak verilerle aynı diskte durur: yanlış silmeye ve
bozulmaya karşı korur, **sunucunun kaybına karşı korumaz**. `ops.env`'de
`OFFSITE_CMD` tanımla, örneğin (rclone yapılandırıldıktan sonra):

```bash
OFFSITE_CMD='rclone sync "$BACKUP_DIR" kie-offsite:kibrisikincielcim-backups --exclude ".lock"'
```

Hedef depolama, sunucu kimlik bilgisiyle silinemeyecek şekilde (versiyonlama
ya da nesne kilidi) ayarlanmalıdır.

## Geri yükleme tatbikatı (otomatik, haftalık)

`restore-test.sh [backups/db/<stamp>]`:

1. SHA256 doğrulaması
2. aynı PostgreSQL sunucusunda `kie_restore_test` veritabanına `pg_restore`
3. migration listesi manifest ile birebir aynı mı
4. yabancı anahtarlar geçerli mi, RLS ana tablolarda açık mı
5. tablo satır sayıları manifest ile tutarlı mı (yoğun tablolar için %1 + 25 tolerans)
6. rastgele 200 ilan fotoğrafı aynı gecenin yükleme anlık görüntüsünde var mı
7. geçici veritabanını siler

Canlı veritabanına dokunmaz. Elle de çalıştırılabilir:

```bash
sudo bash /srv/kibrisikincielcim/app/deploy/ops/restore-test.sh
```

## Gerçek geri yükleme (felaket durumu)

**Canlı veriyi değiştirir.** Önce hangi yedeğe döneceğinden emin ol (manifest
ve tarih), kullanıcılara bakım duyurusu yap.

```bash
sudo bash /srv/kibrisikincielcim/app/deploy/ops/restore.sh \
  /srv/kibrisikincielcim/backups/db/<stamp> [--with-uploads] --yes-replace-production
```

Adımlar: checksum → `api` ve `web` durdurulur → **mevcut veritabanının
güvenlik dökümü** (`backups/pre-restore-<zaman>.dump`) → veritabanı yeniden
oluşturulur → `pg_restore` → (isteğe bağlı) yüklemeler anlık görüntüden geri
alınır → servisler başlar (migrate önce) → sağlık kontrolü.

`--with-uploads` olmadan fotoğraflar olduğu gibi kalır (fotoğraflar
silinmediği sürece genellikle doğru seçimdir: yeni dosyalar yetim kalır ve
temizlik işi onları siler).

### Yalnız yüklemeleri geri almak

```bash
sudo rsync -a /srv/kibrisikincielcim/backups/uploads/<stamp>/ /srv/kibrisikincielcim/uploads/
```

(`--delete` olmadan: mevcut dosyalar korunur, eksikler geri gelir.)

### Sunucu tamamen kaybolursa

1. Yeni VDS'te DEPLOYMENT.md §1–2 (aynı `.env`, sunucu dışı kopyadan alınmış).
2. Sunucu dışı kopyadan `backups/` dizinini geri getir.
3. `restore.sh <son yedek> --with-uploads --yes-replace-production`.
4. Caddy ve DNS'i yeni sunucuya yönlendir.

## Doğrulanan senaryolar (yerel, 2026-10-01)

* `backup.sh` iki kez: ikinci yükleme görüntüsü yalnız 124 KB (hard link) ✔
* `restore-test.sh`: migration'lar, RLS, satır sayıları, 27 görsel ✔
* Bozulmuş döküm: checksum hatasıyla reddedildi ✔
* `restore.sh`: onay bayrağı olmadan reddetti; bozulan bir kategori adı
  yedekten geri geldi, `kie_app` yetkileri yerinde, site 200 ✔
