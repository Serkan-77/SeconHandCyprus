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

  const [seller, similar] = await Promise.all([
    getSellerSummary(listing.seller_id),
    searchListings({ category: category?.slug, excludeId: listing.id, pageSize: 4 }),
  ]);

  if (isActive && !isOwner) {
    // Request APIs are unavailable inside after() in Server Components, so the
    // client is created up front.
    const supabase = await createClient();
    after(async () => {
      await supabase.rpc("increment_listing_view", { p_listing: listing.id });
    });
  }

  const price = formatPrice(listing.price, listing.currency);
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
    <div className="mx-auto max-w-[1328px] px-4 pb-8 sm:px-6">
      <JsonLd data={product} />
      <Breadcrumbs
        items={[
          ...(category ? [{ label: category.name, href: `/kategori/${category.slug}` }] : []),
          listing.title,
        ]}
      />

      {!isActive ? (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl bg-brand-soft px-4 py-3 text-xs">
          <Icon name="info" className="h-4 w-4 flex-shrink-0 text-accent" />
          <span className="flex-1">{statusNotice[listing.status]}</span>
          {isOwner ? (
            <LinkButton href={`/hesabim/ilanlar/${listing.id}`} variant="outline" full={false} className="min-h-9 text-xs">
              İlanı yönet
            </LinkButton>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(340px,1fr)] lg:gap-11">
        <div className="min-w-0">
          <DetailGallery images={images} alt={listing.title} />

          <section className="mt-9">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Biraz da hikâyesi.</h2>
            <p className="mt-4 whitespace-pre-line text-[13px] leading-loose text-muted sm:text-sm">
              {listing.description || "Satıcı bu ilan için açıklama eklememiş. Merak ettiklerini mesajla sorabilirsin."}
            </p>
            <dl className="my-6 grid grid-cols-1 gap-x-7 gap-y-0 sm:grid-cols-2">
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
                  <dt className="text-[11px] text-muted">{term}</dt>
                  <dd className="mt-1 text-[13px]">{desc}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="mt-8">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{location}</h2>
            <p className="mb-5 mt-2 text-[13px] text-muted">Yaklaşık konum. Buluşma yerini satıcıyla konuş.</p>
            <MapPreview label={listing.city} />
          </section>
        </div>

        <aside>
          <div className="flex flex-col gap-5 rounded-2xl border border-border p-6">
            <div className="flex items-center justify-between">
              <Badge kind="accent">{listing.condition}</Badge>
              <FavoriteButton listingId={listing.id} />
            </div>
            <h1 className="text-2xl font-semibold leading-tight tracking-tight sm:text-[31px]">
              {listing.title}, yeni evini arıyor.
            </h1>
            <div className="text-3xl font-semibold tracking-tight sm:text-[36px]">{price}</div>
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <span className="flex items-center gap-1 text-[11px] text-muted">
                <Icon name="pin" className="h-3.5 w-3.5" />
                {location}
              </span>
              {listing.negotiable ? <Badge kind="accent">Pazarlığa açık</Badge> : null}
            </div>
            <div className="h-px bg-border" />
            {seller ? <SellerCard seller={seller} /> : null}
            <div className="flex flex-col gap-2.5">
              {isOwner ? (
                <LinkButton href={`/hesabim/ilanlar/${listing.id}`} icon={<Icon name="edit" className="h-4 w-4" />}>
                  İlanını yönet
                </LinkButton>
              ) : (
                <>
                  <MessageSellerButton listingId={listing.id} loggedIn={Boolean(viewer)} />
                  <WhatsAppButton listingId={listing.id} listingTitle={listing.title} loggedIn={Boolean(viewer)} />
                </>
              )}
            </div>
            <p className="text-center text-xs text-muted">Ürün için ödeme uygulama dışında yapılır.</p>
          </div>

          <div className="mt-4 flex gap-3.5 rounded-xl bg-bg p-5">
            <Icon name="shield" className="h-5 w-5 flex-shrink-0 text-accent" />
            <div>
              <b className="text-[12px]">İyi bir alışveriş, güvenle başlar.</b>
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                Ürünü görmeden kapora gönderme. Kalabalık bir yerde buluş.
              </p>
            </div>
          </div>

          {!isOwner ? (
            <div className="mt-3">
              <ReportListingButton listingId={listing.id} loggedIn={Boolean(viewer)} />
            </div>
          ) : null}

          {isActive ? <AdSlot placement="listing" className="mt-6" /> : null}
        </aside>
      </div>

      <section className="mt-16">
        <div className="mb-6 flex items-end justify-between gap-5">
          <div>
            <h2 className="text-xl font-semibold tracking-tight sm:text-[27px]">Bunlar da ilgini çekebilir</h2>
            <p className="mt-1 text-[13px] text-muted">Yeni bir hikâye arayan başka eşyalar.</p>
          </div>
        </div>
        <ListingGrid items={similar.items} empty="Bu kategoride başka ilan yok." />
      </section>

      {!isOwner ? (
        <div className="sticky bottom-0 z-30 mt-6 flex items-center gap-5 border-t border-border bg-surface py-3 lg:hidden">
          <span className="flex-1">
            <small className="block text-[9px] text-muted">İlan fiyatı</small>
            <strong className="text-xl tracking-tight">{price}</strong>
          </span>
          <MessageSellerButton listingId={listing.id} loggedIn={Boolean(viewer)} compact />
        </div>
      ) : null}
    </div>
  );
}
