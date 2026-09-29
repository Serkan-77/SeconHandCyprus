
import * as I18n from "@/components/i18n/Localized";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { DetailGallery } from "@/components/DetailGallery";
import { LinkButton } from "@/components/ui/Button";
import { ListingStatusBadge } from "@/components/ListingStatusBadge";
import { createClient } from "@/lib/supabase/server";
import { publicImageUrl } from "@/lib/supabase/env";
import { getSellerSummary, one } from "@/lib/queries";
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
          <I18n.h1 className="text-2xl font-semibold tracking-tight sm:text-[27px]">İlan inceleme</I18n.h1>
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
        <I18n.div className="min-w-0 rounded-xl border border-border bg-surface p-5">
          <DetailGallery images={images} alt={listing.title} />
          <I18n.span className="mt-5 block text-[10px] text-muted">
            #KB{listing.ref_no} · <I18n.Formatted kind="formatDate" args={[listing.created_at]} />
          </I18n.span>
          <I18n.h2 className="mt-1 text-lg font-semibold"><I18n.Raw>{listing.title}</I18n.Raw></I18n.h2>
          <I18n.p className="mt-1 text-sm text-muted">
            {category?.name} · {listing.condition} · <I18n.Formatted kind="formatPrice" args={[listing.price, listing.currency]} />
            {listing.negotiable ? " · Pazarlığa açık" : ""}
          </I18n.p>
          <I18n.p className="mt-1 text-xs text-muted">
            {listing.city}
            {listing.district ? `, ${listing.district}` : ""}
          </I18n.p>
          <I18n.p className="mt-4 whitespace-pre-line text-[13px] leading-relaxed">
            {listing.description || <I18n.span className="text-muted">Açıklama yok.</I18n.span>}
          </I18n.p>
          {detailRows(listing.details as ListingDetails | null).length ? (
            <I18n.dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              {detailRows(listing.details as ListingDetails | null).map(([term, desc]) => (
                <div key={term}>
                  <I18n.dt className="text-[10px] text-muted">{term}</I18n.dt>
                  <I18n.dd>{desc}</I18n.dd>
                </div>
              ))}
            </I18n.dl>
          ) : null}
          {listing.reject_reason ? (
            <I18n.p className="mt-4 rounded-lg bg-brand-soft p-3 text-xs">
              <I18n.b>Ret gerekçesi:</I18n.b> {listing.reject_reason}
            </I18n.p>
          ) : null}
        </I18n.div>
        <div className="flex h-max flex-col gap-4">
          <I18n.div className="rounded-xl border border-border bg-surface p-5">
            <I18n.h3 className="mb-3 text-sm font-semibold">Satıcı bilgisi</I18n.h3>
            {seller ? (
              <>
                <I18n.Link href={`/yonetim/kullanicilar/${seller.id}`} className="text-sm font-medium text-accent">
                  <I18n.Raw>{seller.displayName}</I18n.Raw>
                </I18n.Link>
                <I18n.p className="mt-1 text-xs text-muted">
                  <I18n.Formatted kind="memberSince" args={[seller.createdAt]} /> · {seller.activeListings} aktif, {seller.soldListings} satılmış ilan
                </I18n.p>
                <I18n.p className="mt-1 text-xs text-muted"><I18n.Formatted kind="ratingLabel" args={[seller.ratingAvg, seller.ratingCount]} /></I18n.p>
                <I18n.p className="mt-1 text-xs text-muted">
                  Hesap durumu: {seller.status === "active" ? "Aktif" : seller.status}
                  {seller.phoneVerified ? " · Telefon elle incelendi" : ""}
                </I18n.p>
              </>
            ) : (
              <I18n.p className="text-xs text-muted">Satıcı bulunamadı.</I18n.p>
            )}
            {reportCount ? (
              <I18n.p className="mt-3 text-xs text-danger">Bu ilan hakkında {reportCount} şikayet var.</I18n.p>
            ) : null}
          </I18n.div>
          <ModerationActions id={listing.id} status={listing.status} title={listing.title} slug={listing.slug} featured={listing.featured} />
        </div>
      </div>
    </>
  );
}
