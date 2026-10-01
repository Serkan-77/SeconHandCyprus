import { SHELL } from "@/lib/layout";
import { cn } from "@/lib/cn";
import { SectionHead } from "@/components/SectionHead";
import type { IconName } from "@/components/icons";
import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Icon } from "@/components/icons";
import { JsonLd } from "@/components/JsonLd";
import { ListingGrid } from "@/components/ListingCard";
import { Avatar } from "@/components/ui/Avatar";
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

  const facts: { icon: IconName; text: string; href?: string; external?: boolean }[] = [];
  if (p.isStore && p.store) {
    if (p.store.address) facts.push({ icon: "pin", text: p.store.address });
    if (p.store.hours) facts.push({ icon: "clock", text: p.store.hours });
    if (p.store.phone) facts.push({ icon: "phone", text: p.store.phone, href: `tel:${p.store.phone}` });
    if (p.store.website) facts.push({ icon: "globe", text: p.store.website.replace(/^https?:\/\//, ""), href: p.store.website, external: true });
  }

  return (
    <div>
      <JsonLd data={schema} />

      {/* Profile band */}
      <section className="dark bg-bg text-text">
        <div className={cn(SHELL, "pb-8 pt-5 sm:pb-10")}>
          <Breadcrumbs items={[{ label: t(p.isStore ? "Mağazalar" : "Satıcılar"), href: p.isStore ? "/magazalar" : undefined }, { label: p.name }]} />
          <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <Avatar name={p.name} src={p.avatar} size="xl" />
              <div className="min-w-0">
                {p.isStore ? (
                  <p className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-accent">
                    <Icon name={p.store?.verified ? "verified" : "store"} className="h-4 w-4" />
                    {t(p.store?.verified ? "Onaylı mağaza" : "Mağaza")}
                  </p>
                ) : null}
                <h1 className="text-[30px] font-bold leading-tight tracking-[-0.025em] sm:text-[40px]" translate="no">
                  {p.name}
                </h1>
                <p className="mt-1 flex flex-wrap gap-x-3 text-[14px] text-muted">
                  <span>{f("memberSince", p.memberSince)}</span>
                  {p.region ? <span>{p.region}</span> : null}
                  {p.emailVerified ? (
                    <span className="flex items-center gap-1">
                      <Icon name="mail" className="h-4 w-4" />
                      {t("E-posta doğrulandı")}
                    </span>
                  ) : null}
                </p>
                {p.bio ? (
                  <p className="mt-3 max-w-[60ch] whitespace-pre-line text-[15px] leading-relaxed text-text/90" translate="no">
                    {p.bio}
                  </p>
                ) : null}
              </div>
            </div>
            <dl className="grid grid-cols-3 divide-x divide-border rounded-2xl border border-border">
              <div className="flex flex-col-reverse px-5 py-4 text-center sm:px-7">
                <dt className="mt-1 text-[12.5px] text-muted">{p.stats.ratingCount ? t(`${p.stats.ratingCount} değerlendirme`) : t("Puan yok")}</dt>
                <dd className="text-[26px] font-bold leading-none tabular">{p.stats.ratingCount ? f("decimal", p.stats.ratingAvg) : "–"}</dd>
              </div>
              <div className="flex flex-col-reverse px-5 py-4 text-center sm:px-7">
                <dt className="mt-1 text-[12.5px] text-muted">{t("Yayında")}</dt>
                <dd className="text-[26px] font-bold leading-none tabular">{p.stats.activeListings}</dd>
              </div>
              <div className="flex flex-col-reverse px-5 py-4 text-center sm:px-7">
                <dt className="mt-1 text-[12.5px] text-muted">{t("Satılan")}</dt>
                <dd className="text-[26px] font-bold leading-none tabular">{p.stats.soldListings}</dd>
              </div>
            </dl>
          </div>
          {facts.length ? (
            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-5 text-[14px]">
              {facts.map((x) => (
                <li key={x.text} className="flex items-center gap-2">
                  <Icon name={x.icon} className="h-4 w-4 text-muted" />
                  {x.href ? (
                    <a href={x.href} {...(x.external ? { rel: "nofollow noopener noreferrer ugc", target: "_blank" } : {})} className="underline-offset-4 hover:underline" translate="no">
                      {x.text}
                    </a>
                  ) : (
                    <span translate="no">{x.text}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      {p.unavailable ? (
        <div className={cn(SHELL, "mt-6")}>
          <Notice tone="warning">{t("Bu hesabın ilanları şu anda görüntülenemiyor.")}</Notice>
        </div>
      ) : null}

      <section className={cn(SHELL, "pb-12 pt-8")} aria-labelledby="listings">
        <SectionHead id="listings" title={t("İlanları")} meta={`${listings.length} ${t("ilan")}`} />
        {listings.length ? <ListingGrid items={listings} /> : <EmptyState icon="grid" title={t("Yayında ilanı yok")} />}
      </section>

      <div className="zone-band py-10">
      <section className={SHELL} aria-labelledby="reviews">
        <SectionHead
          id="reviews"
          title={t("Değerlendirmeler")}
          meta={p.stats.ratingCount ? `${f("decimal", p.stats.ratingAvg)} · ${p.stats.ratingCount}` : undefined}
          href={p.stats.ratingCount > recentRatings.length ? `/satici/${p.id}/yorumlar` : undefined}
          linkLabel={t("Tümü")}
        />
        {recentRatings.length ? (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {recentRatings.map((r) => (
              <li key={r.id} className="flex flex-col rounded-2xl border border-border bg-surface p-5">
                <Stars value={r.score} />
                <p className="mt-3 flex-1 text-[15px] leading-relaxed" translate="no">
                  {r.comment ? `“${r.comment}”` : <span className="text-muted">{t("Yorum yazılmamış.")}</span>}
                </p>
                <p className="mt-4 flex items-center justify-between text-[12.5px] text-muted">
                  <span className="font-semibold text-text" translate="no">
                    {r.raterName ?? t("Silinmiş kullanıcı")}
                  </span>
                  {f("formatDate", r.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[14px] text-muted">{t("Henüz değerlendirme yok. Değerlendirmeler yalnızca iki tarafın da onayladığı buluşmalardan sonra yapılabilir.")}</p>
        )}
        {!data.viewer.isSelf ? (
          <div className="mt-8 border-t border-border pt-5 text-[13.5px]">
            <ReportDialog target={{ kind: "user", id: p.id }} signedIn={Boolean(me)} label="Kullanıcıyı şikayet et" />
          </div>
        ) : null}
      </section>
      </div>
    </div>
  );
}
