# Kurulum ve dağıtım (VDS)

Hedef: Ubuntu 24.04 VDS (4 vCPU, 6 GB RAM, 50 GB SSD). Docker, host üzerinde
Caddy, UFW ve Fail2Ban kurulu. Bu proje yalnızca `/srv/kibrisikincielcim/`
altında çalışır. **`/srv/gezeceyik-kibris/` başka bir projedir; ona, ağına ve
Caddy bloklarına dokunma.**

> DNS, Supabase'ten taşıma ve canlıya geçiş adımları MIGRATION.md'dedir.
> Bu belgedeki her şey DNS değişmeden, geçici bir alan adıyla yapılabilir.

## 1. İlk kurulum

```bash
# Dizinler (api/ dizini kullanılmaz; kod app/ altındadır)
sudo mkdir -p /srv/kibrisikincielcim/{app,data,uploads,backups}
sudo chown 1000:1000 /srv/kibrisikincielcim/uploads   # konteynerdeki "node" kullanıcısı
sudo chmod 755 /srv/kibrisikincielcim/uploads          # Caddy okuyabilsin
sudo chmod 700 /srv/kibrisikincielcim/backups

# Uygulama ağı (compose'ta external)
docker network inspect kibrisikincielcim-network >/dev/null 2>&1 || docker network create kibrisikincielcim-network

# Kod (salt okunur deploy key ile)
sudo git clone --branch marketplace-v2 <repo-url> /srv/kibrisikincielcim/app

# Ortam dosyası
sudo cp /srv/kibrisikincielcim/app/deploy/.env.example /srv/kibrisikincielcim/.env
sudo chmod 600 /srv/kibrisikincielcim/.env
sudo nano /srv/kibrisikincielcim/.env   # her gizli değer için: openssl rand -hex 32
```

`.env` içinde zorunlu olanlar: `SITE_URL`, üç veritabanı şifresi, `JWT_SECRET`,
`INTERNAL_API_TOKEN`, `SMTP_*`, `MAIL_FROM`. Önce `SITE_URL`'yi geçici alan
adına ayarla (ör. `https://yeni.kibrisikincielcim.com`).

**E-posta:** doğrulama ve şifre sıfırlama e-postası zorunludur. Gönderen alan
adı için SPF, DKIM ve DMARC kayıtları SMTP sağlayıcısının talimatına göre
eklenmelidir; yoksa e-postalar spam'e düşer.

## 2. Başlat

```bash
cd /srv/kibrisikincielcim/app
docker compose -f deploy/docker-compose.yml --env-file /srv/kibrisikincielcim/.env up -d --build
docker compose -f deploy/docker-compose.yml --env-file /srv/kibrisikincielcim/.env ps
```

Beklenen: `db`, `api`, `web` **healthy**; `migrate` "applied …" ya da
"database is up to date" yazıp çıkmış. İlk açılışta `db/init` rolleri ve
veritabanını oluşturur.

Kontrol:

```bash
curl -s http://127.0.0.1:4100/health/ready     # {"status":"ok",...}
curl -sI http://127.0.0.1:3100/ | head -1        # 200
docker ps --format '{{.Names}} {{.Ports}}' | grep kibrisikincielcim
#   db satırında yalnız "5432/tcp" olmalı (yayın yok)
sudo ss -tlnp | grep -E ':(3100|4100|5432)\b'    # 3100/4100 yalnız 127.0.0.1
sudo ufw status                                  # yalnız 22, 80, 443
```

## 3. Caddy

`deploy/Caddyfile` bir snippet (`kie_site`) ve yorum satırındaki site
bloklarını içerir. Ana Caddyfile'a ekle:

```caddy
import /srv/kibrisikincielcim/app/deploy/Caddyfile
```

Önce yalnız **staging** bloğunu aç (geçici alan adının A kaydı VDS'i
göstermeli):

```caddy
yeni.kibrisikincielcim.com {
	import kie_site
}
```

```bash
sudo mkdir -p /var/log/caddy
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Production blokları (`www` + apex yönlendirmesi) yalnız canlıya geçişte açılır
(MIGRATION.md §5).

## 4. Yedek, tatbikat ve sağlık kontrolü

```bash
sudo cp /srv/kibrisikincielcim/app/deploy/ops/systemd/kie-* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now kie-backup.timer kie-restore-test.timer kie-healthcheck.timer
sudo systemctl start kie-backup.service && journalctl -u kie-backup -n 20
sudo systemctl start kie-restore-test.service && journalctl -u kie-restore-test -n 20
```

İsteğe bağlı `/srv/kibrisikincielcim/ops.env` (chmod 600):
`SITE_URL=…` (healthcheck dış adresi de denesin), `ALERT_CMD=…` (uyarı
gönderen komut), `OFFSITE_CMD=…` (yedeği sunucu dışına kopyalayan komut).
Ayrıntılar: BACKUP_RESTORE.md.

## 5. Doğrulama

```bash
# Sunucudan, Caddy üzerinden:
cd /srv/kibrisikincielcim/app
SMOKE_BASE_URL=https://yeni.kibrisikincielcim.com NEXT_PUBLIC_SITE_URL=https://yeni.kibrisikincielcim.com node scripts/production-smoke.mjs
```

36/36 geçmeli. Sonra elle: kayıt → e-posta doğrulama → ilan ver (fotoğraflı)
→ admin onayı → başka hesapla mesaj → buluşma onayı → değerlendirme →
şikayet → admin çözümü. Mobil tarayıcıda da.

## 6. Güncelleme

```bash
cd /srv/kibrisikincielcim/app
sudo systemctl start kie-backup.service              # her dağıtımdan önce yedek
sudo git fetch && sudo git checkout <yeni-commit-ya-da-etiket>
DC="docker compose -f deploy/docker-compose.yml --env-file /srv/kibrisikincielcim/.env"
$DC build                      # site bu sırada eski sürümle çalışmaya devam eder
$DC run --rm migrate           # her migration kendi transaction'ında; hata olursa şema değişmez → DUR, logu oku
$DC up -d                      # yalnız migrate başarılıysa
$DC logs --tail 50 api web
SMOKE_BASE_URL=$SITE_URL node scripts/production-smoke.mjs
```

**Geri alma (uygulama):** önceki commit'e `git checkout` + aynı `up -d --build`.
Migration'lar ileri yönlüdür; bir migration geri alınacaksa dağıtımdan önce
alınan yedekten `restore.sh` ile dönülür (BACKUP_RESTORE.md).

`NEXT_PUBLIC_*` değerleri build'e gömülür: değiştirince `web` yeniden build
edilmelidir (`up -d --build web`).

## 7. Loglar ve izleme

| Ne | Nerede |
|---|---|
| Uygulama | `docker compose … logs -f api web` (json-file, 5×10 MB döner) |
| Erişim | `/var/log/caddy/kibrisikincielcim.log` (JSON, 5×20 MB) |
| Yavaş sorgular | `docker compose … logs db` (`log_min_duration_statement=500ms`) |
| Yedek / tatbikat / sağlık | `journalctl -u kie-backup -u kie-restore-test -u kie-healthcheck` |
| Son başarılı yedek | `/srv/kibrisikincielcim/backups/LAST_SUCCESS` |

Her yanıt `x-request-id` taşır; Caddy aynı kimliği API'ye iletir, loglarda
bu kimlikle aranır.

## 8. Google ile giriş (isteğe bağlı)

Google Cloud'da (mevcut OAuth istemcisi kullanılabilir) yetkili yönlendirme
adresine `https://<alan-adı>/api/v1/auth/google/callback` ekle. `.env`:
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_AUTH_GOOGLE=1`;
sonra `up -d --build`. Supabase'ten taşınan Google hesapları aynı Google
kimliğiyle doğrudan girer.

## Yerel prova

Aynı compose yerelde de çalışır (Windows'ta Docker Desktop):

```bash
docker network create kibrisikincielcim-network
docker compose -f deploy/docker-compose.yml --env-file deploy/.env.localtest up -d --build
```

`deploy/.env.localtest` gitignore'dadır; `.env.example`'dan kopyalanıp yerel
yollarla doldurulur.

## 9. Google AdSense ve CMP

Reklamlar varsayılan olarak **kapalıdır**: `NEXT_PUBLIC_ADSENSE_CMP_READY=1`
olmadan reklam scripti, reklam alanları ve reklam CSP alan adları devreye
girmez. Yalnız `NEXT_PUBLIC_ADSENSE_CLIENT` girilirse site incelemesi için
meta etiketi ve `/ads.txt` yayınlanır.

Açma sırası:

1. AdSense'te Google sertifikalı bir **CMP** (Privacy & messaging → GDPR/EEA
   onay mesajı) kur ve yayınla.
2. Onay davranışını test et: onaysız reklam çerezi yazılmıyor; reddetme ve geri
   alma çalışıyor; AEA/UK ziyaretçisi olarak da dene.
3. `.env`'e `NEXT_PUBLIC_ADSENSE_CLIENT` ve slot id'lerini gir, `up -d --build web`.
4. **En son** `NEXT_PUBLIC_ADSENSE_CMP_READY=1`, yeniden build, `npm run smoke`
   (reklam kontrolü "açık" olmalı).
