// Chat message list helpers (pure; tested with node --test). Paging itself
// is done by the API (keyset on created_at, id); these keep the client's list
// ordered and free of duplicates while pages, live events and optimistic
// sends arrive in any order.

export type ChatMessage = {
  id: string;
  senderId: string | null;
  body: string;
  createdAt: string;
  readAt: string | null;
  /** Client-only: an optimistic message that is still being sent, or failed. */
  pending?: "sending" | "failed";
  /** Client-only: temporary id of the optimistic copy a server message replaces. */
  tempId?: string;
};

/** Chronological order; the id breaks ties between identical timestamps. */
export function compareMessages(a: Pick<ChatMessage, "createdAt" | "id">, b: Pick<ChatMessage, "createdAt" | "id">) {
  const ta = Date.parse(a.createdAt);
  const tb = Date.parse(b.createdAt);
  if (ta !== tb) return ta < tb ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Adds messages (older pages, live inserts, send results) without duplicates, kept in order. */
export function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) {
    if (m.tempId) byId.delete(m.tempId);
    byId.set(m.id, { ...byId.get(m.id), ...m, tempId: undefined, pending: m.pending });
  }
  // Optimistic copies sort by their send time among real messages; failed
  // ones stay at the end so they are easy to retry.
  return [...byId.values()].sort((a, b) => {
    if (a.pending === "failed" && b.pending !== "failed") return 1;
    if (b.pending === "failed" && a.pending !== "failed") return -1;
    return compareMessages(a, b);
  });
}

/** Marks my messages as read up to `at` (a read receipt from the other side). */
export function applyReadReceipt(list: ChatMessage[], me: string, at: string) {
  const t = Date.parse(at);
  return list.map((m) => (m.senderId === me && !m.readAt && !m.pending && Date.parse(m.createdAt) <= t ? { ...m, readAt: at } : m));
}

/** Local calendar day key for date separators. */
export function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
