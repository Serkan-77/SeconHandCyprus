"use client";

import { useEffect } from "react";
import { rememberListing } from "@/components/RecentlyViewed";
import type { ListingCard } from "@/lib/api/types";

/** Counts a view (the API de-duplicates per visitor) and remembers the listing locally. */
export function ViewBeacon({ card, count }: { card: ListingCard; count: boolean }) {
  useEffect(() => {
    rememberListing(card);
    if (count) {
      fetch(`/api/v1/listings/${card.id}/view`, { method: "POST", headers: { "x-kie-csrf": "1" }, keepalive: true }).catch(() => {});
    }
  }, [card, count]);
  return null;
}
