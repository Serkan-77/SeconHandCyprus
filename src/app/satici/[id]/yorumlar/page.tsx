import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Pagination } from "@/components/ui/Pagination";
import { Stars } from "@/components/ui/Stars";
import { apiServerOrNull } from "@/lib/api/server";
import type { PublicProfile, Rating } from "@/lib/api/types";
import { getI18n } from "@/lib/i18n/server";

type Ratings = { items: Rating[]; total: number; average: number; distribution: Record<string, number>; page: number; pageSize: number };

export const metadata: Metadata = { robots: { index: false, follow: true } };

export default async function SellerReviews({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sayfa?: string }> }) {
  const [{ id }, { sayfa }, { t, f }] = await Promise.all([params, searchParams, getI18n()]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const page = Math.max(1, Number(sayfa) || 1);
  const [profile, ratings] = await Promise.all([
    apiServerOrNull<{ profile: PublicProfile }>(`/users/${id}`),
    apiServerOrNull<Ratings>(`/users/${id}/ratings?page=${page}&pageSize=20`),
  ]);
  if (!profile || !ratings) notFound();
  const p = profile.profile;
  const pages = Math.max(1, Math.ceil(ratings.total / 20));

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-4 sm:px-6 sm:pt-6">
      <Breadcrumbs items={[{ label: p.name, href: `/satici/${p.id}` }, { label: t("Değerlendirmeler") }]} />
      <h1 className="mt-3 text-2xl font-bold tracking-tight">{t("Değerlendirmeler")}</h1>
      <section className="mt-5 grid gap-5 rounded-card border border-border p-5 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="text-center sm:pr-6">
          <p className="text-4xl font-bold tabular">{ratings.total ? f("decimal", ratings.average) : "—"}</p>
          <Stars value={ratings.average} size="md" className="mt-1" />
          <p className="mt-1 text-[13px] text-muted">{t(`${ratings.total} değerlendirme`)}</p>
        </div>
        <ul className="flex flex-col gap-1.5">
          {[5, 4, 3, 2, 1].map((s) => {
            const n = ratings.distribution[s] ?? 0;
            return (
              <li key={s} className="flex items-center gap-2 text-[13px]">
                <span className="w-3 tabular">{s}</span>
                <span className="text-sand">★</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-brand-soft">
                  <span className="block h-full rounded-full bg-sand" style={{ width: `${ratings.total ? (n / ratings.total) * 100 : 0}%` }} />
                </span>
                <span className="w-8 text-right text-muted tabular">{n}</span>
              </li>
            );
          })}
        </ul>
      </section>
      <ul className="mt-6 flex flex-col gap-3">
        {ratings.items.map((r) => (
          <li key={r.id} className="rounded-card border border-border p-4">
            <div className="flex items-center justify-between gap-2">
              <Stars value={r.score} />
              <span className="text-[12px] text-subtle">{f("formatDate", r.createdAt)}</span>
            </div>
            {r.comment ? (
              <p className="mt-2 text-[15px] leading-relaxed" translate="no">
                {r.comment}
              </p>
            ) : null}
            <p className="mt-2 text-[13px] text-muted">
              <span translate="no">{r.raterName ?? t("Silinmiş kullanıcı")}</span>
              {r.listingTitle ? (
                <>
                  {" · "}
                  {r.listingSlug ? (
                    <Link href={`/ilan/${r.listingSlug}`} className="hover:underline" translate="no">
                      {r.listingTitle}
                    </Link>
                  ) : (
                    <span translate="no">{r.listingTitle}</span>
                  )}
                </>
              ) : null}
            </p>
          </li>
        ))}
      </ul>
      <Pagination page={page} pages={pages} href={(n) => (n === 1 ? `/satici/${id}/yorumlar` : `/satici/${id}/yorumlar?sayfa=${n}`)} className="mt-8" />
    </div>
  );
}
