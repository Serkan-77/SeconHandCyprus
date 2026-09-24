import { ListingCard } from "@/components/ListingCard";
import { Icon } from "@/components/icons";
import { LinkButton } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { ListingCardData } from "@/lib/queries";

export function ListingGrid({
  items,
  columns = 4,
  empty = "Şu an burada gösterilecek ilan yok.",
}: {
  items: ListingCardData[];
  columns?: 3 | 4;
  empty?: string;
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-14 text-center">
        <Icon name="bag" className="h-8 w-8 text-muted" />
        <p className="max-w-xs text-sm text-muted">{empty}</p>
        <LinkButton href="/ilan-ver/fotograflar" full={false} variant="secondary" className="mt-1 min-w-[180px]">
          İlk ilanı sen ver
        </LinkButton>
      </div>
    );
  }
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 sm:gap-5",
        columns === 4 ? "sm:grid-cols-3 lg:grid-cols-4" : "sm:grid-cols-3",
      )}
    >
      {items.map((listing, i) => (
        <ListingCard key={listing.id} listing={listing} priority={i < 4} />
      ))}
    </div>
  );
}
