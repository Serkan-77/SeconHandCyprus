import { SHELL } from "@/lib/layout";
import { cn } from "@/lib/cn";
import { SectionHead } from "@/components/SectionHead";
import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Icon } from "@/components/icons";
import { ListingGrid } from "@/components/ListingCard";
import { Avatar } from "@/components/ui/Avatar";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
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
    searchPublic({ stores: 1, pageSize: 48 }, 60),
  ]);
  // Each store's own newest photos, from the same feed.
  const photosOf = (id: string) => latest.items.filter((i) => i.seller.id === id && i.image).slice(0, 3);

  return (
    <div className="pb-16">
      <section className="dark bg-bg text-text">
        <div className={cn(SHELL, "pb-10 pt-5")}>
          <Breadcrumbs items={[t("Mağazalar")]} />
          <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
            <div>
              <h1 className="text-[32px] font-bold leading-tight tracking-[-0.025em] sm:text-[44px]">{t("Mağazalar")}</h1>
              <p className="mt-2 max-w-[52ch] text-[15px] text-muted">{t("Adadaki ikinci el dükkânları, galeriler ve işletmeler.")}</p>
            </div>
            <div className="flex w-full flex-wrap gap-3 sm:w-auto">
              <form className="flex h-12 min-w-0 flex-1 items-center rounded-[14px] border border-border-strong bg-surface pl-4 pr-1.5 sm:w-80 sm:flex-none" role="search">
                <Icon name="search" className="h-4 w-4 text-muted" />
                <input name="q" defaultValue={query} placeholder={t("Mağaza ara")} aria-label={t("Mağaza ara")} className="h-full min-w-0 flex-1 bg-transparent px-3 text-[15px] outline-none" />
              </form>
              <Link href="/hesabim/magaza" className="flex h-12 items-center gap-2 rounded-[14px] bg-text px-5 text-[14px] font-semibold text-bg">
                <Icon name="store" className="h-4 w-4" />
                {t("Mağazanı aç")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className={cn(SHELL, "mt-8")}>
        {stores.length ? (
          <ul className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {stores.map((s) => {
              const photos = photosOf(s.id);
              return (
                <li key={s.id}>
                  <Link href={`/satici/${s.id}`} className="group block">
                    <span className="grid aspect-[16/10] grid-cols-3 gap-1 overflow-hidden rounded-[18px] bg-brand-soft">
                      {photos.length ? (
                        photos.map((p, i) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={p.id} src={p.image!.sm} alt="" loading="lazy" className={cn("h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]", i === 0 && "col-span-2", photos.length === 1 && "col-span-3")} />
                        ))
                      ) : (
                        <span className="col-span-3 grid place-items-center">
                          <Icon name="store" className="h-9 w-9 text-subtle" />
                        </span>
                      )}
                    </span>
                    <span className="mt-3 flex items-center gap-3">
                      <Avatar name={s.name} src={s.avatar} size="md" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 text-[16px] font-bold">
                          <span className="truncate group-hover:underline" translate="no">
                            {s.name}
                          </span>
                          {s.store?.verified ? <Icon name="verified" className="h-4 w-4 flex-shrink-0 text-accent" /> : null}
                        </span>
                        <span className="block text-[13px] text-muted">
                          {[s.region, t(`${s.stats.activeListings} ilan`), s.stats.ratingCount ? `★ ${f("decimal", s.stats.ratingAvg)}` : null].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </span>
                    {s.store?.hours ? <span className="mt-1.5 block truncate pl-[56px] text-[12.5px] text-subtle" translate="no">{s.store.hours}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon="store" title={t(query ? "Bu isimde mağaza yok" : "Henüz mağaza yok")} action={<LinkButton href="/hesabim/magaza">{t("Mağazanı aç")}</LinkButton>}>
            {t("İşletmen varsa ücretsiz mağaza hesabı açıp ilanlarını mağaza adınla yayınlayabilirsin.")}
          </EmptyState>
        )}
      </div>

      {latest.items.length ? (
        <section className={cn(SHELL, "mt-14")}>
          <SectionHead title={t("Mağazalardan yeni ilanlar")} href="/ilanlar?magaza=1" linkLabel={t("Tümünü gör")} />
          <ListingGrid items={latest.items} fill />
        </section>
      ) : null}
    </div>
  );
}
