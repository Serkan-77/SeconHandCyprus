import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { LinkButton } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/icons";

export const metadata: Metadata = {
  title: "İlanını öne çıkar",
  description: "İlanını daha çok kişiye göstermek için öne çıkarma paketleri: Üste taşı, Vitrin ve Mağaza Plus.",
  alternates: { canonical: "/one-cikar" },
};

// Information only: packages are not on sale yet, nothing is charged. When
// payments are added, these become the products.
const packages: { icon: IconName; name: string; tagline: string; duration: string; features: string[]; highlight?: boolean }[] = [
  {
    icon: "arrow",
    name: "Üste taşı",
    tagline: "İlanın yeni verilmiş gibi listelerin başına döner.",
    duration: "Tek seferlik",
    features: ["Kategori ve arama sonuçlarında en üste çıkar", "Yakınımdakiler listesinde öne geçer", "Hızlı satmak isteyenler için ideal"],
  },
  {
    icon: "spark",
    name: "Vitrin",
    tagline: "Ana sayfada ve kategori başında öne çıkan alanda yer al.",
    duration: "7 gün",
    features: ["Ana sayfa vitrininde görünür", "Listelerde “Vitrin” rozetiyle en üstte", "Ortalama ilandan çok daha fazla görüntülenme"],
    highlight: true,
  },
  {
    icon: "store",
    name: "Mağaza Plus",
    tagline: "Mağazalar için sürekli görünürlük.",
    duration: "30 gün",
    features: ["Mağazalar sayfasında üst sıralar", "Ayda birkaç ilanını vitrine taşıma hakkı", "Görüntülenme ve mesaj istatistikleri"],
  },
];

const faq = [
  ["Paketler ne zaman satışa çıkacak?", "Ödeme altyapısı hazır olduğunda duyuracağız. Şu anda hiçbir paket için ücret alınmıyor."],
  ["Şu an ilanımı öne çıkarabilir miyim?", "Evet: vitrin seçimi şimdilik ekibimiz tarafından ücretsiz yapılıyor. Özenli fotoğraflı ve açıklamalı ilanlar vitrine seçilme şansını artırır."],
  ["Öne çıkarılan ilanlar incelemeden geçer mi?", "Evet. Paketler yalnızca yayında olan ve kurallara uyan ilanlara uygulanır."],
  ["Paket bitince ne olur?", "İlanın yayında kalır, yalnızca öne çıkma avantajı sona erer."],
];

export default function PromotePage() {
  return (
    <div className="mx-auto max-w-[1328px] px-4 pb-16 sm:px-6">
      <Breadcrumbs items={["İlanını öne çıkar"]} />

      <section className="mb-10 rounded-hero bg-accent-soft p-6 sm:p-10">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-[11px] font-semibold text-on-accent">
          <Icon name="clock" className="h-3.5 w-3.5" />
          Yakında
        </span>
        <h1 className="mt-3 max-w-2xl text-2xl font-semibold tracking-tight sm:text-[34px]">
          İlanını daha çok kişiye göster.
        </h1>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted">
          Öne çıkarma paketleri çok yakında burada. Şimdilik bilgilendirme amaçlıdır; hiçbir paket için ödeme alınmıyor.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {packages.map((p) => (
          <article
            key={p.name}
            className={
              p.highlight
                ? "relative flex flex-col gap-4 rounded-2xl border-2 border-accent p-6"
                : "flex flex-col gap-4 rounded-2xl border border-border p-6"
            }
          >
            {p.highlight ? (
              <span className="absolute -top-3 left-6 rounded-full bg-accent px-3 py-1 text-[10px] font-semibold text-on-accent">
                En çok tercih edilecek
              </span>
            ) : null}
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-accent-soft text-accent">
              <Icon name={p.icon} className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-lg font-semibold">{p.name}</h2>
              <p className="mt-1 text-[13px] text-muted">{p.tagline}</p>
            </div>
            <div className="flex items-baseline justify-between border-y border-border py-3 text-xs">
              <span className="text-muted">Süre</span>
              <b>{p.duration}</b>
            </div>
            <ul className="flex flex-1 flex-col gap-2.5 text-[13px]">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Icon name="check" className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent" />
                  {f}
                </li>
              ))}
            </ul>
            <span className="rounded-button bg-bg py-3 text-center text-xs font-semibold text-muted">Fiyat yakında açıklanacak</span>
          </article>
        ))}
      </div>

      <section className="mx-auto mt-14 max-w-[760px]">
        <h2 className="mb-5 text-xl font-semibold tracking-tight">Sık sorulanlar</h2>
        <div className="divide-y divide-border rounded-2xl border border-border">
          {faq.map(([q, a]) => (
            <details key={q} className="group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium">
                {q}
                <Icon name="chevron" className="h-4 w-4 flex-shrink-0 text-accent transition group-open:rotate-90" />
              </summary>
              <p className="mt-3 text-[13px] leading-relaxed text-muted">{a}</p>
            </details>
          ))}
        </div>
        <div className="mt-8 flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-muted">Paketler açıldığında haber almak ya da vitrin için başvurmak ister misin?</p>
          <LinkButton href="/destek" variant="accent" full={false}>
            Bize yaz
          </LinkButton>
        </div>
      </section>
    </div>
  );
}
