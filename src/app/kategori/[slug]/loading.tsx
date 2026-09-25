import { ListingGridSkeleton, Skeleton } from "@/components/ui/Skeleton";

export default function ResultsLoading() {
  return (
    <div className="mx-auto max-w-[1328px] px-4 pb-16 sm:px-6" aria-busy="true" aria-label="İlanlar yükleniyor">
      <div className="py-5">
        <Skeleton className="h-3 w-32" />
      </div>
      <Skeleton className="mb-3 h-8 w-72 max-w-full" />
      <Skeleton className="mb-7 h-3 w-28" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[244px_minmax(0,1fr)] lg:gap-9">
        <Skeleton className="hidden h-[560px] rounded-xl lg:block" />
        <div>
          <Skeleton className="mb-6 h-12 w-full" />
          <ListingGridSkeleton count={6} />
        </div>
      </div>
    </div>
  );
}
