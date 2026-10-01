import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Icon } from "@/components/icons";
import { ListingGrid } from "@/components/ListingCard";
import { Avatar } from "@/components/ui/Avatar";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Stars } from "@/components/ui/Stars";
import { apiServer } from "@/lib/api/server";
import { searchPublic } from "@/lib/api/listings";
import type { PublicProfile } from "@/lib/api/types";
import { getI18n } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Mağazalar",
  description: "Kıbrıs'taki ikinci el mağazaları ve işletmeleri: ilanlarını, çalışma saatlerini ve değerlendirmelerini gör.",
  alternates: { canonical: "/magazalar" },
};

export default async function StoresPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [{ q }, { t, f }] = await Promise.all([searchParams, getI18n()]);
  const query = (q ?? "").trim().slice(0, 60);
  const [{ stores }, latest] = await Promise.all([
    apiServer<{ stores: PublicProfile[] }>(`/stores?pageSize=48${query ? `&q=${encodeURIComponent(query)}` : ""}`, { anonymous: true, revalidate: 60 }).catch(() => ({ stores: [] as PublicProfile[] })),
    searchPublic({ stores: 1, pageSize: 10 }, 60),
  ]);

  return (
    <div className="mx-auto max-w-[1320px] px-4 pb-16 pt-4 sm:px-6 sm:pt-6">
      <Breadcrumbs items={[t("Mağazalar")]} />
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">{t("Mağazalar")}</h1>
          <p className="mt-1 text-[14px] text-muted">{t("Adadaki ikinci el dükkânları, galeriler ve işletmeler.")}</p>
        </div>
        <form className="flex h-11 w-full items-center rounded-full border border-border-strong pl-4 pr-1.5 sm:w-80" role="search">
          <Icon name="search" className="h-4 w-4 text-muted" />
          <input name="q" defaultValue={query} placeholder={t("Mağaza ara")} aria-label={t("Mağaza ara")} className="h-full min-w-0 flex-1 bg-transparent px-3 text-[15px] outline-none" />
        </form>
      </div>

      {stores.length ? (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stores.map((s) => (
            <li key={s.id}>
              <Link href={`/satici/${s.id}`} className="flex h-full items-start gap-3 rounded-card border border-border p-4 transition hover:border-border-strong hover:shadow-sm">
                <Avatar name={s.name} src={s.avatar} size="lg" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <span className="truncate" translate="no">
                      {s.name}
                    </span>
                    {s.store?.verified ? <Icon name="verified" className="h-4 w-4 flex-shrink-0 text-accent" /> : null}
                  </span>
                  <span className="block text-[13px] text-muted">
                    {[s.region, t(`${s.stats.activeListings} ilan`)].filter(Boolean).join(" · ")}
                  </span>
                  <span className="mt-1 flex items-center gap-1 text-[13px]">
                    {s.stats.ratingCount ? (
                      <>
                        <Stars value={s.stats.ratingAvg} />
                        <span className="font-semibold">{f("decimal", s.stats.ratingAvg)}</span>
                        <span className="text-muted">({s.stats.ratingCount})</span>
                      </>
                    ) : (
                      <span className="text-muted">{t("Henüz değerlendirme yok")}</span>
                    )}
                  </span>
                  {s.store?.hours ? <span className="mt-1 block truncate text-[12px] text-subtle" translate="no">{s.store.hours}</span> : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState className="mt-6" icon="store" title={t(query ? "Bu isimde mağaza yok" : "Henüz mağaza yok")} action={<LinkButton href="/hesabim/magaza">{t("Mağazanı aç")}</LinkButton>}>
          {t("İşletmen varsa ücretsiz mağaza hesabı açıp ilanlarını mağaza adınla yayınlayabilirsin.")}
        </EmptyState>
      )}

      {latest.items.length ? (
        <section className="mt-12">
          <h2 className="mb-4 text-xl font-bold tracking-tight">{t("Mağazalardan yeni ilanlar")}</h2>
          <ListingGrid items={latest.items} />
        </section>
      ) : null}
    </div>
  );
}
