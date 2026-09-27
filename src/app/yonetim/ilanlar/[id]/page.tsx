import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { DetailGallery } from "@/components/DetailGallery";
import { LinkButton } from "@/components/ui/Button";
import { ListingStatusBadge } from "@/components/ListingStatusBadge";
import { createClient } from "@/lib/supabase/server";
import { publicImageUrl } from "@/lib/supabase/env";
import { getSellerSummary, one } from "@/lib/queries";
import { formatDate, formatPrice, memberSince, ratingLabel } from "@/lib/format";
import { detailRows, type ListingDetails } from "@/lib/listingDetails";
import { ModerationActions } from "./ModerationActions";

export const metadata = { title: "Yönetim · İlan inceleme", robots: { index: false } };

export default async function AdminListingReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AdminShell>
      <Review id={id} />
    </AdminShell>
  );
}

async function Review({ id }: { id: string }) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: listing } = await supabase
    .from("listings")
    .select("*, category:categories(name), images:listing_images(path, position)")
    .eq("id", id)
    .maybeSingle();
  if (!listing) notFound();

  const [seller, { count: reportCount }] = await Promise.all([
    getSellerSummary(listing.seller_id),
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("listing_id", id),
  ]);
  const images = [...(listing.images ?? [])].sort((a, b) => a.position - b.position).map((i) => publicImageUrl(i.path));
  const category = one(listing.category) as { name: string } | null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[27px]">İlan inceleme</h1>
          <ListingStatusBadge status={listing.status} />
        </div>
        <div className="flex flex-wrap gap-2.5">
          <LinkButton href={`/yonetim/ilanlar/${id}/duzenle`} variant="outline" full={false} className="min-h-10 text-xs">
            Düzenle / sil
          </LinkButton>
          <LinkButton href="/yonetim/ilanlar" variant="outline" full={false} className="min-h-10 text-xs">
            Kuyruğa dön
          </LinkButton>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="min-w-0 rounded-xl border border-border bg-surface p-5">
          <DetailGallery images={images} alt={listing.title} />
          <span className="mt-5 block text-[10px] text-muted">
            #KB{listing.ref_no} · {formatDate(listing.created_at)}
          </span>
          <h2 className="mt-1 text-lg font-semibold">{listing.title}</h2>
          <p className="mt-1 text-sm text-muted">
            {category?.name} · {listing.condition} · {formatPrice(listing.price, listing.currency)}
            {listing.negotiable ? " · Pazarlığa açık" : ""}
          </p>
          <p className="mt-1 text-xs text-muted">
            {listing.city}
            {listing.district ? `, ${listing.district}` : ""}
          </p>
          <p className="mt-4 whitespace-pre-line text-[13px] leading-relaxed">
            {listing.description || <span className="text-muted">Açıklama yok.</span>}
          </p>
          {detailRows(listing.details as ListingDetails | null).length ? (
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              {detailRows(listing.details as ListingDetails | null).map(([term, desc]) => (
                <div key={term}>
                  <dt className="text-[10px] text-muted">{term}</dt>
                  <dd>{desc}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {listing.reject_reason ? (
            <p className="mt-4 rounded-lg bg-brand-soft p-3 text-xs">
              <b>Ret gerekçesi:</b> {listing.reject_reason}
            </p>
          ) : null}
        </div>
        <div className="flex h-max flex-col gap-4">
          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-3 text-sm font-semibold">Satıcı bilgisi</h3>
            {seller ? (
              <>
                <Link href={`/yonetim/kullanicilar/${seller.id}`} className="text-sm font-medium text-accent">
                  {seller.displayName}
                </Link>
                <p className="mt-1 text-xs text-muted">
                  {memberSince(seller.createdAt)} · {seller.activeListings} aktif, {seller.soldListings} satılmış ilan
                </p>
                <p className="mt-1 text-xs text-muted">{ratingLabel(seller.ratingAvg, seller.ratingCount)}</p>
                <p className="mt-1 text-xs text-muted">
                  Hesap durumu: {seller.status === "active" ? "Aktif" : seller.status}
                  {seller.phoneVerified ? " · Telefon elle incelendi" : ""}
                </p>
              </>
            ) : (
              <p className="text-xs text-muted">Satıcı bulunamadı.</p>
            )}
            {reportCount ? (
              <p className="mt-3 text-xs text-danger">Bu ilan hakkında {reportCount} şikayet var.</p>
            ) : null}
          </div>
          <ModerationActions id={listing.id} status={listing.status} title={listing.title} slug={listing.slug} featured={listing.featured} />
        </div>
      </div>
    </>
  );
}
