
import * as I18n from "@/components/i18n/Localized";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SellerHeader } from "@/components/SellerHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/icons";
import { createClient } from "@/lib/supabase/server";
import { getSellerSummary, one } from "@/lib/queries";
import { publicImageUrl } from "@/lib/supabase/env";
import { initials } from "@/lib/format";

export const metadata = { title: "Satıcı değerlendirmeleri" };

export default async function SellerReviewsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const seller = await getSellerSummary(id);
  if (!seller) notFound();

  const supabase = await createClient();
  const { data: reviews } = await supabase
    .from("ratings")
    .select("id, score, comment, created_at, rater:profiles!ratings_rater_id_fkey(id, display_name, avatar_url), listing:listings(title, slug)")
    .eq("ratee_id", id)
    .order("created_at", { ascending: false });

  const distribution = [5, 4, 3, 2, 1].map((n) => ({
    n,
    count: (reviews ?? []).filter((r) => r.score === n).length,
  }));

  return (
    <I18n.div className="mx-auto max-w-[760px] px-4 pb-16 sm:px-6">
      <Breadcrumbs items={[{ label: seller.displayName, href: `/satici/${id}` }, "Değerlendirmeler"]} />
      <SellerHeader seller={seller} active="yorumlar" />

      {reviews && reviews.length > 0 ? (
        <>
          <div className="mb-6 grid grid-cols-1 gap-5 rounded-xl border border-border p-5 sm:grid-cols-[140px_1fr]">
            <div className="text-center sm:text-left">
              <I18n.strong className="block text-4xl tracking-tight">
                <I18n.Formatted kind="decimal" args={[seller.ratingAvg]} />
              </I18n.strong>
              <I18n.span className="text-accent">{"★".repeat(Math.round(seller.ratingAvg))}</I18n.span>
              <I18n.p className="text-[11px] text-muted">{seller.ratingCount} değerlendirme</I18n.p>
            </div>
            <I18n.div className="flex flex-col gap-1.5">
              {distribution.map(({ n, count }) => (
                <div key={n} className="flex items-center gap-2 text-[11px] text-muted">
                  <I18n.span className="w-5">{n}★</I18n.span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-bg">
                    <span
                      className="block h-full rounded-full bg-accent"
                      style={{ width: `${(count / reviews.length) * 100}%` }}
                    />
                  </span>
                  <I18n.span className="w-5 text-right">{count}</I18n.span>
                </div>
              ))}
            </I18n.div>
          </div>
          <I18n.div className="flex flex-col gap-5">
            {reviews.map((review) => {
              const rater = one(review.rater) as { display_name: string; avatar_url: string | null } | null;
              const listing = one(review.listing) as { title: string; slug: string } | null;
              return (
                <div key={review.id} className="flex gap-3.5 rounded-xl border border-border p-5">
                  <Avatar
                    initials={initials(rater?.display_name)}
                    src={rater?.avatar_url ? publicImageUrl(rater.avatar_url, "avatars") : null}
                  />
                  <I18n.div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <I18n.b className="text-sm">{rater?.display_name ? <I18n.Raw>{rater?.display_name}</I18n.Raw> : "Silinmiş kullanıcı"}</I18n.b>
                      <I18n.span className="text-accent" aria-label={`${review.score} yıldız`}>
                        {"★".repeat(review.score)}
                        <I18n.span className="text-border">{"★".repeat(5 - review.score)}</I18n.span>
                      </I18n.span>
                    </div>
                    <I18n.span className="text-[10px] text-muted">
                      <I18n.Formatted kind="monthYear" args={[review.created_at]} />
                      {listing ? (
                        <>
                          {" · "}
                          <I18n.Link href={`/ilan/${listing.slug}`} className="text-accent">
                            <I18n.Raw>{listing.title}</I18n.Raw>
                          </I18n.Link>
                        </>
                      ) : null}
                    </I18n.span>
                    {review.comment ? <I18n.p className="mt-2 text-[13px] text-muted"><I18n.Raw>{review.comment}</I18n.Raw></I18n.p> : null}
                  </I18n.div>
                </div>
              );
            })}
          </I18n.div>
        </>
      ) : (
        <I18n.div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted">
          <Icon name="star" className="h-8 w-8" />
          <I18n.Raw>{seller.displayName}</I18n.Raw> henüz değerlendirme almadı.
        </I18n.div>
      )}
    </I18n.div>
  );
}
