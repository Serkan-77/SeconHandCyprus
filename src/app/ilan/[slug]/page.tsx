import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Icon } from "@/components/icons";
import { JsonLd } from "@/components/JsonLd";
import { AdSlot } from "@/components/AdSlot";
import { ListingGrid, ListingRail } from "@/components/ListingCard";
import { SectionHead } from "@/components/SectionHead";
import { RecentlyViewed } from "@/components/RecentlyViewed";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { Notice } from "@/components/ui/FormError";
import { Stars } from "@/components/ui/Stars";
import { Gallery } from "@/components/listing/Gallery";
import { RegionMap } from "@/components/listing/RegionMap";
import { ContactActions, MobileActionBar } from "@/components/listing/ContactActions";
import { ReportDialog } from "@/components/listing/ReportDialog";
import { ViewBeacon } from "@/components/listing/ViewBeacon";
import { Description } from "@/components/listing/Description";
import { apiServer, apiServerOrNull, getMe, getTaxonomy } from "@/lib/api/server";
import type { ListingCard, ListingPage } from "@/lib/api/types";
import { formatPrice } from "@/lib/format";
import { absoluteUrl } from "@/lib/site";
import { getI18n } from "@/lib/i18n/server";
import { SHELL } from "@/lib/layout";
import { cn } from "@/lib/cn";
import { categoryLabel } from "@/lib/taxonomy";
import { CONDITION_INFO, type Condition } from "@shared/constants";

const getListing = cache((slug: string) => apiServerOrNull<ListingPage>(`/listings/${encodeURIComponent(slug)}`));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await getListing(slug);
  if (!page) return { title: "İlan bulunamadı", robots: { index: false } };
  const { listing } = page;
  const price = formatPrice(listing.price, listing.currency);
  const where = listing.district ? `${listing.city}, ${listing.district}` : listing.city;
  return {
    title: `${listing.title} — ${price}`,
    alternates: { canonical: `/ilan/${listing.slug}` },
    // Sold, pending or hidden listings stay reachable for their owner but are not indexed.
    robots: listing.status === "active" ? undefined : { index: false, follow: true },
    description: `${price} · ${where} · ${listing.condition}. ${listing.description}`.replace(/\s+/g, " ").slice(0, 160),
    openGraph: {
      title: `${listing.title} · ${price}`,
      description: `${where} · ${listing.condition}`,
      type: "website",
      url: absoluteUrl(`/ilan/${listing.slug}`),
      images: listing.images[0]?.urls ? [{ url: absoluteUrl(listing.images[0].urls.md), alt: listing.title }] : undefined,
    },
  };
}

const STATUS_NOTICE: Record<string, string> = {
  pending: "Bu ilan incelemede. Onaylandığında herkes görebilecek.",
  rejected: "Bu ilan yayınlanamadı. Düzenleyip tekrar incelemeye gönderebilirsin.",
  sold: "Bu ilanı satıldı olarak işaretledin; aramalarda görünmüyor.",
  removed: "Bu ilan yayından kaldırıldı.",
  draft: "Bu ilan taslak olarak kayıtlı.",
};

export default async function ListingDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getListing(slug);
  if (!page) notFound();
  if (page.redirectSlug && page.redirectSlug !== slug) permanentRedirect(`/ilan/${page.redirectSlug}`);

  const { listing, seller, viewer } = page;
  const [{ t, f, locale }, me, taxonomy, related] = await Promise.all([
    getI18n(),
    getMe(),
    getTaxonomy(),
    apiServer<{ similar: ListingCard[]; sellerOthers: ListingCard[] }>(`/listings/${listing.id}/related`).catch(() => ({ similar: [], sellerOthers: [] })),
  ]);
  const active = listing.status === "active";
  const region = taxonomy.regions.find((r) => r.name === listing.city);
  const specs = locale === "en" ? listing.specsEn : listing.specs;
  const condition = listing.condition as Condition;
  const card: ListingCard = { ...listing };

  const product = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: listing.title,
    description: listing.description || listing.title,
    sku: `KB${listing.refNo}`,
    image: listing.images.flatMap((i) => (i.urls ? [absoluteUrl(i.urls.lg)] : [])),
    category: listing.categoryPath.map((c) => c.name).join(" > "),
    ...(listing.specs.flatMap((g) => g.rows).find((r) => r.key === "brand")
      ? { brand: { "@type": "Brand", name: listing.specs.flatMap((g) => g.rows).find((r) => r.key === "brand")!.value } }
      : {}),
    offers: {
      "@type": "Offer",
      url: absoluteUrl(`/ilan/${listing.slug}`),
      price: listing.price,
      priceCurrency: listing.currency === "€" ? "EUR" : "TRY",
      itemCondition: listing.condition === "Sıfır" ? "https://schema.org/NewCondition" : "https://schema.org/UsedCondition",
      availability: active ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
      areaServed: { "@type": "City", name: listing.city },
      seller: { "@type": seller.isStore ? "Organization" : "Person", name: seller.name, url: absoluteUrl(`/satici/${seller.id}`) },
    },
  };

  const contactProps = {
    listingId: listing.id,
    slug: listing.slug,
    title: listing.title,
    price: listing.price,
    currency: listing.currency,
    active,
    signedIn: Boolean(me),
    isOwner: viewer.isOwner,
    conversationId: viewer.conversationId,
    acceptsWhatsapp: listing.acceptsWhatsapp,
  };

  const conditionLabel = locale === "en" ? CONDITION_INFO[condition]?.en ?? condition : condition;
  const allRows = specs.flatMap((g) => g.rows);
  // The few facts a buyer decides on, shown big under the title.
  const keyFacts = [{ label: t("Durum"), value: conditionLabel }, ...allRows.slice(0, 3).map((r) => ({ label: r.label, value: r.value }))];

  return (
    <div className="pb-28 lg:pb-16">
      <JsonLd data={product} />
      <ViewBeacon card={card} count={active && !viewer.isOwner} />

      <div className={cn(SHELL, "pt-3 sm:pt-5")}>
        <Breadcrumbs
          items={[
            ...listing.categoryPath.map((c) => ({ label: categoryLabel(c, locale), href: `/kategori/${c.slug}` })),
            { label: listing.title },
          ]}
        />

        {viewer.isOwner && !active ? (
          <Notice tone={listing.status === "rejected" ? "danger" : "warning"} className="mt-4">
            <p className="font-semibold">{t(STATUS_NOTICE[listing.status] ?? "")}</p>
            {listing.rejectReason ? <p className="mt-1">{t("Gerekçe:")} <span translate="no">{listing.rejectReason}</span></p> : null}
          </Notice>
        ) : null}

        <div className="mt-3 sm:mt-4">
          <Gallery
            photos={listing.images}
            title={listing.title}
            badge={
              listing.featured ? (
                <Badge kind="sand" icon={<Icon name="spark" className="h-3 w-3" />}>
                  {t("Vitrin")}
                </Badge>
              ) : null
            }
          />
        </div>

        <div className="mt-6 grid gap-10 lg:mt-8 lg:grid-cols-[minmax(0,1fr)_400px] xl:gap-16">
          <div className="min-w-0">
            {/* Title */}
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <span className="rounded-full bg-brand px-2.5 py-1 font-semibold text-on-brand">{conditionLabel}</span>
              {listing.negotiable ? <span className="rounded-full border border-accent px-2.5 py-0.5 font-semibold text-accent">{t("Pazarlığa açık")}</span> : null}
              {listing.status === "sold" ? <Badge kind="danger">{t("Satıldı")}</Badge> : null}
              <span className="text-muted">{listing.categoryPath.map((c) => categoryLabel(c, locale)).join(" › ")}</span>
            </div>
            <h1 className="mt-3 text-[26px] font-bold leading-[1.15] tracking-[-0.025em] sm:text-[36px]">
              <span translate="no">{listing.title}</span>
            </h1>
            <p className="mt-2 text-[30px] font-bold tracking-tight tabular lg:hidden">{f("formatPrice", listing.price, listing.currency)}</p>
            <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-muted">
              <span className="flex items-center gap-1.5 text-text">
                <Icon name="pin" className="h-4 w-4" />
                {listing.district ? `${listing.city}, ${listing.district}` : listing.city}
              </span>
              <span className="flex items-center gap-1.5">
                <Icon name="clock" className="h-4 w-4" />
                {f("formatLongDate", listing.publishedAt ?? listing.createdAt)}
              </span>
              <span className="tabular">
                {t("İlan no")} KB{listing.refNo}
              </span>
            </p>

            {/* Key facts strip */}
            <dl className="mt-6 grid grid-cols-2 border-y border-border sm:grid-cols-4">
              {keyFacts.map((k, i) => (
                <div
                  key={k.label}
                  className={cn("py-4 pr-4", i % 2 === 1 && "pl-4 sm:pl-0", i > 0 && "sm:border-l sm:border-border sm:pl-5", i > 1 && "border-t border-border sm:border-t-0")}
                >
                  <dt className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted">{k.label}</dt>
                  <dd className="mt-1 truncate text-[16px] font-semibold" translate="no">
                    {k.value}
                  </dd>
                </div>
              ))}
            </dl>

            {/* Phones: contact right after the facts */}
            <div className="mt-6 lg:hidden">
              <ContactActions {...contactProps} />
            </div>

            <section className="mt-10" aria-labelledby="desc">
              <h2 id="desc" className="text-[20px] font-bold tracking-tight">
                {t("Açıklama")}
              </h2>
              {listing.description ? (
                <div className="max-w-[72ch]">
                  <Description text={listing.description} />
                </div>
              ) : (
                <p className="mt-2 text-[15px] text-muted">{t("Satıcı açıklama eklememiş. Merak ettiklerini mesajla sorabilirsin.")}</p>
              )}
            </section>

            {specs.length ? (
              <section className="mt-10" aria-labelledby="specs">
                <h2 id="specs" className="text-[20px] font-bold tracking-tight">
                  {t("Özellikler")}
                </h2>
                <div className="mt-4 grid gap-x-12 gap-y-6 sm:grid-cols-2">
                  {specs.map((g) => (
                    <div key={g.group}>
                      <p className="mb-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">{g.group}</p>
                      <dl>
                        {g.rows.map((r) => (
                          <div key={r.key} className="flex items-baseline justify-between gap-4 border-b border-border py-2.5 text-[14.5px]">
                            <dt className="text-muted">{r.label}</dt>
                            <dd className="text-right font-medium" translate="no">
                              {r.value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="mt-10 grid items-center gap-6 sm:grid-cols-[1fr_1.1fr]" aria-labelledby="where">
              <div>
                <h2 id="where" className="text-[20px] font-bold tracking-tight">
                  {t("Konum ve teslimat")}
                </h2>
                <p className="mt-2 text-[16px] font-semibold">
                  {listing.city}
                  {listing.district ? <span className="font-normal text-muted"> · {listing.district}</span> : null}
                </p>
                <p className="mt-1 text-[14px] text-muted">
                  {region?.side === "south" ? t("Güney Kıbrıs") : t("Kuzey Kıbrıs")} · {t("Tam adres paylaşılmaz; buluşma yerini mesajla kararlaştırın.")}
                </p>
              </div>
              {region ? <RegionMap lat={region.lat} lng={region.lng} label={t(`${listing.city} bölgesi haritada`)} /> : null}
            </section>

            <section className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border pt-5 text-[13.5px]" aria-labelledby="safety">
              <h2 id="safety" className="flex items-center gap-2 font-semibold">
                <Icon name="shield" className="h-4 w-4 text-success" />
                {t("Güvenli alışveriş için")}
              </h2>
              <span className="text-muted">{t("Ürünü görmeden para gönderme, kapora ödeme.")}</span>
              <Link href="/yardim" className="font-semibold underline underline-offset-4 hover:text-accent">
                {t("Güvenlik rehberi")}
              </Link>
              <span className="ml-auto flex items-center gap-4 text-muted">
                <span className="tabular">{t(`${f("formatNumber", listing.viewCount)} görüntülenme`)}</span>
                {!viewer.isOwner ? <ReportDialog target={{ kind: "listing", id: listing.id }} signedIn={Boolean(me)} /> : null}
              </span>
            </section>
          </div>

          {/* Purchase card */}
          <aside className="min-w-0">
            <div className="flex flex-col gap-4 lg:sticky lg:top-[150px]">
              <div className="hidden rounded-[20px] border border-border p-6 shadow-sm lg:block">
                <p className="text-[38px] font-bold leading-none tracking-[-0.03em] tabular">{f("formatPrice", listing.price, listing.currency)}</p>
                <p className="mt-2 text-[13px] text-muted">{listing.negotiable ? t("Satıcı pazarlığa açık.") : t("Fiyat sabit.")}</p>
                <div className="mt-5">
                  <ContactActions {...contactProps} />
                </div>
                <SellerBlock seller={seller} t={t} f={f} />
              </div>
              <div className="rounded-[20px] border border-border p-5 lg:hidden">
                <SellerBlock seller={seller} t={t} f={f} compact />
              </div>

              {viewer.isOwner ? (
                <div className="rounded-[20px] bg-brand p-5 text-on-brand">
                  <p className="font-semibold">{t("Bu ilan senin")}</p>
                  <p className="mt-1 text-[13px] opacity-75">
                    {listing.favoriteCount != null ? t(`${listing.favoriteCount} kişi favorilerine ekledi · ${listing.viewCount} görüntülenme`) : null}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <LinkButton href={`/hesabim/ilanlar/${listing.id}`} size="sm" variant="inverse" icon={<Icon name="edit" className="h-4 w-4" />}>
                      {t("Düzenle")}
                    </LinkButton>
                    <LinkButton href="/mesajlar" size="sm" variant="inverse">
                      {t("Mesajlar")}
                    </LinkButton>
                  </div>
                </div>
              ) : null}

              <AdSlot placement="listing" />
            </div>
          </aside>
        </div>
      </div>

      {related.sellerOthers.length ? (
        <section className={cn(SHELL, "mt-16")}>
          <SectionHead title={t("Satıcının diğer ilanları")} href={`/satici/${seller.id}`} linkLabel={t("Satıcının profili")} />
          <ListingRail items={related.sellerOthers} />
        </section>
      ) : null}

      {related.similar.length ? (
        <section className={cn(SHELL, "mt-16")}>
          <SectionHead title={t("Benzer ilanlar")} href={`/kategori/${listing.categoryPath.at(-1)?.slug ?? ""}`} linkLabel={t("Tümünü gör")} />
          <ListingGrid items={related.similar} fill />
        </section>
      ) : null}

      <div className={cn(SHELL, "mt-16")}>
        <RecentlyViewed excludeId={listing.id} />
      </div>

      <MobileActionBar {...contactProps} />
    </div>
  );
}

type Formatter = Awaited<ReturnType<typeof getI18n>>["f"];

function SellerBlock({ seller, t, f, compact = false }: { seller: ListingPage["seller"]; t: (s: string) => string; f: Formatter; compact?: boolean }) {
  return (
    <section aria-label={t("Satıcı")} className={cn(!compact && "mt-6 border-t border-border pt-5")}>
      <Link href={`/satici/${seller.id}`} className="group flex items-center gap-3">
        <Avatar name={seller.name} src={seller.avatar} size="md" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate font-semibold group-hover:underline">
            <span className="truncate" translate="no">
              {seller.name}
            </span>
            {seller.isStore && seller.storeVerified ? <Icon name="verified" className="h-4 w-4 flex-shrink-0 text-accent" aria-label={t("Onaylı mağaza")} /> : null}
          </p>
          <p className="text-[13px] text-muted">
            {seller.isStore ? t("Mağaza") : t("Bireysel satıcı")}
            {seller.memberSince ? ` · ${f("memberSince", seller.memberSince)}` : ""}
          </p>
        </div>
        <Icon name="chevron" className="h-5 w-5 text-subtle" />
      </Link>
      <dl className="mt-4 grid grid-cols-3 text-center text-[13px]">
        <div className="flex flex-col-reverse">
          <dt className="mt-0.5 flex items-center justify-center gap-1 text-muted">{seller.ratingCount ? <Stars value={seller.ratingAvg} /> : t("Puan yok")}</dt>
          <dd className="text-[17px] font-bold tabular">{seller.ratingCount ? f("decimal", seller.ratingAvg) : "–"}</dd>
        </div>
        <div className="flex flex-col-reverse border-x border-border">
          <dt className="mt-0.5 text-muted">{t("Yayında")}</dt>
          <dd className="text-[17px] font-bold tabular">{seller.activeListings}</dd>
        </div>
        <div className="flex flex-col-reverse">
          <dt className="mt-0.5 text-muted">{t("Satılan")}</dt>
          <dd className="text-[17px] font-bold tabular">{seller.soldListings}</dd>
        </div>
      </dl>
    </section>
  );
}
