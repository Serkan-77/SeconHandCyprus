
import * as I18n from "@/components/i18n/Localized";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Icon, type IconName } from "@/components/icons";

export const metadata = {
  title: "Yardım & güvenlik",
  description: "İlan verme, mesajlaşma, güvenli alışveriş ve hesap doğrulama hakkında sık sorulan sorular.",
};

const topics: { id: string; icon: IconName; title: string; desc: string; faqs: [string, string][] }[] = [
  {
    id: "ilan",
    icon: "bag",
    title: "İlan verme ve yönetme",
    desc: "Fotoğraf, fiyat ve konum bilgilerini nasıl düzenlersin.",
    faqs: [
      [
        "İlan vermek ücretli mi?",
        "Hayır. İlan vermek tamamen ücretsiz. En az 1, en fazla 10 fotoğraf ekleyip başlık, kategori, fiyat ve bölge bilgilerini doldurman yeterli.",
      ],
      [
        "İlanım neden hemen yayınlanmadı?",
        "Her ilan yayına alınmadan önce kısa bir moderasyon incelemesinden geçer. Genellikle birkaç saat içinde sonuçlanır; onaylandığında ya da reddedildiğinde bildirim alırsın.",
      ],
      [
        "İlanım reddedildi, ne yapmalıyım?",
        "Hesabım › İlanlarım › İncelemede sekmesinde ret gerekçesini görebilirsin. İlanı düzenleyip “Tekrar incelemeye gönder” ile yeniden gönderebilirsin.",
      ],
      [
        "Ürünüm satıldı, ilanı nasıl kapatırım?",
        "İlanı yönet ekranından “Satıldı olarak işaretle”ye dokun. İlan aramalardan kalkar ama satış geçmişinde kalır.",
      ],
    ],
  },
  {
    id: "mesaj",
    icon: "chat",
    title: "Mesajlaşma",
    desc: "Satıcı ve alıcılarla güvenli iletişim kurma.",
    faqs: [
      [
        "Satıcıya nasıl ulaşırım?",
        "İlan sayfasındaki “Satıcıya mesaj gönder” düğmesi seni doğrudan o ilanla ilgili bir konuşmaya götürür. Satıcı izin verdiyse WhatsApp ile de ulaşabilirsin.",
      ],
      [
        "Birini engellersem ne olur?",
        "Engellediğin kullanıcıyla karşılıklı mesajlaşma kapanır. Engeli istediğin zaman konuşma menüsünden kaldırabilirsin.",
      ],
      [
        "Değerlendirme nasıl bırakırım?",
        "Buluştuktan sonra konuşmada “Buluşmayı tamamladık”a dokun, ardından 1–5 yıldız ve kısa bir yorum bırak. Değerlendirmeler karşı tarafın profilinde görünür.",
      ],
    ],
  },
  {
    id: "guvenlik",
    icon: "shield",
    title: "Güvenli alışveriş",
    desc: "Buluşma ve ödeme konusunda dikkat edilmesi gerekenler.",
    faqs: [
      [
        "Ödemeyi uygulama üzerinden mi yapıyoruz?",
        "Hayır. Ürün ödemeleri alıcı ile satıcı arasında, uygulama dışında yapılır. Ürünü görmeden kapora ya da havale gönderme.",
      ],
      [
        "Buluşurken nelere dikkat etmeliyim?",
        "Gündüz saatlerinde, kalabalık ve herkese açık bir yerde buluş. Ürünü yerinde kontrol et; elektronik ürünleri çalışır halde gör.",
      ],
      [
        "Şüpheli bir durumla karşılaştım.",
        "İlan sayfasındaki “Bu ilanı şikayet et” ya da konuşma menüsündeki “Şikayet et” seçeneğini kullan. Moderasyon ekibi 24 saat içinde inceler.",
      ],
    ],
  },
  {
    id: "hesap",
    icon: "user",
    title: "Hesap ve doğrulama",
    desc: "Profilini doğrulama ve hesap ayarların.",
    faqs: [
      [
        "Doğrulama rozeti ne anlama geliyor?",
        "Rozet yalnızca kullanıcının e-posta ve telefon bilgilerinin doğrulandığını gösterir; kimlik ya da ürün garantisi değildir.",
      ],
      [
        "Şifremi unuttum.",
        "Giriş ekranındaki “Şifremi unuttum” bağlantısından e-posta adresini gir; sana bir sıfırlama bağlantısı gönderelim.",
      ],
      [
        "Hesabımı nasıl silerim?",
        "Hesabım › Ayarlar › Tehlikeli bölge adımından hesabını kalıcı olarak silebilirsin. Profilin, ilanların ve fotoğrafların silinir; gönderdiğin mesajlar karşı tarafın konuşmasında “Silinmiş kullanıcı” adıyla kalır.",
      ],
    ],
  },
  {
    id: "moderasyon",
    icon: "flag",
    title: "Şikayet ve moderasyon",
    desc: "Uygunsuz içerik ya da kullanıcıları nasıl bildirirsin.",
    faqs: [
      [
        "Hangi ilanlar yasak?",
        "Silah, ilaç, canlı hayvan, sahte ürünler ve yasa dışı her türlü ürün yasaktır. Ayrıntılar kullanım koşullarında.",
      ],
      [
        "Hesabım neden kısıtlandı?",
        "Kurallara aykırı bir işlem tespit edildiğinde hesap geçici olarak kısıtlanabilir. Bildirim merkezinde gerekçeyi görebilir, destek formundan itiraz edebilirsin.",
      ],
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-[900px] px-4 pb-16 sm:px-6">
      <Breadcrumbs items={["Yardım & güvenlik"]} />
      <I18n.h1 className="mb-2 text-2xl font-semibold tracking-tight sm:text-[32px]">Yardım & güvenlik</I18n.h1>
      <I18n.p className="mb-8 text-[13px] text-muted">Aradığın cevabı bulamazsan destek ekibimize ulaşabilirsin.</I18n.p>

      <I18n.nav aria-label="Yardım konuları" className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {topics.map((topic) => (
          <a key={topic.id} href={`#${topic.id}`} className="flex gap-3.5 rounded-xl border border-border p-5 transition hover:border-accent">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
              <Icon name={topic.icon} className="h-[18px] w-[18px]" />
            </span>
            <div>
              <I18n.b className="text-[13px]">{topic.title}</I18n.b>
              <I18n.p className="mt-1 text-xs text-muted">{topic.desc}</I18n.p>
            </div>
          </a>
        ))}
      </I18n.nav>

      <I18n.div className="flex flex-col gap-10">
        {topics.map((topic) => (
          <section key={topic.id} id={topic.id} className="scroll-mt-6">
            <I18n.h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <Icon name={topic.icon} className="h-5 w-5 text-accent" />
              {topic.title}
            </I18n.h2>
            <I18n.div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {topic.faqs.map(([q, a]) => (
                <details key={q} className="group px-5 py-4">
                  <I18n.summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[13px] font-medium">
                    {q}
                    <Icon name="chevron" className="h-4 w-4 flex-shrink-0 text-muted transition group-open:rotate-90" />
                  </I18n.summary>
                  <I18n.p className="mt-3 text-[13px] leading-relaxed text-muted">{a}</I18n.p>
                </details>
              ))}
            </I18n.div>
          </section>
        ))}
      </I18n.div>

      <div className="mt-12 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-bg p-6">
        <div>
          <I18n.b className="text-sm">Aradığını bulamadın mı?</I18n.b>
          <I18n.p className="mt-1 text-xs text-muted">Destek ekibimize doğrudan yazabilirsin.</I18n.p>
        </div>
        <I18n.Link href="/destek" className="flex min-h-12 items-center rounded-button bg-brand px-5 text-sm font-semibold text-on-brand">
          Destek talebi oluştur
        </I18n.Link>
      </div>
    </div>
  );
}
