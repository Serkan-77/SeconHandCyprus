import type { Metadata } from "next";
import { MyListings } from "@/components/account/MyListings";
import { LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/icons";
import { apiServer } from "@/lib/api/server";
import type { MyListing } from "@/lib/api/types";
import { getI18n } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "İlanlarım" };

export default async function MyListingsPage({ searchParams }: { searchParams: Promise<{ durum?: string }> }) {
  const [{ durum }, { t }, { listings }] = await Promise.all([
    searchParams,
    getI18n(),
    apiServer<{ listings: MyListing[] }>("/me/listings").catch(() => ({ listings: [] as MyListing[] })),
  ]);
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{t("İlanlarım")}</h1>
        <LinkButton href="/ilan-ver" size="sm" icon={<Icon name="plus" className="h-4 w-4" />}>
          {t("Yeni ilan")}
        </LinkButton>
      </div>
      <MyListings listings={listings} tab={durum ?? ""} />
    </div>
  );
}
