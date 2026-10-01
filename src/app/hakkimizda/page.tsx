
import * as I18n from "@/components/i18n/Localized";
import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Icon, type IconName } from "@/components/icons";
import { LinkButton } from "@/components/ui/Button";
import { apiServer } from "@/lib/api/server";
import { regionNames } from "@/lib/regions";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Hakkımızda",
  description: `${SITE.name}, Kıbrıs'ta ikinci el eşyaların yeni sahiplerini bulması için kurulmuş ücretsiz, yerel bir ilan platformu.`,
  alternates: { canonical: "/hakkimizda" },
};

const principles: { icon: IconName; title: string; desc: string }[] = [
  {
    icon: "pin",
    title: "Yerel",
    desc: "Sadece Kıbrıs. İlanlar bölge ve semte göre listelenir; aradığın çoğu zaman bir sokak ötede.",
  },
  {
    icon: "spark",
    title: "Ücretsiz",
    desc: "İlan vermek, mesajlaşmak ve favorilemek ücretsiz. Komisyon yok, üyelik ücreti yok; site reklamlarla ayakta.",
  },
  {
    icon: "shield",
    title: "Güvenli",
    desc: "Her ilan yayına girmeden incelenir. Şikayetler 24 saat içinde değerlendirilir, kural ihlali yapan hesaplar kısıtlanır.",
  },
  {
    icon: "chat",
    title: "Doğrudan",
    desc: "Alıcı ve satıcı arasına kimse girmez. Uygulama içinden ya da satıcı izin verdiyse WhatsApp'tan konuşursunuz.",
  },
];

async function stats() {
  try {
    const r = await apiServer<{ activeListings: number; members: number }>("/stats", { anonymous: true, revalidate: 300 });
    return { listings: r.activeListings, members: r.members };
  } catch {
    return null;
  }
}

export default async function AboutPage() {
  const numbers = await stats();

  return (
    <I18n.div className="mx-auto max-w-[1100px] px-4 pb-16 sm:px-6">
      <Breadcrumbs items={["Hakkımızda"]} />

      <section className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <I18n.span className="text-[9px] font-semibold tracking-[1.8px] text-accent">HAKKIMIZDA</I18n.span>
          <I18n.h1 className="mt-4 text-[34px] font-medium leading-[1.1] tracking-[-1.2px] sm:text-[46px]">
            Eşyaların ikinci hikâyesi,
            <br />
            adanın içinde başlasın.
          </I18n.h1>
          <I18n.p className="mt-5 max-w-[520px] text-[15px] leading-relaxed text-muted">
            {SITE.name}, Kıbrıs&apos;ta kullanılmayan ama hâlâ iyi durumda olan eşyaların, onlara ihtiyacı olan
            insanlarla buluşması için kurulmuş yerel bir ilan platformu. Taşınanlar, evini sadeleştirenler, çocuğu büyüyen
            aileler ve uygun fiyata kaliteli eşya arayanlar için.
          </I18n.p>
        </div>
        <div className="relative hidden aspect-[4/3] overflow-hidden rounded-hero bg-bg sm:block">
          <I18n.Image src="/images/demo-chair.jpg" alt="" fill priority sizes="(min-width: 1024px) 45vw, 90vw" className="object-cover" />
        </div>
      </section>

      {numbers ? (
        <I18n.section aria-label="Rakamlarla" className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { value: numbers.listings, label: "yayında ilan" },
            { value: numbers.members, label: "kayıtlı üye" },
            { value: regionNames.length, label: "bölgede ilan (Kuzey ve Güney)" },
          ].map((s) => (
            <div key={s.label} className="rounded-card border border-border p-5">
              <I18n.strong className="block text-3xl font-semibold tracking-tight"><I18n.Formatted kind="formatNumber" args={[s.value]} /></I18n.strong>
              <I18n.span className="text-xs text-muted">{s.label}</I18n.span>
            </div>
          ))}
        </I18n.section>
      ) : null}

      <section className="mt-16">
        <I18n.h2 className="text-xl font-semibold tracking-tight sm:text-[27px]">Neye inanıyoruz?</I18n.h2>
        <I18n.div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {principles.map((p) => (
            <div key={p.title} className="flex gap-4 rounded-card border border-border p-5">
              <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-full bg-brand-soft text-accent">
                <Icon name={p.icon} className="h-5 w-5" />
              </span>
              <div>
                <I18n.h3 className="text-[15px] font-semibold">{p.title}</I18n.h3>
                <I18n.p className="mt-1 text-[13px] leading-relaxed text-muted">{p.desc}</I18n.p>
              </div>
            </div>
          ))}
        </I18n.div>
      </section>

      <section className="mt-16 grid grid-cols-1 gap-8 rounded-2xl bg-bg p-6 sm:p-9 lg:grid-cols-[1fr_1fr]">
        <div>
          <I18n.h2 className="text-xl font-semibold tracking-tight">Nasıl ayakta kalıyoruz?</I18n.h2>
          <I18n.p className="mt-3 text-[13px] leading-relaxed text-muted">
            {SITE.name}&apos;de ücretli ilan, komisyon ya da uygulama içi ödeme yok. Sunucu ve bakım giderlerini sitedeki
            reklamlarla karşılıyoruz. Reklamlar her zaman “Reklam” etiketiyle ve ilanlardan ayrı gösterilir; hesap,
            mesaj ve ilan verme sayfalarında reklam yoktur.
          </I18n.p>
        </div>
        <div>
          <I18n.h2 className="text-xl font-semibold tracking-tight">Ödeme konusunda</I18n.h2>
          <I18n.p className="mt-3 text-[13px] leading-relaxed text-muted">
            Platform alım satımın tarafı değildir; ödeme ve teslim tamamen alıcı ile satıcı arasındadır. Ürünü görmeden
            ödeme yapma. Güvenli alışveriş ipuçları için{" "}
            <I18n.Link href="/yardim#guvenlik" className="text-accent underline">
              Yardım &amp; güvenlik
            </I18n.Link>{" "}
            sayfasına göz at.
          </I18n.p>
        </div>
      </section>

      <section className="mt-16 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <I18n.h2 className="text-xl font-semibold tracking-tight">Bir sorun mu var, bir fikrin mi?</I18n.h2>
          <I18n.p className="mt-1 text-[13px] text-muted">Önerilerini ve sorunlarını okuyoruz; genellikle 24 saat içinde dönüyoruz.</I18n.p>
        </div>
        <div className="flex flex-wrap gap-3">
          <LinkButton href="/destek" full={false}>
            Bize yaz
          </LinkButton>
          <LinkButton href="/ilan-ver/fotograflar" variant="outline" full={false}>
            Ücretsiz ilan ver
          </LinkButton>
        </div>
      </section>
    </I18n.div>
  );
}
