"use client";

import Link from "next/link";
import { Icon } from "@/components/icons";
import { MediaImage } from "@/components/ui/MediaImage";
import { useFavorites } from "@/components/FavoritesProvider";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { formatLocalized } from "@/lib/i18n/format";
import type { ListingCard as Card } from "@/lib/api/types";
import { cn } from "@/lib/cn";

export function FavoriteHeart({ id, className, size = "md" }: { id: string; className?: string; size?: "md" | "lg" }) {
  const { t } = useLocale();
  const { favoriteIds, toggleFavorite } = useFavorites();
  const on = favoriteIds.has(id);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFavorite(id);
      }}
      aria-label={t(on ? "Favorilerden çıkar" : "Favoriye ekle")}
      aria-pressed={on}
      className={cn(
        "grid place-items-center rounded-full bg-white/95 text-[#0a0a0a] shadow-sm ring-1 ring-black/5 transition hover:scale-105 active:scale-95",
        size === "lg" ? "h-11 w-11" : "h-9 w-9",
        className,
      )}
    >
      <Icon
        key={String(on)}
        name="heart"
        className={cn(size === "lg" ? "h-[22px] w-[22px]" : "h-[18px] w-[18px]", on && "animate-pop text-[#e0245e]")}
        fill={on ? "currentColor" : "none"}
      />
    </button>
  );
}

function usePrice(listing: Card) {
  const { locale } = useLocale();
  return formatLocalized("formatPrice", [listing.price, listing.currency], locale);
}

function VitrinBadge({ className }: { className?: string }) {
  const { t } = useLocale();
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full bg-[#0a0a0a]/85 px-2 py-[3px] text-[10.5px] font-bold uppercase tracking-[0.08em] text-white backdrop-blur", className)}>
      <Icon name="spark" className="h-3 w-3 text-[#f0bf73]" />
      {t("Vitrin")}
    </span>
  );
}

function StatusVeil({ status }: { status: Card["status"] }) {
  const { t } = useLocale();
  if (status !== "sold" && status !== "removed") return null;
  return (
    <span className="absolute inset-0 grid place-items-center bg-black/50 text-[12px] font-bold uppercase tracking-[0.12em] text-white">
      {t(status === "sold" ? "Satıldı" : "Yayında değil")}
    </span>
  );
}

/**
 * A listing as a product: the photo carries the card, then price, title, the
 * one or two facts a buyer filters by, and where/when. No box around it.
 *
 *   grid     portrait photo, text below (grids, rails, results)
 *   feature  large tile with text over the photo (Vitrin mosaic)
 *   row      photo left, text right (compact lists)
 */
export function ListingCard({
  listing,
  priority = false,
  layout = "grid",
  className,
}: {
  listing: Card;
  priority?: boolean;
  layout?: "grid" | "feature" | "row";
  className?: string;
}) {
  const { t, locale } = useLocale();
  const price = usePrice(listing);
  const facts = (locale === "en" ? listing.factsEn : listing.facts).slice(0, 2);
  const when = formatLocalized("relativeDay", [listing.createdAt], locale);
  const href = `/ilan/${listing.slug}`;

  if (layout === "feature") {
    return (
      <article className={cn("group relative isolate overflow-hidden rounded-[18px] bg-brand-soft", className)}>
        <MediaImage
          urls={listing.image}
          alt={listing.title}
          priority={priority}
          sizes="(min-width: 1280px) 40vw, 100vw"
          className="absolute inset-0 -z-10 transition duration-500 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-2/3 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />
        <div className="flex h-full flex-col justify-between p-4 text-white sm:p-6">
          <div className="flex items-start justify-between">
            {listing.featured ? <VitrinBadge /> : <span />}
            <FavoriteHeart id={listing.id} className="relative z-10" />
          </div>
          <div>
            <p className="text-[28px] font-bold leading-none tracking-tight tabular sm:text-[34px]">{price}</p>
            <Link href={href} className="mt-2 line-clamp-2 max-w-[34ch] text-[16px] font-semibold leading-snug after:absolute after:inset-0 sm:text-[18px]">
              <span translate="no">{listing.title}</span>
            </Link>
            <p className="mt-2 flex flex-wrap items-center gap-x-2 text-[13px] text-white/80">
              {facts.length ? <span>{facts.join(" · ")}</span> : null}
              <span className="flex items-center gap-1">
                <Icon name="pin" className="h-3.5 w-3.5" />
                {listing.city}
              </span>
            </p>
          </div>
        </div>
        <StatusVeil status={listing.status} />
      </article>
    );
  }

  if (layout === "row") {
    return (
      <article className={cn("group relative flex gap-3.5 py-3", className)}>
        <div className="relative aspect-square w-24 flex-shrink-0 overflow-hidden rounded-xl bg-brand-soft sm:w-28">
          <MediaImage urls={listing.image} alt={listing.title} sizes="120px" max="sm" priority={priority} />
          <StatusVeil status={listing.status} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col py-0.5">
          <p className="text-[17px] font-bold tracking-tight tabular">{price}</p>
          <Link href={href} className="mt-0.5 line-clamp-2 text-[14px] leading-snug after:absolute after:inset-0">
            <span translate="no">{listing.title}</span>
          </Link>
          <p className="mt-auto truncate pt-1 text-[12px] text-muted">
            {listing.city} · {when}
          </p>
        </div>
        <FavoriteHeart id={listing.id} className="relative z-10 self-start !bg-transparent !shadow-none !ring-0" />
      </article>
    );
  }

  return (
    <article className={cn("group relative flex min-w-0 flex-col", className)}>
      <div className="relative aspect-[4/5] overflow-hidden rounded-[14px] bg-brand-soft">
        <MediaImage
          urls={listing.image}
          alt={listing.title}
          priority={priority}
          max="md"
          sizes="(min-width: 1800px) 14vw, (min-width: 1280px) 16vw, (min-width: 768px) 25vw, 50vw"
          className="transition duration-500 group-hover:scale-[1.04]"
        />
        <div className="absolute inset-x-2 top-2 flex items-start justify-between">
          {listing.featured ? <VitrinBadge /> : <span />}
          <FavoriteHeart id={listing.id} className="relative z-10" />
        </div>
        {listing.photoCount > 1 ? (
          <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white tabular backdrop-blur">
            <Icon name="camera" className="h-3 w-3" />
            {listing.photoCount}
          </span>
        ) : null}
        {listing.seller.isStore && listing.seller.storeVerified ? (
          <span className="absolute bottom-2 right-2 grid h-6 w-6 place-items-center rounded-full bg-white text-accent shadow-sm" title={t("Onaylı mağaza")}>
            <Icon name="verified" className="h-4 w-4" />
          </span>
        ) : null}
        <StatusVeil status={listing.status} />
      </div>
      <div className="flex flex-1 flex-col px-0.5 pt-2.5">
        <p className="flex items-baseline gap-2">
          <span className="text-[17px] font-bold tracking-tight tabular sm:text-[18px]">{price}</span>
          {listing.negotiable ? <span className="text-[11px] font-semibold uppercase tracking-wide text-accent">{t("Pazarlık")}</span> : null}
        </p>
        <Link href={href} className="mt-0.5 line-clamp-1 text-[14px] leading-snug text-text after:absolute after:inset-0 sm:line-clamp-2 lg:line-clamp-1">
          <span translate="no">{listing.title}</span>
        </Link>
        {facts.length ? <p className="mt-1 truncate text-[12.5px] text-muted">{facts.join(" · ")}</p> : null}
        <p className="mt-1 truncate text-[12px] text-subtle">
          {listing.city} · {when}
        </p>
      </div>
    </article>
  );
}

/** The product grid: 2 columns on phones up to 7 on very wide screens. */
export const GRID = "grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-8 md:grid-cols-4 xl:grid-cols-6 3xl:grid-cols-7";

/**
 * `fill`: render only whole rows. 12 cards fill 2, 3, 4 and 6 columns; the
 * 7-column width shows 14 when they are there.
 */
export function ListingGrid({ items, priorityCount = 0, className, fill = false }: { items: Card[]; priorityCount?: number; className?: string; fill?: boolean }) {
  const shown = fill ? items.slice(0, items.length >= 14 ? 14 : Math.max(12, items.length)) : items;
  return (
    <div className={cn(GRID, className)}>
      {shown.map((item, i) => (
        <ListingCard key={item.id} listing={item} priority={i < priorityCount} className={fill && i >= 12 ? "hidden 3xl:flex" : undefined} />
      ))}
    </div>
  );
}

/** A horizontally scrolling row of cards (snap on touch). */
export function ListingRail({ items, className }: { items: Card[]; className?: string }) {
  return (
    <div className={cn("no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 sm:-mx-6 sm:gap-4 sm:px-6 xl:mx-0 xl:px-0", className)}>
      {items.map((item) => (
        <ListingCard key={item.id} listing={item} className="w-[44vw] flex-shrink-0 snap-start sm:w-[220px] xl:w-[236px]" />
      ))}
    </div>
  );
}

export function ListingGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className={GRID} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <div className="skeleton aspect-[4/5] rounded-[14px]" />
          <div className="space-y-2 pt-3">
            <div className="skeleton h-5 w-1/2" />
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
