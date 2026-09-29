"use client";
import * as I18n from "@/components/i18n/Localized";


import { Icon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { useFavorites } from "@/components/FavoritesProvider";

export function FavoriteButton({ listingId, className }: { listingId: string; className?: string }) {
  const { favoriteIds, toggleFavorite } = useFavorites();
  const active = favoriteIds.has(listingId);

  return (
    <I18n.button
      type="button"
      onClick={() => toggleFavorite(listingId)}
      aria-label="Favoriye ekle"
      aria-pressed={active}
      className={cn(
        "flex h-11 w-11 items-center justify-center rounded-full border border-border",
        active && "text-accent",
        className,
      )}
    >
      <Icon name="heart" className="h-5 w-5" fill={active ? "currentColor" : "none"} />
    </I18n.button>
  );
}
