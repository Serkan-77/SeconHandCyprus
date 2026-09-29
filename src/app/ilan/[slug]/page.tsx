
import * as I18n from "@/components/i18n/Localized";
import type { Metadata } from "next";
import { cache } from "react";
import { after } from "next/server";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { DetailGallery } from "@/components/DetailGallery";
import { FavoriteButton } from "@/components/FavoriteButton";
import { ReportListingButton } from "@/components/ReportListingButton";
import { SellerCard } from "@/components/SellerCard";
import { MapPreview } from "@/components/MapPreview";
import { ListingGrid } from "@/components/ListingGrid";
import { AdSlot } from "@/components/AdSlot";
import { JsonLd } from "@/components/JsonLd";
import { absoluteUrl } from "@/lib/site";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { MessageSellerButton } from "@/components/MessageSellerButton";
import { LinkButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/icons";
import { createClient } from "@/lib/supabase/server";
import { publicImageUrl } from "@/lib/supabase/env";
import { getSellerSummary, getViewer, one, searchListings } from "@/lib/queries";
import { formatLongDate, formatPrice } from "@/lib/format";
import { detailRows, type ListingDetails } from "@/lib/listingDetails";

const getListing = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select("*, category:categories(name, slug), images:listing_images(id, path, position)")
    .eq("slug", slug)
    .maybeSingle();
  return data;
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const listing = await getListing(slug);
  if (!listing) return { title: "İlan bulunamadı" };
  const images = [...(listing.images ?? [])].sort((a, b) => a.position - b.position);
  const price = formatPrice(listing.price, listing.currency);
  return {
    title: `${listing.title} — ${price}`,
    alternates: { canonical: `/ilan/${listing.slug}` },
    // Sold or pending listings stay reachable for their owner but should not be indexed.
    robots: listing.status === "active" ? undefined : { index: false, follow: true },
    description: (listing.description || `${listing.title}, ${listing.city}`).slice(0, 160),
    openGraph: {
      title: `${listing.title} · ${price}`,
      description: `${listing.city} · ${listing.condition}`,
      type: "website",
      images: images[0] ? [{ url: publicImageUrl(images[0].path), alt: listing.title }] : undefined,
    },
  };
}

/**
 * Whether the seller shares a WhatsApp number (yes/no only, migration 0015).
 * Without that function (not migrated yet) the button shows as before.
 */
async function sellerAcceptsWhatsapp(listingId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("listing_accepts_whatsapp", { p_listing: listingId });
  return error ? true : Boolean(data);
}

const statusNotice: Record<string, string> = {
  pending: "Bu ilan incelemede. Onaylandığında herkes görebilecek.",
  rejected: "Bu ilan yayınlanamadı. Düzenleyip tekrar incelemeye gönderebilirsin.",
  sold: "Bu ilanı satıldı olarak işaretledin; aramalarda görünmüyor.",
  removed: "Bu ilan yayından kaldırıldı.",
  draft: "Bu ilan taslak olarak kayıtlı.",
};

export default async function ListingDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const listing = await getListing(slug);
  if (!listing) notFound();

  const viewer = await getViewer();
  const isOwner = viewer?.user.id === listing.seller_id;
  const isActive = listing.status === "active";
  // Non-owners only reach non-active listings as admins; show them the 404 view anyway.
  if (!isActive && !isOwner && viewer?.profile.role !== "admin") notFound();

  const category = one(listing.category) as { name: string; slug: string } | null;
  const images = [...(listing.images ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((i) => publicImageUrl(i.path));

  const [seller, sameCategory, acceptsWhatsapp] = await Promise.all([
    getSellerSummary(listing.seller_id),
    searchListings({ category: category?.slug, excludeId: listing.id, pageSize: 4 }),
    sellerAcceptsWhatsapp(listing.id),
  ]);
  // Nothing else in this category yet: suggest the newest listings instead.
  const similar = sameCategory.items.length
    ? sameCategory
    : await searchListings({ excludeId: listing.id, pageSize: 4 });

  if (isActive && !isOwner) {
    // Request APIs are unavailable inside after() in Server Components, so the
    // client is created up front.
    const supabase = await createClient();
    after(async () => {
      await supabase.rpc("increment_listing_view", { p_listing: listing.id });
    });
  }

  const location = listing.district ? `${listing.city}, ${listing.district}` : listing.city;

  const product = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: listing.title,
    description: listing.description || listing.title,
    sku: `KB${listing.ref_no}`,
    image: images.filter((src) => src.startsWith("http")),
    category: category?.name,
    offers: {
      "@type": "Offer",
      url: absoluteUrl(`/ilan/${listing.slug}`),
      price: Number(listing.price),
      priceCurrency: listing.currency === "€" ? "EUR" : "TRY",
      itemCondition:
        listing.condition === "Sıfır" ? "https://schema.org/NewCondition" : "https://schema.org/UsedCondition",
      availability: isActive ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
      areaServed: { "@type": "City", name: listing.city },
      seller: seller ? { "@type": "Person", name: seller.displayName, url: absoluteUrl(`/satici/${seller.id}`) } : undefined,
    },
  };

  return (
    <I18n.div className="mx-auto max-w-[1328px] px-4 pb-8 sm:px-6">
      <JsonLd data={product} />
      <Breadcrumbs
        items={[
          ...(category ? [{ label: category.name, href: `/kategori/${category.slug}` }] : []),
          listing.title,
        ]}
      />

      {!isActive ? (
        <I18n.div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl bg-brand-soft px-4 py-3 text-xs">
          <Icon name="info" className="h-4 w-4 flex-shrink-0 text-accent" />
          <I18n.span className="flex-1">{statusNotice[listing.status]}</I18n.span>
          {isOwner ? (
            <LinkButton href={`/hesabim/ilanlar/${listing.id}`} variant="outline" full={false} className="min-h-9 text-xs">
              İlanı yönet
            </LinkButton>
          ) : null}
        </I18n.div>
      ) : null}

      {/* Phones: photos, then title/price/seller, then the details. Desktop:
          photos and details on the left, the card beside them. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(340px,1fr)] lg:gap-x-11 lg:gap-y-0">
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <DetailGallery images={images} alt={listing.title} />
        </div>

        <I18n.aside className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <I18n.div className="flex flex-col gap-5 rounded-2xl border border-border p-6">
            <div className="flex items-center justify-between">
              <Badge kind="accent">{listing.condition}</Badge>
              <FavoriteButton listingId={listing.id} />
            </div>
            <I18n.h1 className="text-2xl font-semibold leading-tight tracking-tight sm:text-[31px]">
              <I18n.Raw>{listing.title}</I18n.Raw>, yeni evini arıyor.
            </I18n.h1>
            <I18n.div className="text-3xl font-semibold tracking-tight sm:text-[36px]"><I18n.Formatted kind="formatPrice" args={[listing.price, listing.currency]} /></I18n.div>
            <I18n.div className="flex flex-wrap items-center justify-between gap-2.5">
              <I18n.span className="flex items-center gap-1 text-[11px] text-muted">
                <Icon name="pin" className="h-3.5 w-3.5" />
                {location}
              </I18n.span>
              {listing.negotiable ? <Badge kind="accent">Pazarlığa açık</Badge> : null}
            </I18n.div>
            <div className="h-px bg-border" />
            {seller ? <SellerCard seller={seller} /> : null}
            <I18n.div className="flex flex-col gap-2.5">
              {isOwner ? (
                <LinkButton href={`/hesabim/ilanlar/${listing.id}`} icon={<Icon name="edit" className="h-4 w-4" />}>
                  İlanını yönet
                </LinkButton>
              ) : (
                <>
                  <MessageSellerButton listingId={listing.id} loggedIn={Boolean(viewer)} />
                  {acceptsWhatsapp ? (
                    <WhatsAppButton listingId={listing.id} listingTitle={listing.title} loggedIn={Boolean(viewer)} />
                  ) : (
                    <I18n.p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-muted">
                      <Icon name="lock" className="h-3.5 w-3.5" />
                      Satıcı yalnızca uygulama içinden mesajlaşıyor.
                    </I18n.p>
                  )}
                </>
              )}
            </I18n.div>
            <I18n.p className="text-center text-xs text-muted">Ürün için ödeme uygulama dışında yapılır.</I18n.p>
          </I18n.div>

          <div className="mt-4 flex gap-3.5 rounded-xl bg-bg p-5">
            <Icon name="shield" className="h-5 w-5 flex-shrink-0 text-accent" />
            <div>
              <I18n.b className="text-[12px]">İyi bir alışveriş, güvenle başlar.</I18n.b>
              <I18n.p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                Ürünü görmeden kapora gönderme. Kalabalık bir yerde buluş.
              </I18n.p>
            </div>
          </div>

          {!isOwner ? (
            <div className="mt-3">
              <ReportListingButton listingId={listing.id} loggedIn={Boolean(viewer)} />
            </div>
          ) : null}

          {isActive ? <AdSlot placement="listing" className="mt-6" /> : null}
        </I18n.aside>

        <div className="min-w-0 lg:col-start-1 lg:row-start-2">
          <section className="lg:mt-9">
            <I18n.h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Biraz da hikâyesi.</I18n.h2>
            <I18n.p className="mt-4 whitespace-pre-line text-[13px] leading-loose text-muted sm:text-sm">
              {listing.description ? <I18n.Raw>{listing.description}</I18n.Raw> : "Satıcı bu ilan için açıklama eklememiş. Merak ettiklerini mesajla sorabilirsin."}
            </I18n.p>
            <I18n.dl className="my-6 grid grid-cols-1 gap-x-7 gap-y-0 sm:grid-cols-2">
              {[
                ["Kategori", category?.name ?? "—"],
                ["Ürün durumu", listing.condition],
                ["İlan numarası", `#KB${listing.ref_no}`],
                ["İlan tarihi", formatLongDate(listing.published_at ?? listing.created_at)],
                ["Görüntülenme", String(listing.view_count)],
                ["Pazarlık", listing.negotiable ? "Pazarlığa açık" : "Sabit fiyat"],
                ...detailRows(listing.details as ListingDetails | null),
              ].map(([term, desc]) => (
                <div key={term} className="border-b border-border py-3.5">
                  <I18n.dt className="text-[11px] text-muted">{term}</I18n.dt>
                  <I18n.dd className="mt-1 text-[13px]">{desc}</I18n.dd>
                </div>
              ))}
            </I18n.dl>
          </section>

          <section className="mt-8">
            <I18n.h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{location}</I18n.h2>
            <I18n.p className="mb-5 mt-2 text-[13px] text-muted">Yaklaşık konum. Buluşma yerini satıcıyla konuş.</I18n.p>
            <MapPreview label={listing.city} />
          </section>
        </div>
      </div>

      {similar.items.length ? (
        <section className="mt-16">
          <div className="mb-6 flex items-end justify-between gap-5">
            <div>
              <I18n.h2 className="text-xl font-semibold tracking-tight sm:text-[27px]">Bunlar da ilgini çekebilir</I18n.h2>
              <I18n.p className="mt-1 text-[13px] text-muted">Yeni bir hikâye arayan başka eşyalar.</I18n.p>
            </div>
          </div>
          <ListingGrid items={similar.items} />
        </section>
      ) : null}

      {!isOwner ? (
        <div className="sticky bottom-0 z-30 mt-6 flex items-center gap-5 border-t border-border bg-surface py-3 lg:hidden">
          <span className="flex-1">
            <I18n.small className="block text-[9px] text-muted">İlan fiyatı</I18n.small>
            <I18n.strong className="text-xl tracking-tight"><I18n.Formatted kind="formatPrice" args={[listing.price, listing.currency]} /></I18n.strong>
          </span>
          <MessageSellerButton listingId={listing.id} loggedIn={Boolean(viewer)} compact />
        </div>
      ) : null}
    </I18n.div>
  );
}
