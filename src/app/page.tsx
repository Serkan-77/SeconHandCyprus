import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { Icon, type IconName } from "@/components/icons";
import { ListingCard, ListingGrid, ListingRail } from "@/components/ListingCard";
import { RecentlyViewed } from "@/components/RecentlyViewed";
import { AdSlot } from "@/components/AdSlot";
import { JsonLd } from "@/components/JsonLd";
import { SectionHead } from "@/components/SectionHead";
import { Avatar } from "@/components/ui/Avatar";
import { CYPRUS_PATH, MAP_H, MAP_W, project } from "@/components/listing/RegionMap";
import { apiServer, getTaxonomy } from "@/lib/api/server";
import { searchPublic } from "@/lib/api/listings";
import type { ListingCard as Card, PublicProfile, Region } from "@/lib/api/types";
import { buildTree, categoryLabel, type CategoryNode } from "@/lib/taxonomy";
import { REGION_COOKIE } from "@/lib/regions";
import { SITE, absoluteUrl } from "@/lib/site";
import { SHELL } from "@/lib/layout";
import { cn } from "@/lib/cn";
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

type Translate = (s: string) => string;

/** Listing counts per top-level category, from the search facets (leaf counts rolled up). */
function countByTop(tree: CategoryNode[], facets: { categoryId: number; count: number }[]) {
  const byId = new Map(facets.map((f) => [f.categoryId, f.count]));
  const total = (n: CategoryNode): number => (byId.get(n.id) ?? 0) + n.children.reduce((s, c) => s + total(c), 0);
  return new Map(tree.map((c) => [c.id, total(c)]));
}

export default async function HomePage() {
  const region = (await cookies()).get(REGION_COOKIE)?.value ?? null;
  const [{ t, locale }, taxonomy, featured, latest, all] = await Promise.all([
    getI18n(),
    getTaxonomy(),
    searchPublic({ featured: 1, pageSize: 12 }, 60),
    searchPublic({ pageSize: 14 }),
    searchPublic({ pageSize: 1, facets: 1 }, 60),
  ]);
  const tree = buildTree(taxonomy.categories);
  const counts = countByTop(tree, all.facets);
  const popular = [...tree].filter((c) => (counts.get(c.id) ?? 0) > 0).sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0));

  const [collections, regionTotals, nearby, stores] = await Promise.all([
    Promise.all(popular.slice(0, 4).map(async (c) => ({ category: c, result: await searchPublic({ category: c.slug, pageSize: 4 }, 60) }))),
    Promise.all(taxonomy.regions.map(async (r) => [r.name, (await searchPublic({ city: r.name, pageSize: 1 }, 60)).total] as const)),
    region ? searchPublic({ city: region, pageSize: 12 }) : Promise.resolve(null),
    apiServer<{ stores: PublicProfile[] }>("/stores?pageSize=6", { anonymous: true, revalidate: 120 }).catch(() => ({ stores: [] as PublicProfile[] })),
  ]);

  // Showcase first; when there are few, the newest listings complete the mosaic (without a Vitrin badge).
  const featuredIds = new Set(featured.items.map((i) => i.id));
  const mosaic = [...featured.items, ...latest.items.filter((i) => !featuredIds.has(i.id))].slice(0, 5);
  const onlyShowcase = featured.items.length >= 5;

  return (
    <div className="pb-16">
      <JsonLd data={siteSchema} />

      {/* Phones: categories as an icon rail directly under the search. */}
      <nav aria-label={t("Kategoriler")} className="no-scrollbar flex gap-1 overflow-x-auto border-b border-border px-3 py-3 lg:hidden">
        {tree.map((c) => (
          <Link key={c.id} href={`/kategori/${c.slug}`} className="flex w-[74px] flex-shrink-0 flex-col items-center gap-1.5 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-soft">
              <Icon name={c.icon as IconName} className="h-6 w-6" />
            </span>
            <span className="line-clamp-2 text-[11.5px] font-medium leading-tight">{categoryLabel(c, locale)}</span>
          </Link>
        ))}
      </nav>

      {/* Discovery: category directory + showcase mosaic. No marketing hero. */}
      <section className={cn(SHELL, "pt-4 lg:pt-6")}>
        <div className="grid gap-6 lg:grid-cols-[264px_minmax(0,1fr)] xl:gap-8">
          <aside className="hidden lg:block" aria-label={t("Kategoriler")}>
            <p className="mb-2 px-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">{t("Kategoriler")}</p>
            <ul>
              {tree.map((c) => {
                const n = counts.get(c.id) ?? 0;
                return (
                  <li key={c.id}>
                    <Link href={`/kategori/${c.slug}`} className="group flex h-11 items-center gap-3 rounded-xl px-3 text-[14.5px] hover:bg-brand hover:text-on-brand">
                      <Icon name={c.icon as IconName} className="h-[19px] w-[19px]" />
                      <span className="flex-1 truncate font-medium">{categoryLabel(c, locale)}</span>
                      <span className={cn("text-[12.5px] tabular", n ? "text-muted group-hover:text-on-brand/70" : "text-subtle/60 group-hover:text-on-brand/50")}>{n}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <Link href="/kategori" className="mt-1 flex h-11 items-center gap-3 rounded-xl px-3 text-[14px] font-semibold text-accent hover:bg-accent-soft">
              <Icon name="grid" className="h-[19px] w-[19px]" />
              {t("Tüm kategoriler")}
            </Link>
          </aside>

          <div className="min-w-0">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
              <div>
                <h1 className="text-[26px] font-bold leading-tight tracking-[-0.025em] sm:text-[32px]">
                  {t(onlyShowcase ? "Vitrin" : "Öne çıkanlar")}
                </h1>
                <p className="mt-1 text-[14px] text-muted">
                  {t("Kıbrıs'ın ikinci el pazarı")} · <span className="font-semibold text-text tabular">{all.total}</span> {t("ilan yayında")}
                </p>
              </div>
              <Link href="/ilanlar?vitrin=1" className="flex-shrink-0 border-b-2 border-brand pb-0.5 text-[14px] font-semibold hover:border-accent hover:text-accent">
                {t("Vitrinin tamamı")}
              </Link>
            </div>

            {mosaic.length ? (
              <>
                {/* Desktop mosaic: one large tile and four smaller ones. */}
                <div className="hidden h-[min(560px,calc(100vh-240px))] min-h-[440px] grid-cols-4 grid-rows-2 gap-3 md:grid">
                  {mosaic.map((item, i) => (
                    <ListingCard
                      key={item.id}
                      listing={item}
                      layout="feature"
                      priority={i < 3}
                      className={cn(i === 0 && "col-span-2 row-span-2", mosaic.length < 5 && i === mosaic.length - 1 && "col-span-2")}
                    />
                  ))}
                </div>
                {/* Phones: the same tiles as a swipeable rail. */}
                <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 sm:-mx-6 sm:px-6 md:hidden">
                  {mosaic.map((item, i) => (
                    <ListingCard key={item.id} listing={item} layout="feature" priority={i === 0} className="aspect-[4/5] w-[78vw] max-w-[340px] flex-shrink-0 snap-start" />
                  ))}
                </div>
              </>
            ) : (
              <EmptyMarket t={t} />
            )}
          </div>
        </div>
      </section>

      {/* Newest listings: the dense product grid. */}
      {latest.items.length ? (
        <section className={cn(SHELL, "mt-14")} aria-labelledby="latest-heading">
          <SectionHead id="latest-heading" title={t("Yeni eklenenler")} meta={t("Bugünden geriye")} href="/ilanlar?sirala=yeni" linkLabel={t("Tümünü gör")} />
          <ListingGrid items={latest.items} fill />
        </section>
      ) : null}

      {nearby && nearby.items.length ? (
        <section className={cn(SHELL, "mt-14")} aria-labelledby="near-heading">
          <SectionHead id="near-heading" title={t(`${region} yakınında`)} meta={`${nearby.total} ${t("ilan")}`} href={`/ilanlar?sehir=${encodeURIComponent(region!)}`} linkLabel={t("Tümünü gör")} />
          <ListingRail items={nearby.items} />
        </section>
      ) : null}

      {/* Category collections: real photos of what is listed in each popular category. */}
      {collections.length ? (
        <section className={cn(SHELL, "mt-16")} aria-labelledby="collections-heading">
          <SectionHead id="collections-heading" title={t("Popüler kategoriler")} href="/kategori" linkLabel={t("Tüm kategoriler")} />
          <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:gap-x-5 xl:grid-cols-4">
            {collections.map(({ category, result }) => (
              <Collection key={category.id} category={category} items={result.items} total={counts.get(category.id) ?? result.total} locale={locale} t={t} />
            ))}
          </div>
        </section>
      ) : null}

      <div className={cn(SHELL, "mt-14")}>
        <AdSlot placement="home" />
      </div>

      <RegionsBand regions={taxonomy.regions} totals={new Map(regionTotals)} current={region} t={t} />

      {stores.stores.length ? <StoresRow stores={stores.stores} t={t} /> : null}

      <div className={cn(SHELL, "mt-14")}>
        <RecentlyViewed />
      </div>

      <SellAndSafety t={t} />
    </div>
  );
}

function EmptyMarket({ t }: { t: Translate }) {
  return (
    <div className="grid h-[320px] place-items-center rounded-[18px] border-2 border-dashed border-border-strong text-center">
      <div>
        <p className="text-[18px] font-semibold">{t("İlk ilanı sen ver.")}</p>
        <p className="mt-1 text-[14px] text-muted">{t("Henüz yayında ilan yok. Evindeki fazlalıkları iki dakikada ilana dönüştür.")}</p>
        <Link href="/ilan-ver" className="mt-4 inline-flex h-11 items-center rounded-xl bg-brand px-5 text-[14px] font-semibold text-on-brand">
          {t("İlan ver")}
        </Link>
      </div>
    </div>
  );
}

function Collection({ category, items, total, locale, t }: { category: CategoryNode; items: Card[]; total: number; locale: "tr" | "en"; t: Translate }) {
  const cells = [...items.slice(0, 4), ...Array.from({ length: Math.max(0, 4 - items.length) }, () => null)];
  return (
    <article className="group">
      <Link href={`/kategori/${category.slug}`} className="block overflow-hidden rounded-[18px]">
        <div className="grid aspect-square grid-cols-2 grid-rows-2 gap-1 bg-surface">
          {cells.map((item, i) =>
            item?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={item.id} src={item.image.sm} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
            ) : (
              <span key={i} className="grid place-items-center bg-brand-soft">
                <Icon name={category.icon as IconName} className="h-7 w-7 text-subtle" />
              </span>
            ),
          )}
        </div>
      </Link>
      <div className="mt-3 flex items-center gap-2.5">
        <span className="hidden h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-brand text-on-brand sm:grid">
          <Icon name={category.icon as IconName} className="h-[18px] w-[18px]" />
        </span>
        <Link href={`/kategori/${category.slug}`} className="min-w-0 flex-1 truncate text-[15px] font-bold tracking-tight hover:text-accent sm:text-[17px]">
          {categoryLabel(category, locale)}
        </Link>
        <span className="text-[13px] text-muted tabular">
          {total} {t("ilan")}
        </span>
      </div>
      <p className="mt-2 line-clamp-1 hidden text-[13px] text-muted sm:block">
        {category.children.slice(0, 4).map((s, i) => (
          <span key={s.id}>
            {i ? " · " : ""}
            <Link href={`/kategori/${s.slug}`} className="hover:text-text hover:underline">
              {categoryLabel(s, locale)}
            </Link>
          </span>
        ))}
      </p>
    </article>
  );
}

/** Cyprus by region: a map with real listing counts and both sides of the island as a typographic index. */
function RegionsBand({ regions, totals, current, t }: { regions: Region[]; totals: Map<string, number>; current: string | null; t: Translate }) {
  if (!regions.length) return null;
  const max = Math.max(1, ...regions.map((r) => totals.get(r.name) ?? 0));
  const side = (s: Region["side"]) => regions.filter((r) => r.side === s);
  return (
    <section className={cn(SHELL, "mt-16")} aria-labelledby="regions-heading">
      <div className="dark overflow-hidden rounded-[24px] bg-bg text-text">
        <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-14">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-accent">{t("Bölgeler")}</p>
            <h2 id="regions-heading" className="mt-2 text-[26px] font-bold leading-tight tracking-[-0.02em] sm:text-[34px]">
              {t("Adanın her yerinden ilanlar")}
            </h2>
            <p className="mt-2 max-w-[46ch] text-[14px] leading-relaxed text-muted">{t("Aynı şehirde buluşmak hem kolay hem güvenli. Bölgeni seç, en yakın ilanlar önce gelsin.")}</p>
            <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="mt-6 h-auto w-full max-w-[560px]" role="img" aria-label={t("Kıbrıs haritası, bölgelere göre ilan sayıları")}>
              <path d={CYPRUS_PATH} className="fill-surface stroke-border-strong" strokeWidth="0.6" strokeLinejoin="round" />
              {regions.map((r) => {
                const [x, y] = project([r.lng, r.lat]);
                const n = totals.get(r.name) ?? 0;
                const radius = 2.5 + (n / max) * 4.5;
                return (
                  <a key={r.slug} href={`/ilanlar?sehir=${encodeURIComponent(r.name)}`}>
                    <title>{`${r.name}: ${n}`}</title>
                    <circle cx={x} cy={y} r={radius + 3} className="fill-accent/25" />
                    <circle cx={x} cy={y} r={radius} className={cn("stroke-bg", r.name === current ? "fill-white" : "fill-accent")} strokeWidth="1" />
                  </a>
                );
              })}
            </svg>
          </div>
          <div className="grid grid-cols-2 gap-x-8">
            {(["north", "south"] as const).map((s) => (
              <div key={s}>
                <p className="mb-2 border-b border-border pb-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">{t(s === "north" ? "Kuzey Kıbrıs" : "Güney Kıbrıs")}</p>
                <ul>
                  {side(s).map((r) => (
                    <li key={r.slug}>
                      <Link href={`/ilanlar?sehir=${encodeURIComponent(r.name)}`} className="group flex items-baseline justify-between gap-3 border-b border-border/60 py-3">
                        <span className={cn("text-[19px] font-semibold tracking-tight group-hover:text-accent sm:text-[22px]", r.name === current && "underline decoration-accent decoration-2 underline-offset-4")}>{r.name}</span>
                        <span className="text-[13px] text-muted tabular">{totals.get(r.name) ?? 0}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <Link href="/konum" className="col-span-2 mt-5 inline-flex h-11 w-fit items-center gap-2 rounded-xl bg-brand px-5 text-[14px] font-semibold text-on-brand">
              <Icon name="pin" className="h-4 w-4" />
              {current ? t("Bölgeyi değiştir") : t("Bölgemi seç")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function StoresRow({ stores, t }: { stores: PublicProfile[]; t: Translate }) {
  return (
    <section className={cn(SHELL, "mt-16")} aria-labelledby="stores-heading">
      <SectionHead id="stores-heading" title={t("Mağazalar")} meta={t("İşletmelerden ikinci el")} href="/magazalar" linkLabel={t("Tüm mağazalar")} />
      <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 sm:-mx-6 sm:px-6 xl:mx-0 xl:grid xl:grid-cols-4 xl:px-0">
        {stores.map((s) => (
          <Link key={s.id} href={`/satici/${s.id}`} className="flex w-[280px] flex-shrink-0 items-center gap-4 rounded-[18px] border border-border p-4 transition hover:border-brand xl:w-auto">
            <Avatar name={s.store?.name ?? s.name} src={s.avatar} size="lg" />
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 truncate text-[16px] font-bold">
                <span className="truncate">{s.store?.name ?? s.name}</span>
                {s.store?.verified ? <Icon name="verified" className="h-4 w-4 flex-shrink-0 text-accent" /> : null}
              </p>
              <p className="text-[13px] text-muted">
                {s.region ?? t("Kıbrıs")} · <span className="tabular">{s.stats.activeListings}</span> {t("ilan")}
              </p>
              {s.store?.hours ? <p className="mt-0.5 truncate text-[12px] text-subtle">{s.store.hours}</p> : null}
            </div>
          </Link>
        ))}
        <Link href="/hesabim/magaza" className="flex w-[280px] flex-shrink-0 flex-col justify-center rounded-[18px] border-2 border-dashed border-border-strong p-4 hover:border-brand xl:w-auto">
          <p className="text-[16px] font-bold">{t("Mağazanı aç")}</p>
          <p className="mt-0.5 text-[13px] text-muted">{t("İşletmen için ücretsiz mağaza sayfası.")}</p>
        </Link>
      </div>
    </section>
  );
}

/** Selling and safety, side by side in one band instead of separate info boxes. */
function SellAndSafety({ t }: { t: Translate }) {
  const steps = ["Fotoğrafını çek, ilan ver", "Uygulama içinden konuş", "Buluş ve değerlendir"];
  const rules = ["Ürünü görmeden ödeme yapma.", "Kalabalık bir yerde buluş.", "Kapora ya da kargo ücreti isteyenlere dikkat et."];
  return (
    <section className={cn(SHELL, "mt-16")}>
      <div className="grid overflow-hidden rounded-[24px] border border-border lg:grid-cols-[1.4fr_1fr]">
        <div className="p-6 sm:p-10">
          <h2 className="max-w-[22ch] text-[26px] font-bold leading-tight tracking-[-0.02em] sm:text-[34px]">{t("Evindeki fazlalıklar burada alıcısını bulur.")}</h2>
          <ol className="mt-6 grid gap-4 sm:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s} className="flex items-start gap-3">
                <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-brand text-[13px] font-bold text-on-brand tabular">{i + 1}</span>
                <span className="pt-1 text-[14px] font-medium leading-snug">{t(s)}</span>
              </li>
            ))}
          </ol>
          <Link href="/ilan-ver" className="mt-7 inline-flex h-12 items-center gap-2 rounded-[14px] bg-brand px-6 text-[15px] font-semibold text-on-brand hover:opacity-90">
            <Icon name="plus" className="h-5 w-5" />
            {t("Ücretsiz ilan ver")}
          </Link>
        </div>
        <div className="border-t border-border bg-surface-2 p-6 sm:p-10 lg:border-l lg:border-t-0">
          <p className="flex items-center gap-2 text-[15px] font-bold">
            <Icon name="shield" className="h-5 w-5 text-success" />
            {t("Güvenli alışverişin üç kuralı")}
          </p>
          <ul className="mt-4 space-y-3">
            {rules.map((r) => (
              <li key={r} className="flex items-start gap-3 text-[14px] leading-snug">
                <Icon name="check" className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />
                {t(r)}
              </li>
            ))}
          </ul>
          <Link href="/yardim" className="mt-6 inline-block border-b-2 border-brand pb-0.5 text-[14px] font-semibold hover:border-accent hover:text-accent">
            {t("Güvenlik rehberi")}
          </Link>
        </div>
      </div>
    </section>
  );
}
