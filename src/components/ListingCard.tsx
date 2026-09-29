"use client";
import * as I18n from "@/components/i18n/Localized";


import { Icon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { useFavorites } from "@/components/FavoritesProvider";
import type { ListingCardData } from "@/lib/queries";

export function ListingCard({ listing, priority = false }: { listing: ListingCardData; priority?: boolean }) {
  const { favoriteIds, toggleFavorite } = useFavorites();
  const favorite = favoriteIds.has(listing.id);
  const location = listing.district ? `${listing.city}, ${listing.district}` : listing.city;

  return (
    <article className="group relative overflow-hidden rounded-card border border-border bg-surface transition hover:-translate-y-1 hover:shadow-lg">
      <I18n.Link
        href={`/ilan/${listing.slug}`}
        aria-label={`${listing.title} ilanını aç`}
        className="relative block aspect-[1.25] w-full overflow-hidden bg-bg"
      >
        <I18n.Image
          src={listing.image}
          alt={listing.title}
          fill
          priority={priority}
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          className="object-cover transition duration-300 group-hover:scale-[1.035]"
        />
        {listing.featured ? (
          <I18n.span className="absolute left-3 top-3 rounded-md bg-white/95 px-2 py-1 text-[9px] font-semibold tracking-wide text-[#111318]">
            VİTRİN
          </I18n.span>
        ) : null}
      </I18n.Link>
      <I18n.button
        onClick={() => toggleFavorite(listing.id)}
        aria-label={favorite ? "Favorilerden çıkar" : "Favoriye ekle"}
        aria-pressed={favorite}
        className={cn(
          "absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-border/40 bg-white/95 text-[#111318]",
          favorite && "text-[#2458d3]",
        )}
      >
        <Icon name="heart" className="h-[19px] w-[19px]" fill={favorite ? "currentColor" : "none"} />
      </I18n.button>
      <div className="p-4">
        <I18n.span className="block truncate text-[10px] text-muted">
          {listing.category.name} <I18n.span>· {listing.condition}</I18n.span>
        </I18n.span>
        <I18n.Link
          href={`/ilan/${listing.slug}`}
          className="mt-1.5 block min-h-[30px] truncate text-[15px] font-medium text-text"
        >
          <I18n.Raw>{listing.title}</I18n.Raw>
        </I18n.Link>
        <I18n.strong className="my-1.5 block text-xl font-semibold tracking-tight text-text">
          <I18n.Formatted kind="formatPrice" args={[listing.price, listing.currency]} />
        </I18n.strong>
        <div className="flex items-center justify-between gap-1 border-t border-border pt-2.5 text-[10px] text-muted">
          <span className="flex min-w-0 items-center gap-1 truncate">
            <Icon name="pin" className="h-3 w-3 flex-shrink-0" />
            <I18n.span className="truncate">{location}</I18n.span>
          </span>
          <I18n.span className="flex-shrink-0"><I18n.Formatted kind="relativeDay" args={[listing.createdAt]} /></I18n.span>
        </div>
      </div>
    </article>
  );
}
