import { ListingGridSkeleton } from "@/components/ListingCard";

export default function ResultsLoading() {
  return (
    <div className="mx-auto max-w-[1320px] px-4 pb-16 pt-6 sm:px-6" aria-busy="true">
      <div className="skeleton h-4 w-40" />
      <div className="skeleton mt-4 h-8 w-72 max-w-full" />
      <div className="skeleton mt-2 h-4 w-24" />
      <div className="mt-6 grid gap-8 lg:grid-cols-[260px_1fr]">
        <div className="skeleton hidden h-[560px] rounded-card lg:block" />
        <ListingGridSkeleton count={8} />
      </div>
    </div>
  );
}
