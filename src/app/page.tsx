import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { LinkButton } from "@/components/ui/Button";
import { TextLink } from "@/components/ui/TextLink";
import { ListingGrid } from "@/components/ListingGrid";
import { AdSlot } from "@/components/AdSlot";
import { JsonLd } from "@/components/JsonLd";
import { SITE, absoluteUrl } from "@/lib/site";
import type { Metadata } from "next";

import { cookies } from "next/headers";
import { getCategories, searchListings } from "@/lib/queries";
import { formatPrice } from "@/lib/format";
import { REGION_COOKIE } from "@/lib/regions";

export const metadata: Metadata = { alternates: { canonical: "/" } };

const siteSchema = [
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE.name,
    url: absoluteUrl("/"),
    inLanguage: "tr",
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: absoluteUrl("/ilanlar?q={search_term_string}") },
      "query-input": "required name=search_term_string",
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE.name,
    url: absoluteUrl("/"),
    logo: absoluteUrl("/brand/icon-512.png"),
    areaServed: "Cyprus",
  },
];

const howItWorks = [
  {
    icon: "search" as const,
    title: "Keşfet",
    desc: "Kategorileri gez, sana uygun eşyayı bul.",
  },
  {
    icon: "chat" as const,
    title: "Konuş",
    desc: "Satıcıyla mesajlaş, aklındakileri sor.",
  },
  {
    icon: "users" as const,
    title: "Buluş",
    desc: "Ürünü gör, kontrol et ve anlaş.",
  },
];

export default async function HomePage() {
  const region = (await cookies()).get(REGION_COOKIE)?.value;
  const [categories, latest, nearby] = await Promise.all([
    getCategories(),
    searchListings({ pageSize: 8 }),
    searchListings({ pageSize: 4, city: region ?? "Girne", sort: "yeni" }),
  ]);
  const featured = latest.items.find((l) => l.featured) ?? latest.items[0];
  const nearbyItems = nearby.items.length > 0 ? nearby.items : latest.items.slice(4, 8);

  return (
    <div className="mx-auto flex max-w-[1328px] flex-col gap-12 px-4 pb-16 pt-6 sm:gap-16 sm:px-6 sm:pt-8">
      <JsonLd data={siteSchema} />
      <section className="grid grid-cols-1 overflow-hidden rounded-hero bg-bg sm:min-h-[490px] sm:grid-cols-2">
        <div className="flex flex-col items-start justify-center gap-1 px-6 py-8 sm:px-12 sm:py-11">
          <span className="text-[9px] font-semibold tracking-[1.8px] text-accent">
            KIBRIS&apos;TA YENİDEN KEŞFET
          </span>
          <h1 className="my-4 text-[38px] font-medium leading-[1.08] tracking-[-1.8px] sm:text-[56px] sm:leading-[1.05] sm:tracking-[-2.8px]">
            Güzel şeyler
            <br />
            <span className="font-normal">ikinci kez</span> sevilir.
          </h1>
          <p className="text-[13px] leading-[1.8] text-muted sm:text-[15px]">
            Evine, hobine, hayatına iyi gelecek eşyalar.
            <br />
            Hepsi adada, belki hemen yakınında.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-4 sm:mt-6 sm:gap-5">
            <LinkButton href="/ilanlar" full={false} icon={<Icon name="arrow" className="h-4 w-4" />}>
              İlanları keşfet
            </LinkButton>
            <TextLink href="/ilan-ver/fotograflar" underline>
              Sen de ilan ver
            </TextLink>
          </div>
          <div className="mt-6 hidden items-center gap-3 text-[10px] leading-[1.5] text-muted sm:flex sm:mt-7">
            <span className="flex pl-1">
              {(["user", "chat", "heart"] as const).map((i) => (
                <i
                  key={i}
                  className="-ml-1.5 grid h-8 w-8 place-items-center rounded-full border-[3px] border-bg bg-[#e1e6eb] not-italic text-[#2c333b]"
                >
                  <Icon name={i} className="h-3.5 w-3.5" />
                </i>
              ))}
            </span>
            <span>
              Adadan insanlarla,
              <br />
              <b className="text-text">doğrudan iletişim.</b>
            </span>
          </div>
        </div>
        {featured ? (
        <div className="relative hidden min-h-[300px] sm:block">
          <Image
            src={featured.image}
            alt={featured.title}
            priority
            fill
            className="object-cover"
            sizes="(min-width: 640px) 50vw, 100vw"
          />
          <div className="absolute right-7 top-7 flex h-[90px] w-[90px] rotate-12 flex-col items-center justify-center rounded-full bg-white text-center text-[10px] leading-[1.5] text-[#111318]">
            İKİNCİ EL.
            <b>YENİ HİKÂYE.</b>
          </div>
          <Link
            href={`/ilan/${featured.slug}`}
            className="absolute bottom-6 left-6 right-6 flex items-center justify-between rounded-xl bg-white/93 px-5 py-4 text-left text-[#111318] backdrop-blur"
          >
            <span>
              <small className="block text-[9px] tracking-[1.3px] text-[#596473]">
                {[featured.city, featured.district].filter(Boolean).join(" · ").toLocaleUpperCase("tr-TR")}
              </small>
              <b className="mt-1 block text-[17px]">{featured.title}</b>
              <strong className="mt-0.5 block text-[15px] font-medium">
                {formatPrice(featured.price, featured.currency)}
              </strong>
            </span>
            <span className="grid h-[42px] w-[42px] place-items-center rounded-full bg-[#111318] text-white">
              <Icon name="arrow" className="h-4 w-4" />
            </span>
          </Link>
        </div>
        ) : (
          <div className="relative hidden min-h-[300px] sm:block">
            <Image src="/images/demo-chair.jpg" alt="" fill priority className="object-cover" sizes="50vw" />
          </div>
        )}
      </section>

      <section>
        <div className="mb-6 flex items-end justify-between gap-5">
          <div>
            <h2 className="text-xl font-semibold tracking-tight sm:text-[27px]">Ne arıyorsun?</h2>
            <p className="mt-1 text-[13px] text-muted">Bir kategoriden başlayabilirsin.</p>
          </div>
          <TextLink href="/kategori" underline className="flex-shrink-0">
            Tüm kategoriler
          </TextLink>
        </div>
        <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-8 sm:gap-4">
          {categories
            .slice(0, 8)
            .map((cat) => (
              <Link
                key={cat.slug}
                href={`/kategori/${cat.slug}`}
                className="flex flex-col items-center gap-2 text-[10px] sm:gap-3 sm:text-xs"
              >
                <span className="grid h-[59px] w-full place-items-center rounded-[10px] border border-border bg-bg transition group-hover:bg-accent-soft sm:h-[87px] sm:rounded-2xl">
                  <Icon name={cat.icon} className="h-6 w-6 sm:h-[30px] sm:w-[30px]" strokeWidth={1.4} />
                </span>
                <b className="text-center font-medium">{cat.name}</b>
              </Link>
            ))}
        </div>
      </section>

      <section>
        <div className="mb-6 flex items-end justify-between gap-5">
          <div>
            <h2 className="text-xl font-semibold tracking-tight sm:text-[27px]">Yeni keşifler</h2>
            <p className="mt-1 text-[13px] text-muted">Adanın dört bir yanından, yeni eklenenler.</p>
          </div>
          <TextLink href="/ilanlar" underline className="flex-shrink-0">
            Tüm ilanları gör
          </TextLink>
        </div>
        <ListingGrid items={latest.items} />
      </section>

      <AdSlot placement="home" />

      <section className="flex flex-col gap-5 rounded-2xl bg-text px-6 py-8 text-surface sm:flex-row sm:items-center sm:gap-6 sm:px-9">
        <div className="hidden h-[74px] w-[74px] flex-shrink-0 place-items-center rounded-full border border-[#9da4af]/30 sm:grid">
          <Icon name="pin" className="h-8 w-8" strokeWidth={1.5} />
        </div>
        <div>
          <span className="text-[9px] font-semibold tracking-[1.8px] text-[#9ba7bb]">
            MAHALLENDEN BİR MERHABA
          </span>
          <h2 className="mt-1.5 text-xl font-semibold sm:text-[26px]">
            Belki de aradığın, bir sokak ötede.
          </h2>
          <p className="mt-2 text-xs opacity-65">Konumunu seç, yakınındaki ilanları keşfet.</p>
        </div>
        <LinkButton
          href="/konum"
          variant="inverse"
          full={false}
          icon={<Icon name="arrow" className="h-4 w-4" />}
          className="sm:ml-auto"
        >
          Bölgemi seç
        </LinkButton>
      </section>

      <section>
        <div className="mb-6 flex items-end justify-between gap-5">
          <div>
            <h2 className="text-xl font-semibold tracking-tight sm:text-[27px]">Sana yakın</h2>
            <p className="mt-1 text-[13px] text-muted">
              {nearby.items.length > 0
                ? `${region ?? "Girne"} ve çevresindeki ilanlar.`
                : "Bölgende henüz ilan yok; adanın geri kalanından seçtiklerimiz."}
            </p>
          </div>
          <TextLink href="/konum" underline className="flex-shrink-0">
            Konumu değiştir
          </TextLink>
        </div>
        <ListingGrid items={nearbyItems} />
      </section>

      <section className="flex flex-col gap-6 rounded-2xl border border-border bg-bg px-6 py-8 sm:px-9 lg:flex-row lg:items-center lg:gap-10">
        <div className="flex-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1 text-[10px] font-semibold tracking-[1px] text-on-brand">
            <Icon name="spark" className="h-3 w-3" />
            YAKINDA
          </span>
          <h2 className="mt-3 text-xl font-semibold tracking-tight sm:text-[26px]">İlanını öne çıkar, daha hızlı sat.</h2>
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted">
            Üste taşıma, vitrin ve mağazalara özel paketlerle ilanın daha çok kişiye ulaşacak. Şimdilik bilgilendirme
            amaçlı; hiçbir paket için ödeme alınmıyor.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              { icon: "arrow" as const, label: "Üste taşı" },
              { icon: "spark" as const, label: "Vitrin" },
              { icon: "store" as const, label: "Mağaza Plus" },
            ].map((p) => (
              <span
                key={p.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[11px] font-medium"
              >
                <Icon name={p.icon} className="h-3.5 w-3.5" />
                {p.label}
              </span>
            ))}
          </div>
        </div>
        <LinkButton href="/one-cikar" full={false} icon={<Icon name="arrow" className="h-4 w-4" />} className="flex-shrink-0 self-start lg:self-center">
          Paketleri incele
        </LinkButton>
      </section>

      <section className="grid grid-cols-1 gap-7 pt-1.5 sm:grid-cols-3 sm:gap-12">
        {howItWorks.map((item, i) => (
          <div key={item.title} className="relative min-h-[62px] pl-[70px] sm:pl-19">
            <span className="absolute left-0 top-0 grid h-12 w-12 place-items-center rounded-full bg-bg text-accent sm:h-13 sm:w-13">
              <Icon name={item.icon} className="h-5 w-5" />
            </span>
            <span className="text-[9px] text-muted">0{i + 1}</span>
            <h3 className="my-0.5 text-lg font-semibold sm:text-xl">{item.title}</h3>
            <p className="text-[11px] text-muted sm:text-xs">{item.desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
