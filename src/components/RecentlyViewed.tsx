"use client";

// "Son baktıkların": kept only in this browser (localStorage), never sent to
// the server. The listing page records a minimal snapshot of each card.
import { useSyncExternalStore } from "react";
import type { ListingCard } from "@/lib/api/types";
import { ListingRail } from "@/components/ListingCard";
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
      <div className="mb-4 flex items-end justify-between gap-4 sm:mb-5">
        <h2 id="recent-heading" className="text-[22px] font-bold leading-tight tracking-[-0.02em] sm:text-[26px]">
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
          className="border-b-2 border-transparent pb-0.5 text-[14px] font-semibold text-muted hover:border-brand hover:text-text"
        >
          {t("Temizle")}
        </button>
      </div>
      <ListingRail items={items} />
    </section>
  );
}
