import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function ListingCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface">
      <Skeleton className="aspect-[1.25] w-full rounded-none" />
      <div className="flex flex-col gap-2.5 p-4">
        <Skeleton className="h-3 w-2/5" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-5 w-2/5" />
        <Skeleton className="h-3 w-full" />
      </div>
    </div>
  );
}

export function ListingGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <ListingCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function RowSkeleton() {
  return (
    <div className="flex items-center gap-4 border-b border-border p-5 last:border-0">
      <Skeleton className="h-[90px] w-[100px] flex-shrink-0 rounded-lg" />
      <div className="flex flex-1 flex-col gap-2.5">
        <Skeleton className="h-3 w-1/4" />
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-4 w-1/5" />
      </div>
    </div>
  );
}
