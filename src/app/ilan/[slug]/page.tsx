import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Icon } from "@/components/icons";
import { JsonLd } from "@/components/JsonLd";
import { AdSlot } from "@/components/AdSlot";
import { ListingGrid } from "@/components/ListingCard";
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

  return (
    <div className="mx-auto max-w-[1320px] px-4 pb-28 pt-4 sm:px-6 sm:pt-6 lg:pb-16">
      <JsonLd data={product} />
      <ViewBeacon card={card} count={active && !viewer.isOwner} />
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

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-10">
        <div className="min-w-0">
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

          {/* Title block on phones; on large screens it lives in the sidebar. */}
          <div className="mt-5 lg:hidden">
            <TitleBlock page={page} />
          </div>

          {specs.length ? (
            <section className="mt-8" aria-labelledby="specs">
              <h2 id="specs" className="text-lg font-bold">
                {t("Özellikler")}
              </h2>
              <div className="mt-3 overflow-hidden rounded-card border border-border">
                <dl className="grid sm:grid-cols-2">
                  <SpecRow label={t("Durum")} value={locale === "en" ? CONDITION_INFO[condition]?.en ?? condition : condition} />
                  <SpecRow label={t("Kategori")} value={listing.categoryPath.map((c) => categoryLabel(c, locale)).join(" › ")} />
                  {specs.flatMap((g) => g.rows).map((r) => (
                    <SpecRow key={r.key} label={r.label} value={r.value} />
                  ))}
                </dl>
              </div>
            </section>
          ) : (
            <section className="mt-8">
              <h2 className="text-lg font-bold">{t("Özellikler")}</h2>
              <dl className="mt-3 grid overflow-hidden rounded-card border border-border sm:grid-cols-2">
                <SpecRow label={t("Durum")} value={locale === "en" ? CONDITION_INFO[condition]?.en ?? condition : condition} />
                <SpecRow label={t("Kategori")} value={listing.categoryPath.map((c) => categoryLabel(c, locale)).join(" › ")} />
              </dl>
            </section>
          )}

          <section className="mt-8" aria-labelledby="desc">
            <h2 id="desc" className="text-lg font-bold">
              {t("Açıklama")}
            </h2>
            {listing.description ? (
              <Description text={listing.description} />
            ) : (
              <p className="mt-2 text-[15px] text-muted">{t("Satıcı açıklama eklememiş. Merak ettiklerini mesajla sorabilirsin.")}</p>
            )}
          </section>

          <section className="mt-8 grid gap-4 sm:grid-cols-[1fr_1.2fr]" aria-labelledby="where">
            <div>
              <h2 id="where" className="text-lg font-bold">
                {t("Konum ve teslimat")}
              </h2>
              <p className="mt-2 flex items-center gap-2 text-[15px]">
                <Icon name="pin" className="h-4 w-4 text-muted" />
                {listing.city}
                {listing.district ? <span className="text-muted">· {listing.district}</span> : null}
              </p>
              <p className="mt-1 text-[13px] text-muted">
                {region?.side === "south" ? t("Güney Kıbrıs") : t("Kuzey Kıbrıs")} · {t("Tam adres paylaşılmaz; buluşma yerini mesajla kararlaştırın.")}
              </p>
            </div>
            {region ? (
              <div className="rounded-card border border-border bg-surface-2 p-3">
                <RegionMap lat={region.lat} lng={region.lng} label={t(`${listing.city} bölgesi haritada`)} />
              </div>
            ) : null}
          </section>

          <section className="mt-8 rounded-card bg-bg p-5" aria-labelledby="safety">
            <h2 id="safety" className="flex items-center gap-2 font-bold">
              <Icon name="shield" className="h-5 w-5 text-success" />
              {t("Güvenli alışveriş için")}
            </h2>
            <ul className="mt-3 grid gap-2 text-[14px] text-muted sm:grid-cols-2">
              {[
                "Ürünü görmeden para gönderme, kapora ödeme.",
                "Gündüz ve kalabalık bir yerde buluş.",
                "Elektronikleri açıp çalıştırarak kontrol et.",
                "Konuşmayı uygulama içinde tut; kanıt olarak kalır.",
              ].map((tip) => (
                <li key={tip} className="flex gap-2">
                  <Icon name="check" className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />
                  {t(tip)}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-[13px] text-muted">
              <span className="tabular">
                {t("İlan no")}: KB{listing.refNo} · {t(`${f("formatNumber", listing.viewCount)} görüntülenme`)}
              </span>
              {!viewer.isOwner ? <ReportDialog target={{ kind: "listing", id: listing.id }} signedIn={Boolean(me)} /> : null}
            </div>
          </section>
        </div>

        <aside className="min-w-0">
          <div className="flex flex-col gap-4 lg:sticky lg:top-[132px]">
            <div className="hidden rounded-card border border-border p-5 lg:block">
              <TitleBlock page={page} />
              <div className="mt-5">
                <ContactActions {...contactProps} />
              </div>
            </div>
            <div className="lg:hidden">
              <ContactActions {...contactProps} />
            </div>

            {viewer.isOwner ? (
              <div className="rounded-card border border-accent/30 bg-accent-soft p-5">
                <p className="font-semibold">{t("Bu ilan senin")}</p>
                <p className="mt-1 text-[13px] text-muted">
                  {listing.favoriteCount != null ? t(`${listing.favoriteCount} kişi favorilerine ekledi · ${listing.viewCount} görüntülenme`) : null}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <LinkButton href={`/hesabim/ilanlar/${listing.id}`} size="sm" icon={<Icon name="edit" className="h-4 w-4" />}>
                    {t("Düzenle")}
                  </LinkButton>
                  <LinkButton href="/mesajlar" size="sm" variant="outline">
                    {t("Mesajlar")}
                  </LinkButton>
                </div>
              </div>
            ) : null}

            <section className="rounded-card border border-border p-5" aria-labelledby="seller">
              <h2 id="seller" className="sr-only">
                {t("Satıcı")}
              </h2>
              <Link href={`/satici/${seller.id}`} className="flex items-center gap-3">
                <Avatar name={seller.name} src={seller.avatar} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate font-semibold">
                    <span className="truncate" translate="no">{seller.name}</span>
                    {seller.isStore && seller.storeVerified ? <Icon name="verified" className="h-4 w-4 flex-shrink-0 text-accent" aria-label={t("Onaylı mağaza")} /> : null}
                  </p>
                  <p className="text-[13px] text-muted">
                    {seller.isStore ? t("Mağaza") : t("Bireysel satıcı")}
                    {seller.memberSince ? ` · ${f("memberSince", seller.memberSince)}` : ""}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-[13px]">
                    {seller.ratingCount ? (
                      <>
                        <Stars value={seller.ratingAvg} />
                        <span className="font-semibold tabular">{f("decimal", seller.ratingAvg)}</span>
                        <span className="text-muted">({seller.ratingCount})</span>
                      </>
                    ) : (
                      <span className="text-muted">{t("Henüz değerlendirme yok")}</span>
                    )}
                  </p>
                </div>
              </Link>
              <dl className="mt-4 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-button bg-bg px-2 py-2.5">
                  <dt className="text-[12px] text-muted">{t("Yayındaki ilan")}</dt>
                  <dd className="font-bold tabular">{seller.activeListings}</dd>
                </div>
                <div className="rounded-button bg-bg px-2 py-2.5">
                  <dt className="text-[12px] text-muted">{t("Satılan")}</dt>
                  <dd className="font-bold tabular">{seller.soldListings}</dd>
                </div>
              </dl>
              <LinkButton href={`/satici/${seller.id}`} variant="outline" full className="mt-3">
                {t("Satıcının profili")}
              </LinkButton>
            </section>

            <AdSlot placement="listing" />
          </div>
        </aside>
      </div>

      {related.sellerOthers.length ? (
        <section className="mt-14">
          <div className="mb-4 flex items-end justify-between gap-4">
            <h2 className="text-xl font-bold tracking-tight">{t("Satıcının diğer ilanları")}</h2>
            <Link href={`/satici/${seller.id}`} className="text-[14px] font-semibold text-accent hover:underline">
              {t("Tümü")}
            </Link>
          </div>
          <ListingGrid items={related.sellerOthers.slice(0, 5)} />
        </section>
      ) : null}

      {related.similar.length ? (
        <section className="mt-14">
          <h2 className="mb-4 text-xl font-bold tracking-tight">{t("Benzer ilanlar")}</h2>
          <ListingGrid items={related.similar.slice(0, 5)} />
        </section>
      ) : null}

      <div className="mt-14">
        <RecentlyViewed excludeId={listing.id} />
      </div>

      <MobileActionBar {...contactProps} />
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border px-4 py-3 text-[14px] last:border-b-0 sm:[&:nth-last-child(2):nth-child(odd)]:border-b-0 sm:odd:border-r">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium" translate="no">
        {value}
      </dd>
    </div>
  );
}

async function TitleBlock({ page }: { page: ListingPage }) {
  const { t, f, locale } = await getI18n();
  const { listing } = page;
  const condition = listing.condition as Condition;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge kind="neutral">{locale === "en" ? CONDITION_INFO[condition]?.en ?? condition : condition}</Badge>
        {listing.negotiable ? <Badge kind="accent">{t("Pazarlığa açık")}</Badge> : null}
        {listing.status === "sold" ? <Badge kind="danger">{t("Satıldı")}</Badge> : null}
      </div>
      <h1 className="mt-2.5 text-[22px] font-bold leading-tight tracking-tight sm:text-[26px]">
        <span translate="no">{listing.title}</span>
      </h1>
      <p className="mt-2 text-[30px] font-bold tracking-tight tabular">{f("formatPrice", listing.price, listing.currency)}</p>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
        <span className="flex items-center gap-1">
          <Icon name="pin" className="h-3.5 w-3.5" />
          {listing.district ? `${listing.city}, ${listing.district}` : listing.city}
        </span>
        <span className="flex items-center gap-1">
          <Icon name="clock" className="h-3.5 w-3.5" />
          {f("formatLongDate", listing.publishedAt ?? listing.createdAt)}
        </span>
      </p>
    </div>
  );
}
