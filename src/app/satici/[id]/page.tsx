import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Icon } from "@/components/icons";
import { JsonLd } from "@/components/JsonLd";
import { ListingGrid } from "@/components/ListingCard";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Notice } from "@/components/ui/FormError";
import { Stars } from "@/components/ui/Stars";
import { ReportDialog } from "@/components/listing/ReportDialog";
import { apiServerOrNull, getMe } from "@/lib/api/server";
import type { ListingCard, PublicProfile, Rating } from "@/lib/api/types";
import { absoluteUrl } from "@/lib/site";
import { getI18n } from "@/lib/i18n/server";

type ProfilePage = { profile: PublicProfile; listings: ListingCard[]; recentRatings: Rating[]; viewer: { blocked: boolean; isSelf: boolean } };

const getProfile = cache((id: string) => (/^[0-9a-f-]{36}$/i.test(id) ? apiServerOrNull<ProfilePage>(`/users/${id}`) : Promise.resolve(null)));

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await getProfile(id);
  if (!data) return { title: "Satıcı bulunamadı", robots: { index: false } };
  const p = data.profile;
  return {
    title: p.isStore ? `${p.name} · Mağaza` : `${p.name} · Satıcı profili`,
    description: `${p.name}${p.region ? `, ${p.region}` : ""}: ${p.stats.activeListings} ilan${p.stats.ratingCount ? `, ${p.stats.ratingAvg.toFixed(1)} puan (${p.stats.ratingCount} değerlendirme)` : ""}.`,
    alternates: { canonical: `/satici/${p.id}` },
    robots: p.unavailable || !p.stats.activeListings ? { index: false, follow: true } : undefined,
  };
}

export default async function SellerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, me, { t, f }] = await Promise.all([getProfile(id), getMe(), getI18n()]);
  if (!data) notFound();
  const { profile: p, listings, recentRatings } = data;

  const schema = {
    "@context": "https://schema.org",
    "@type": p.isStore ? "Store" : "Person",
    name: p.name,
    url: absoluteUrl(`/satici/${p.id}`),
    ...(p.stats.ratingCount
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: p.stats.ratingAvg.toFixed(1), reviewCount: p.stats.ratingCount, bestRating: 5, worstRating: 1 } }
      : {}),
    ...(p.isStore && p.store?.address ? { address: p.store.address } : {}),
  };

  return (
    <div className="mx-auto max-w-[1320px] px-4 pb-16 pt-4 sm:px-6 sm:pt-6">
      <JsonLd data={schema} />
      <Breadcrumbs items={[{ label: t(p.isStore ? "Mağazalar" : "Satıcılar"), href: p.isStore ? "/magazalar" : undefined }, { label: p.name }]} />

      {p.unavailable ? <Notice tone="warning" className="mt-4">{t("Bu hesabın ilanları şu anda görüntülenemiyor.")}</Notice> : null}

      <section className="mt-4 grid gap-6 rounded-hero border border-border p-5 sm:p-7 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <Avatar name={p.name} src={p.avatar} size="xl" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight" translate="no">
                {p.name}
              </h1>
              {p.isStore ? (
                <Badge kind={p.store?.verified ? "accent" : "neutral"} icon={p.store?.verified ? <Icon name="verified" className="h-3.5 w-3.5" /> : <Icon name="store" className="h-3.5 w-3.5" />}>
                  {t(p.store?.verified ? "Onaylı mağaza" : "Mağaza")}
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 text-[14px] text-muted">
              {f("memberSince", p.memberSince)}
              {p.region ? ` · ${p.region}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
              {p.emailVerified ? (
                <span className="flex items-center gap-1 text-muted">
                  <Icon name="mail" className="h-4 w-4" />
                  {t("E-posta doğrulandı")}
                </span>
              ) : null}
            </div>
            {p.bio ? (
              <p className="mt-3 max-w-2xl whitespace-pre-line text-[15px] leading-relaxed" translate="no">
                {p.bio}
              </p>
            ) : null}
            {p.isStore && p.store ? (
              <dl className="mt-4 grid gap-2 text-[14px] sm:grid-cols-2">
                {p.store.address ? (
                  <div className="flex gap-2">
                    <Icon name="pin" className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted" />
                    <dd translate="no">{p.store.address}</dd>
                  </div>
                ) : null}
                {p.store.hours ? (
                  <div className="flex gap-2">
                    <Icon name="clock" className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted" />
                    <dd translate="no">{p.store.hours}</dd>
                  </div>
                ) : null}
                {p.store.phone ? (
                  <div className="flex gap-2">
                    <Icon name="phone" className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted" />
                    <dd>
                      <a href={`tel:${p.store.phone}`} className="text-accent hover:underline">
                        {p.store.phone}
                      </a>
                    </dd>
                  </div>
                ) : null}
                {p.store.website ? (
                  <div className="flex gap-2">
                    <Icon name="globe" className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted" />
                    <dd>
                      <a href={p.store.website} rel="nofollow noopener noreferrer ugc" target="_blank" className="text-accent hover:underline">
                        {p.store.website.replace(/^https?:\/\//, "")}
                      </a>
                    </dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 self-start text-center lg:grid-cols-1 lg:text-left">
          <div className="rounded-card bg-bg p-3 lg:flex lg:items-center lg:justify-between">
            <p className="text-[13px] text-muted">{t("Puan")}</p>
            <p className="flex items-center justify-center gap-1.5 font-bold lg:justify-end">
              {p.stats.ratingCount ? (
                <>
                  <Stars value={p.stats.ratingAvg} className="hidden sm:inline-flex" />
                  {f("decimal", p.stats.ratingAvg)}
                  <span className="text-[13px] font-normal text-muted">({p.stats.ratingCount})</span>
                </>
              ) : (
                "—"
              )}
            </p>
          </div>
          <div className="rounded-card bg-bg p-3 lg:flex lg:items-center lg:justify-between">
            <p className="text-[13px] text-muted">{t("Yayındaki ilan")}</p>
            <p className="font-bold tabular">{p.stats.activeListings}</p>
          </div>
          <div className="rounded-card bg-bg p-3 lg:flex lg:items-center lg:justify-between">
            <p className="text-[13px] text-muted">{t("Satılan")}</p>
            <p className="font-bold tabular">{p.stats.soldListings}</p>
          </div>
          {!data.viewer.isSelf ? (
            <div className="col-span-3 pt-1 lg:col-span-1">
              <ReportDialog target={{ kind: "user", id: p.id }} signedIn={Boolean(me)} label="Kullanıcıyı şikayet et" />
            </div>
          ) : null}
        </div>
      </section>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_340px]">
        <section aria-labelledby="listings">
          <h2 id="listings" className="mb-4 text-xl font-bold tracking-tight">
            {t("İlanları")}
          </h2>
          {listings.length ? (
            <ListingGrid items={listings} className="lg:grid-cols-3" />
          ) : (
            <EmptyState icon="grid" title={t("Yayında ilanı yok")} />
          )}
        </section>
        <section aria-labelledby="reviews">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 id="reviews" className="text-xl font-bold tracking-tight">
              {t("Değerlendirmeler")}
            </h2>
            {p.stats.ratingCount > recentRatings.length ? (
              <Link href={`/satici/${p.id}/yorumlar`} className="text-[14px] font-semibold text-accent hover:underline">
                {t("Tümü")}
              </Link>
            ) : null}
          </div>
          {recentRatings.length ? (
            <ul className="flex flex-col gap-3">
              {recentRatings.map((r) => (
                <li key={r.id} className="rounded-card border border-border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Stars value={r.score} />
                    <span className="text-[12px] text-subtle">{f("formatDate", r.createdAt)}</span>
                  </div>
                  {r.comment ? (
                    <p className="mt-2 text-[14px] leading-relaxed" translate="no">
                      {r.comment}
                    </p>
                  ) : null}
                  <p className="mt-2 text-[12px] text-muted" translate="no">
                    {r.raterName ?? t("Silinmiş kullanıcı")}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-card border border-dashed border-border-strong p-5 text-[14px] text-muted">
              {t("Henüz değerlendirme yok. Değerlendirmeler yalnızca iki tarafın da onayladığı buluşmalardan sonra yapılabilir.")}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
