import type { Metadata } from "next";
import { ListingGrid } from "@/components/ListingCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/Button";
import { apiServer } from "@/lib/api/server";
import type { ListingCard } from "@/lib/api/types";
import { getI18n } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Favorilerim" };

export default async function FavoritesPage() {
  const [{ t }, { listings }] = await Promise.all([
    getI18n(),
    apiServer<{ listings: ListingCard[] }>("/me/favorites").catch(() => ({ listings: [] as ListingCard[] })),
  ]);
  const active = listings.filter((l) => l.status === "active");
  const gone = listings.filter((l) => l.status !== "active");
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">{t("Favorilerim")}</h1>
      <p className="mt-1 text-[14px] text-muted">{t("Fiyatı düşen favorilerin için bildirim alırsın.")}</p>
      <div className="mt-5">
        {listings.length ? (
          <div className="flex flex-col gap-10">
            {active.length ? <ListingGrid items={active} className="lg:grid-cols-3 xl:grid-cols-4" /> : null}
            {gone.length ? (
              <section>
                <h2 className="mb-3 font-semibold text-muted">{t("Artık satışta olmayanlar")}</h2>
                <ListingGrid items={gone} className="opacity-80 lg:grid-cols-3 xl:grid-cols-4" />
              </section>
            ) : null}
          </div>
        ) : (
          <EmptyState icon="heart" title={t("Henüz favorin yok")} action={<LinkButton href="/ilanlar">{t("İlanlara göz at")}</LinkButton>}>
            {t("Beğendiğin ilanlardaki kalbe dokun; hepsi burada toplanır ve fiyatları düşünce haber veririz.")}
          </EmptyState>
        )}
      </div>
    </div>
  );
}
