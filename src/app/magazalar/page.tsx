
import * as I18n from "@/components/i18n/Localized";
import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ListingGrid } from "@/components/ListingGrid";
import { Avatar } from "@/components/ui/Avatar";
import { LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/icons";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getViewer, searchListings, toProfile } from "@/lib/queries";
import { initials } from "@/lib/format";

export const metadata: Metadata = {
  title: "Mağazalar",
  description: "Kıbrıs'taki mağaza ve işletmelerin ikinci el ve sıfır ürünleri tek yerde.",
  alternates: { canonical: "/magazalar" },
};

async function getStores() {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("account_type", "store")
    .order("store_verified", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(60);
  const stores = (data ?? []).map(toProfile);
  if (!stores.length) return [];
  const { data: stats } = await supabase
    .from("seller_stats")
    .select("seller_id, active_listings, rating_avg, rating_count")
    .in(
      "seller_id",
      stores.map((s) => s.id),
    );
  return stores.map((s) => {
    const st = (stats ?? []).find((r) => r.seller_id === s.id);
    return { ...s, activeListings: st?.active_listings ?? 0, ratingAvg: Number(st?.rating_avg ?? 0), ratingCount: st?.rating_count ?? 0 };
  });
}

export default async function StoresPage() {
  const [stores, latest, viewer] = await Promise.all([getStores(), searchListings({ storesOnly: true, pageSize: 12 }), getViewer()]);
  const isStore = viewer?.profile.accountType === "store";

  return (
    <I18n.div className="mx-auto max-w-[1328px] px-4 pb-16 sm:px-6">
      <Breadcrumbs items={["Mağazalar"]} />

      <section className="mb-10 flex flex-col gap-5 overflow-hidden rounded-hero bg-brand p-6 text-on-brand sm:flex-row sm:items-center sm:justify-between sm:p-10">
        <div className="max-w-xl">
          <I18n.span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold">
            <Icon name="store" className="h-3.5 w-3.5" />
            Mağazalar
          </I18n.span>
          <I18n.h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-[34px]">Kıbrıs&apos;ın mağazaları, tek vitrinde.</I18n.h1>
          <I18n.p className="mt-2 text-[13px] leading-relaxed opacity-85">
            Mobilyacılar, elektronikçiler, ikinci el dükkânları… İşletmelerin ürünlerine buradan ulaş, doğrudan mesaj at.
          </I18n.p>
        </div>
        <LinkButton
          href={viewer ? "/hesabim/magaza" : "/giris-gerekli?returnTo=/hesabim/magaza"}
          variant="inverse"
          full={false}
          icon={<Icon name="store" className="h-4 w-4" />}
          className="flex-shrink-0"
        >
          {isStore ? "Mağazamı yönet" : "Mağazanı aç"}
        </LinkButton>
      </section>

      <I18n.h2 className="mb-5 text-lg font-semibold sm:text-xl">Mağazalar ({stores.length})</I18n.h2>
      {stores.length ? (
        <I18n.div className="mb-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stores.map((s) => (
            <I18n.Link
              key={s.id}
              href={`/satici/${s.id}`}
              className="flex items-center gap-3.5 rounded-2xl border border-border p-5 transition hover:border-accent hover:bg-accent-soft"
            >
              <Avatar initials={initials(s.storeName ?? s.displayName)} src={s.avatarUrl} />
              <span className="min-w-0 flex-1">
                <I18n.span className="flex flex-wrap items-center gap-1.5">
                  <I18n.b className="truncate text-sm">{s.storeName ? <I18n.Raw>{s.storeName}</I18n.Raw> : s.displayName}</I18n.b>
                  {s.storeVerified ? (
                    <I18n.span className="inline-flex items-center gap-1 rounded bg-accent-soft px-1.5 py-0.5 text-[9px] font-semibold text-accent">
                      <Icon name="shield" className="h-2.5 w-2.5" />
                      Onaylı
                    </I18n.span>
                  ) : null}
                </I18n.span>
                <I18n.span className="mt-1 block truncate text-[11px] text-muted">
                  {[s.region, `${s.activeListings} ürün`, s.ratingCount ? `★ ${s.ratingAvg.toFixed(1)}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </I18n.span>
              </span>
              <Icon name="chevron" className="h-4 w-4 flex-shrink-0 text-muted" />
            </I18n.Link>
          ))}
        </I18n.div>
      ) : (
        <div className="mb-14 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-10 text-center">
          <Icon name="store" className="h-8 w-8 text-accent" />
          <I18n.p className="max-w-sm text-sm text-muted">Henüz mağaza yok. İlk mağazayı sen aç, ürünlerin burada öne çıksın.</I18n.p>
        </div>
      )}

      <I18n.h2 className="mb-5 text-lg font-semibold sm:text-xl">Mağazalardan son ürünler</I18n.h2>
      <ListingGrid items={latest.items} empty="Mağazalar henüz ürün yayınlamadı." />
    </I18n.div>
  );
}
