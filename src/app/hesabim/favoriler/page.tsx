
import * as I18n from "@/components/i18n/Localized";
import { redirect } from "next/navigation";
import { Icon } from "@/components/icons";
import { TextLink } from "@/components/ui/TextLink";
import { LinkButton } from "@/components/ui/Button";
import { ListingCard } from "@/components/ListingCard";
import { createClient } from "@/lib/supabase/server";
import { LISTING_CARD_SELECT, getViewer, one, toCard, type ListingCardData } from "@/lib/queries";

export const metadata = { title: "Favorilerim" };

export default async function FavoritesPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/giris-gerekli?returnTo=/hesabim/favoriler");
  const supabase = await createClient();
  const { data } = await supabase
    .from("favorites")
    .select(`created_at, listing:listings(${LISTING_CARD_SELECT})`)
    .eq("user_id", viewer.user.id)
    .order("created_at", { ascending: false });

  // RLS hides favorites whose listing is no longer public (sold/removed).
  const favorites = (data ?? [])
    .map((f) => one(f.listing))
    .filter(Boolean)
    .map(toCard)
    .filter((l: ListingCardData) => l.status === "active");

  return (
    <I18n.div className="flex flex-col gap-6">
      <div>
        <I18n.h1 className="text-2xl font-semibold tracking-tight sm:text-[30px]">Bir kenara ayırdıkların.</I18n.h1>
        <I18n.p className="mt-2 text-[13px] text-muted">Beğendiğin eşyalar, yeniden keşfetmeni bekliyor.</I18n.p>
      </div>

      {favorites.length > 0 ? (
        <>
          <div className="flex flex-wrap items-center gap-2.5 rounded-xl bg-bg px-4 py-3 text-xs">
            <Icon name="bell" className="h-4 w-4 flex-shrink-0 text-accent" />
            <I18n.span>Bir favorinin fiyatı düşünce bildirim alırsın.</I18n.span>
            <TextLink href="/hesabim/ayarlar" className="ml-auto">
              Bildirim tercihleri
            </TextLink>
          </div>
          <I18n.div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5">
            {favorites.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </I18n.div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <span className="flex h-[100px] w-[100px] -rotate-6 items-center justify-center rounded-[35px] bg-brand-soft text-brand">
            <Icon name="heart" className="h-11 w-11 rotate-6" />
          </span>
          <I18n.h2 className="text-xl font-semibold">Henüz favorin yok.</I18n.h2>
          <I18n.p className="max-w-xs text-sm text-muted">Beğendiğin ilanları kalbe dokunarak buraya kaydedebilirsin.</I18n.p>
          <LinkButton href="/ilanlar" full={false} variant="secondary" className="min-w-[200px]">
            İlanları keşfet
          </LinkButton>
        </div>
      )}
    </I18n.div>
  );
}
