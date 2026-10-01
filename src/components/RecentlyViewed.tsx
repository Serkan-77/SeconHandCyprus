"use client";

// "Son baktıkların": kept only in this browser (localStorage), never sent to
// the server. The listing page records a minimal snapshot of each card.
import { useSyncExternalStore } from "react";
import type { ListingCard } from "@/lib/api/types";
import { ListingCard as Card } from "@/components/ListingCard";
import { useLocale } from "@/components/i18n/LocaleProvider";

const KEY = "kie-recent-v1";
const MAX = 12;
const listeners = new Set<() => void>();
let cache: { raw: string | null; items: ListingCard[] } = { raw: null, items: [] };

function read(): ListingCard[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === cache.raw) return cache.items;
    const items = raw ? (JSON.parse(raw) as ListingCard[]).filter((x) => x && x.id && x.slug) : [];
    cache = { raw, items };
    return items;
  } catch {
    return [];
  }
}

export function rememberListing(card: ListingCard) {
  try {
    const next = [card, ...read().filter((x) => x.id !== card.id)].slice(0, MAX);
    window.localStorage.setItem(KEY, JSON.stringify(next));
    listeners.forEach((l) => l());
  } catch {
    // Storage unavailable (private mode): nothing to remember.
  }
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  window.addEventListener("storage", fn);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", fn);
  };
}

const EMPTY: ListingCard[] = [];

export function RecentlyViewed({ excludeId, title = "Son baktıkların" }: { excludeId?: string; title?: string }) {
  const { t } = useLocale();
  const items = useSyncExternalStore(subscribe, read, () => EMPTY).filter((x) => x.id !== excludeId && x.status === "active");
  if (items.length < 2) return null;
  return (
    <section aria-labelledby="recent-heading">
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 id="recent-heading" className="text-xl font-bold tracking-tight sm:text-2xl">
          {t(title)}
        </h2>
        <button
          type="button"
          onClick={() => {
            try {
              window.localStorage.removeItem(KEY);
              listeners.forEach((l) => l());
            } catch {}
          }}
          className="text-[13px] font-medium text-muted hover:text-text"
        >
          {t("Temizle")}
        </button>
      </div>
      <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
        {items.map((item) => (
          <div key={item.id} className="w-[46%] flex-shrink-0 snap-start sm:w-[31%] lg:w-[23%] xl:w-[18.5%]">
            <Card listing={item} />
          </div>
        ))}
      </div>
    </section>
  );
}
