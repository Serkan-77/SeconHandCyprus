# Launch checklist

Ayrıntılar için bkz. [PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md). Maddeleri sırayla uygula.

- [ ] **Production Supabase oluştur:** Yeni ve boş bir proje aç. Development projesini kullanma.
- [ ] **Migration'ları uygula:** `supabase/migrations/0001` → `0013`, repodaki dosyalardan ve sırayla. Hata alırsan dur. Sonra doğrulama sorgusunu çalıştır ([§ 3](PRODUCTION_DEPLOYMENT.md#3-supabase-migrationları-0001--0013)). Seed **çalıştırma**.
- [ ] **Supabase Auth:**
  - Site URL = `https://<alan-adin>`
  - Redirect allowlist'te yalnızca `https://<alan-adin>/auth/callback**`
  - Confirm email açık
  - Auth rate limits ayarlı; gerekiyorsa CAPTCHA
  - Özel SMTP tanımlı
- [ ] **Google OAuth** (kullanılacaksa): Google Console redirect URI = `https://<production-ref>.supabase.co/auth/v1/callback`. Provider'ı Supabase'de aç.
- [ ] **Storage kontrolü:** `listing-images` (8 MB) ve `avatars` (2 MB) bucket'ları public; yalnızca jpeg/png/webp; 4 `storage.objects` policy'si mevcut.
- [ ] **Production env:** `.env.production.example`'a göre hosting panelinde tanımla.
  - `NEXT_PUBLIC_ADSENSE_CMP_READY=0`
  - `SUPABASE_SECRET_KEY`, `SEED_PASSWORD` ve `ALLOW_DESTRUCTIVE_TESTS` **tanımlı değil**
- [ ] **Domain:** DNS'i bağla, HTTPS sertifikası aktif olsun. `NEXT_PUBLIC_SITE_URL` bu domain olmalı.
- [ ] **Build:** `npm ci && npm run build` hatasız tamamlansın (env doğrulaması build'de yapılır).
- [ ] **Deploy:** Deploy et, ana sayfanın açıldığını gör.
- [ ] **production-smoke:** `npm run smoke` (salt okuma), tüm kontroller ✓.
- [ ] **İlk admin:** Normal kayıt ol, SQL Editor'de kendi hesabına `role = 'admin'` ver ([§ 3](PRODUCTION_DEPLOYMENT.md#migrationların-bıraktığı-önemli-davranışlar)).
- [ ] **Manuel kullanıcı testi:** Aşağıdaki senaryoyu uygula.
- [ ] **Backup ve monitoring:** Günlük yedek veya PITR açık; hata, log ve uptime izleme kurulu.
- [ ] **Reklamlar:** CMP kurulup test edilmediyse `NEXT_PUBLIC_ADSENSE_CMP_READY=0` kalır ([§ 9](PRODUCTION_DEPLOYMENT.md#9-google-adsense-ve-cmp)).
- [ ] **Launch** 🚀

---

## Manuel launch testi

Production'da **yalnızca bu test için açılmış özel test hesaplarıyla** yap:

- test satıcısı (A)
- test alıcısı (B)
- admin hesabı

Gerçek kullanıcılarla etkileşime geçme. İlan başlığının başına `TEST -` yaz;
test sonunda her şeyi temizle.

1. **Kayıt (A):** `/kayit`'tan yeni hesap aç. Onay e-postası gelmeli ve linki
   production domain'ine (`/auth/callback`) gitmeli.
2. **E-posta onayı:** Linke tıkla. Kurulum ve profil adımı açılmalı.
3. **Giriş:** Çıkış yap, tekrar giriş yap. Şifre sıfırlama e-postasını da bir kez
   dene; link production domain'ine gitmeli.
4. **İlan oluştur (A):** 2 fotoğraflı `TEST - …` ilanı ver. "İncelemede"
   görünmeli, public aramada **görünmemeli**. Gönder butonuna iki kez basmak tek
   ilan oluşturmalı.
5. **Admin onayı:** Admin hesabıyla `/yonetim` → ilanlar → ilanı onayla.
6. **Public görünürlük:** Çıkış yapmış bir tarayıcıda ilan aramada ve detay
   sayfasında görünmeli; fotoğraflar yüklenmeli.
7. **Favori (B):** B hesabıyla ilanı favorilere ekle, `/hesabim/favoriler` sayfasında gör.
8. **Mesaj (B → A):** "Satıcıya mesaj gönder" ile mesaj yaz. A'ya bildirim gelmeli.
   A cevap versin; mesajlar iki tarafta anında görünmeli.
9. **Buluşma onayı:** İki taraf da sohbetten "Buluşmayı onayla" desin. Tek onayla
   değerlendirme açılmamalı, iki onaydan sonra açılmalı.
10. **Değerlendirme (B → A):** Puan ve yorum bırak. A'nın profilinde görünmeli;
    ikinci kez puan verilememeli.
11. **Düzenleme → inceleme (A):** Yayındaki ilanın başlığını değiştir. İlan tekrar
    "İncelemede" durumuna geçmeli ve public'ten kalkmalı. Yalnızca fiyat
    değişikliği ilanı yayında tutmalı.
12. **Yeniden onay:** Admin ilanı tekrar onaylasın; ilan public olmalı.
13. **Hesap silme (test hesabı):** B hesabını Ayarlar → "Hesabımı sil" ile sil.
    - B ile giriş yapılamamalı.
    - A'nın konuşmasında B "Silinmiş kullanıcı" görünmeli ve mesaj gönderilememeli.
14. **Temizlik:**
    - A test ilanını Hesabım → İlanlarım → ilan → "İlanı sil" ile silsin; fotoğraflar da gider.
    - A hesabını da silebilirsin.
    - Admin, test konuşmasını ve kalan test verisini SQL Editor'den kontrol etsin.
    - Test için açılan destek taleplerini ve bildirimleri kontrol et.
15. **Son kontrol:** `npm run smoke` tekrar çalıştır.
