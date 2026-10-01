import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { Icon, type IconName } from "@/components/icons";
import { ListingCard, ListingGrid } from "@/components/ListingCard";
import { RecentlyViewed } from "@/components/RecentlyViewed";
import { AdSlot } from "@/components/AdSlot";
import { JsonLd } from "@/components/JsonLd";
import { LinkButton } from "@/components/ui/Button";
import { getTaxonomy } from "@/lib/api/server";
import { searchPublic } from "@/lib/api/listings";
import { buildTree, categoryLabel } from "@/lib/taxonomy";
import { REGION_COOKIE } from "@/lib/regions";
import { SITE, absoluteUrl } from "@/lib/site";
import { getI18n } from "@/lib/i18n/server";

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
    areaServed: { "@type": "Place", name: "Cyprus" },
  },
];

function SectionHead({ title, sub, href, linkLabel }: { title: string; sub?: string; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4 sm:mb-5">
      <div className="min-w-0">
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
        {sub ? <p className="mt-1 text-[14px] text-muted">{sub}</p> : null}
      </div>
      {href && linkLabel ? (
        <Link href={href} className="flex flex-shrink-0 items-center gap-1 text-[14px] font-semibold text-accent hover:underline">
          {linkLabel}
          <Icon name="chevron" className="h-4 w-4" />
        </Link>
      ) : null}
    </div>
  );
}

export default async function HomePage() {
  const region = (await cookies()).get(REGION_COOKIE)?.value;
  const [{ t, locale }, taxonomy, featured, latest, nearby] = await Promise.all([
    getI18n(),
    getTaxonomy(),
    searchPublic({ featured: 1, pageSize: 10 }, 60),
    searchPublic({ pageSize: 15 }),
    region ? searchPublic({ city: region, pageSize: 5 }) : Promise.resolve(null),
  ]);
  const tree = buildTree(taxonomy.categories);

  return (
    <div className="mx-auto flex max-w-[1320px] flex-col gap-12 px-4 pb-16 pt-5 sm:gap-14 sm:px-6 sm:pt-8">
      <JsonLd data={siteSchema} />

      {/* Entry: what the site is, and the fastest way in (category shortcuts). */}
      <section>
        <div className="grid items-center gap-6 py-2 sm:py-4 lg:grid-cols-[1.1fr_1fr] lg:gap-12">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-accent">{t("Kıbrıs'ın ikinci el pazarı")}</p>
            <h1 className="mt-3 text-[30px] font-bold leading-[1.1] tracking-[-0.02em] sm:text-[42px]">
              {t("Adada ne aradıysan, bir mesaj uzağında.")}
            </h1>
            <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-muted sm:text-[16px]">
              {t("Lefkoşa'dan Baf'a binlerce eşya. Ücretsiz ilan ver, satıcıyla doğrudan konuş, buluşup elden teslim al.")}
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <LinkButton href="/ilanlar" size="lg" iconEnd={<Icon name="arrow" className="h-4 w-4" />}>
                {t("İlanlara göz at")}
              </LinkButton>
              <LinkButton href="/ilan-ver" size="lg" variant="secondary" icon={<Icon name="plus" className="h-4 w-4" />}>
                {t("Ücretsiz ilan ver")}
              </LinkButton>
            </div>
          </div>
          <nav aria-label={t("Kategoriler")} className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4">
            {tree.slice(0, 11).map((c) => (
              <Link
                key={c.id}
                href={`/kategori/${c.slug}`}
                className="group flex flex-col items-center gap-2 rounded-card border border-border bg-surface px-2 py-3.5 text-center transition hover:border-border-strong hover:shadow-sm"
              >
                <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-soft transition group-hover:bg-accent-soft group-hover:text-accent">
                  <Icon name={c.icon as IconName} className="h-5 w-5" />
                </span>
                <span className="line-clamp-2 text-[12px] font-medium leading-tight sm:text-[13px]">{categoryLabel(c, locale)}</span>
              </Link>
            ))}
            <Link
              href="/kategori"
              className="flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-border-strong px-2 py-3.5 text-center text-[12px] font-semibold text-muted hover:text-text sm:text-[13px]"
            >
              <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-soft">
                <Icon name="grid" className="h-5 w-5" />
              </span>
              {t("Tümü")}
            </Link>
          </nav>
        </div>
      </section>

      {featured.items.length ? (
        <section aria-labelledby="vitrin">
          <div id="vitrin" className="sr-only">
            {t("Vitrin")}
          </div>
          <SectionHead title={t("Vitrin")} sub={t("Ekibimizin öne çıkardığı ilanlar.")} href="/ilanlar?vitrin=1" linkLabel={t("Tümü")} />
          <ListingGrid items={featured.items} priorityCount={5} />
        </section>
      ) : null}

      <section>
        <SectionHead
          title={t("Yeni eklenenler")}
          sub={latest.total ? t(`Adanın dört bir yanından, bugüne kadar ${latest.total.toLocaleString("tr-TR")} ilan.`) : undefined}
          href="/ilanlar"
          linkLabel={t("Tüm ilanlar")}
        />
        {latest.items.length ? (
          <ListingGrid items={latest.items} priorityCount={featured.items.length ? 0 : 5} />
        ) : (
          <div className="rounded-card border border-dashed border-border-strong px-6 py-12 text-center">
            <p className="font-semibold">{t("İlk ilanı sen ver.")}</p>
            <p className="mt-1 text-[14px] text-muted">{t("Henüz yayında ilan yok. Evindeki fazlalıkları iki dakikada ilana dönüştür.")}</p>
          </div>
        )}
      </section>

      <RecentlyViewed />

      <AdSlot placement="home" />

      <section className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <div className="flex flex-col justify-between gap-6 rounded-hero bg-brand p-6 text-on-brand sm:p-8">
          <div>
            <Icon name="pin" className="h-7 w-7 opacity-80" />
            <h2 className="mt-4 text-2xl font-bold tracking-tight">{region ? t(`${region} yakınında`) : t("Yakınındaki ilanlar")}</h2>
            <p className="mt-2 text-[14px] leading-relaxed opacity-75">
              {region
                ? t("Bölgendeki yeni ilanlar. Aynı şehirde buluşmak hem kolay hem güvenli.")
                : t("Bölgeni seç; sana en yakın ilanları önce gösterelim.")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/konum" variant="inverse" size="sm">
              {region ? t("Bölgeyi değiştir") : t("Bölgemi seç")}
            </LinkButton>
            {region ? (
              <LinkButton href={`/ilanlar?sehir=${encodeURIComponent(region)}`} variant="inverse" size="sm">
                {t("Tümünü gör")}
              </LinkButton>
            ) : null}
          </div>
        </div>
        {nearby && nearby.items.length ? (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4">
            {nearby.items.slice(0, 3).map((item) => (
              <ListingCard key={item.id} listing={item} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {taxonomy.regions.map((r) => (
              <Link
                key={r.slug}
                href={`/ilanlar?sehir=${encodeURIComponent(r.name)}`}
                className="flex items-center justify-between rounded-card border border-border px-4 py-3.5 text-[14px] font-medium hover:border-border-strong hover:shadow-sm"
              >
                {r.name}
                <Icon name="chevron" className="h-4 w-4 text-subtle" />
              </Link>
            ))}
          </div>
        )}
      </section>

      {tree.length ? (
        <section>
          <SectionHead title={t("Kategorilere göz at")} href="/kategori" linkLabel={t("Tüm kategoriler")} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {tree.slice(0, 8).map((c) => (
              <div key={c.id} className="rounded-card border border-border p-4">
                <Link href={`/kategori/${c.slug}`} className="flex items-center gap-2.5 font-semibold hover:text-accent">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-soft">
                    <Icon name={c.icon as IconName} className="h-[18px] w-[18px]" />
                  </span>
                  {categoryLabel(c, locale)}
                </Link>
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {c.children.slice(0, 5).map((s) => (
                    <li key={s.id}>
                      <Link href={`/kategori/${s.slug}`} className="inline-block rounded-pill bg-brand-soft px-2.5 py-1 text-[12px] text-muted hover:text-text">
                        {categoryLabel(s, locale)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        {(
          [
            { icon: "camera", title: "Fotoğrafını çek, ilan ver", desc: "Kategoriye göre sorulan birkaç soru ve fotoğraflar; iki dakikada yayına hazır." },
            { icon: "chat", title: "Uygulama içinden konuş", desc: "Numaranı paylaşmadan mesajlaş. Soruları sor, pazarlığı yap." },
            { icon: "handshake", title: "Buluş ve değerlendir", desc: "Ürünü görerek al. Buluşmayı iki taraf onaylayınca birbirinizi değerlendirin." },
          ] as { icon: IconName; title: string; desc: string }[]
        ).map((step, i) => (
          <div key={step.title} className="flex gap-4 rounded-card border border-border bg-surface p-5">
            <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-full bg-brand text-on-brand">
              <Icon name={step.icon} className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[12px] font-semibold text-subtle tabular">0{i + 1}</p>
              <h3 className="font-semibold">{t(step.title)}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">{t(step.desc)}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-4 rounded-hero border border-border p-6 sm:flex-row sm:items-center sm:p-8">
        <span className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-full bg-success-soft text-success">
          <Icon name="shield" className="h-6 w-6" />
        </span>
        <div className="flex-1">
          <h2 className="text-lg font-bold">{t("Güvenli alışverişin üç kuralı")}</h2>
          <p className="mt-1 text-[14px] leading-relaxed text-muted">
            {t("Ürünü görmeden ödeme yapma, kalabalık bir yerde buluş, kapora ya da kargo ücreti isteyenlere karşı dikkatli ol.")}
          </p>
        </div>
        <LinkButton href="/yardim" variant="outline">
          {t("Güvenlik rehberi")}
        </LinkButton>
      </section>
    </div>
  );
}
