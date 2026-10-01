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
        "grid place-items-center rounded-full bg-white/95 text-[#0f1216] shadow-sm ring-1 ring-black/5 transition hover:scale-105 active:scale-95",
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

export function ListingCard({
  listing,
  priority = false,
  layout = "grid",
}: {
  listing: Card;
  priority?: boolean;
  layout?: "grid" | "row";
}) {
  const { t, locale } = useLocale();
  const facts = locale === "en" ? listing.factsEn : listing.facts;
  const location = listing.district ? `${listing.city} · ${listing.district}` : listing.city;
  const unavailable = listing.status === "sold" || listing.status === "removed";

  if (layout === "row") {
    return (
      <article className="group relative flex gap-3 rounded-card border border-border bg-surface p-2.5 transition hover:border-border-strong hover:shadow-md sm:gap-4 sm:p-3">
        <Link href={`/ilan/${listing.slug}`} className="relative block aspect-[4/3] w-32 flex-shrink-0 overflow-hidden rounded-[10px] bg-brand-soft sm:w-48">
          <MediaImage urls={listing.image} alt={listing.title} sizes="200px" max="md" priority={priority} />
          {listing.featured ? <FeaturedTag /> : null}
        </Link>
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="text-[18px] font-bold tracking-tight tabular">{formatLocalized("formatPrice", [listing.price, listing.currency], locale)}</p>
          <Link href={`/ilan/${listing.slug}`} className="mt-0.5 line-clamp-2 text-[14px] font-medium leading-snug after:absolute after:inset-0 sm:text-[15px]">
            <span translate="no">{listing.title}</span>
          </Link>
          {facts.length ? <p className="mt-1 truncate text-[12px] text-muted">{facts.join(" · ")}</p> : null}
          <p className="mt-auto flex items-center gap-1 pt-2 text-[12px] text-subtle">
            <Icon name="pin" className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">{location}</span>
            <span aria-hidden>·</span>
            <span className="flex-shrink-0">{formatLocalized("relativeDay", [listing.createdAt], locale)}</span>
          </p>
        </div>
        <FavoriteHeart id={listing.id} className="relative z-10 self-start" />
      </article>
    );
  }

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-card border border-border bg-surface transition hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md">
      <div className="relative aspect-[4/3] overflow-hidden bg-brand-soft">
        <MediaImage
          urls={listing.image}
          alt={listing.title}
          priority={priority}
          max="md"
          sizes="(min-width: 1280px) 300px, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          className="transition duration-300 group-hover:scale-[1.03]"
        />
        {listing.featured ? <FeaturedTag /> : null}
        {unavailable ? (
          <span className="absolute inset-0 grid place-items-center bg-black/45 text-[13px] font-bold uppercase tracking-wider text-white">
            {t(listing.status === "sold" ? "Satıldı" : "Yayında değil")}
          </span>
        ) : null}
        {listing.photoCount > 1 ? (
          <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[11px] font-medium text-white tabular">
            <Icon name="camera" className="h-3 w-3" />
            {listing.photoCount}
          </span>
        ) : null}
        <FavoriteHeart id={listing.id} className="absolute right-2 top-2 z-10" />
      </div>
      <div className="flex flex-1 flex-col p-3 sm:p-3.5">
        <p className="text-[17px] font-bold tracking-tight tabular sm:text-[18px]">
          {formatLocalized("formatPrice", [listing.price, listing.currency], locale)}
          {listing.negotiable ? <span className="ml-1.5 align-middle text-[11px] font-medium text-muted">{t("Pazarlık")}</span> : null}
        </p>
        <Link
          href={`/ilan/${listing.slug}`}
          className="mt-1 line-clamp-2 min-h-[2.6em] text-[14px] font-medium leading-snug text-text after:absolute after:inset-0"
        >
          <span translate="no">{listing.title}</span>
        </Link>
        {facts.length ? <p className="mt-1 truncate text-[12px] text-muted">{facts.join(" · ")}</p> : null}
        <p className="mt-auto flex items-center gap-1 pt-2.5 text-[12px] text-subtle">
          <Icon name="pin" className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate">{location}</span>
          <span className="ml-auto flex-shrink-0 pl-1">{formatLocalized("relativeDay", [listing.createdAt], locale)}</span>
        </p>
      </div>
    </article>
  );
}

function FeaturedTag() {
  const { t } = useLocale();
  return (
    <span className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-sand-soft px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-sand shadow-sm">
      <Icon name="spark" className="h-3 w-3" />
      {t("Vitrin")}
    </span>
  );
}

export function ListingGrid({ items, priorityCount = 0, className }: { items: Card[]; priorityCount?: number; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5", className)}>
      {items.map((item, i) => (
        <ListingCard key={item.id} listing={item} priority={i < priorityCount} />
      ))}
    </div>
  );
}

export function ListingGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-card border border-border">
          <div className="skeleton aspect-[4/3] rounded-none" />
          <div className="space-y-2 p-3">
            <div className="skeleton h-5 w-1/2" />
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
