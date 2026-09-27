"use client";

import { useEffect, useSyncExternalStore } from "react";

// Unread badges between page loads. The server renders the counts with each
// page; LiveUpdates overrides them here when a message or notification comes
// in, without re-rendering the whole page. A newer server count (after a
// navigation) takes over again.

export type UnreadCounts = { messages: number; notifications: number };

let live: UnreadCounts | null = null;
const listeners = new Set<() => void>();

export function setLiveCounts(counts: UnreadCounts | null) {
  live = counts;
  listeners.forEach((l) => l());
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/** The server's counts, or fresher live ones when LiveUpdates has them. */
export function useUnreadCounts(server: UnreadCounts): UnreadCounts {
  const current = useSyncExternalStore(subscribe, () => live, () => null);
  useEffect(() => {
    setLiveCounts(null);
  }, [server.messages, server.notifications]);
  return current ?? server;
}
