// Chat history paging (P1-11). The conversation opens on its newest messages
// and older ones are loaded on demand, instead of always showing the oldest 500.
// No "@/" imports so the helpers can be tested directly with node --test.
import type { SupabaseClient } from "@supabase/supabase-js";

export const CHAT_PAGE_SIZE = 50;

export type ChatMessageRow = { id: string; body: string; sender_id: string | null; created_at: string; read_at: string | null };

const COLUMNS = "id, body, sender_id, created_at, read_at";

/** Chronological order; the id breaks ties between identical timestamps. */
export function compareMessages(a: ChatMessageRow, b: ChatMessageRow) {
  return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Adds messages (older pages, live inserts) without duplicates, kept in order. */
export function mergeMessages(current: ChatMessageRow[], incoming: ChatMessageRow[]) {
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, { ...byId.get(m.id), ...m });
  return [...byId.values()].sort(compareMessages);
}

// Fetch one row more than needed to know whether older messages remain.
function page(rows: ChatMessageRow[] | null, limit: number) {
  const list = rows ?? [];
  return { messages: list.slice(0, limit).reverse(), hasMore: list.length > limit };
}

/** The newest `limit` messages of a conversation, oldest first. RLS limits it to participants. */
export async function fetchLatestMessages(supabase: SupabaseClient, conversationId: string, limit = CHAT_PAGE_SIZE) {
  const { data, error } = await supabase
    .from("messages")
    .select(COLUMNS)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);
  if (error) throw error;
  return page(data as ChatMessageRow[], limit);
}

/** The `limit` messages just before `before` (keyset on created_at, id), oldest first. */
export async function fetchOlderMessages(
  supabase: SupabaseClient,
  conversationId: string,
  before: { created_at: string; id: string },
  limit = CHAT_PAGE_SIZE,
) {
  const { data, error } = await supabase
    .from("messages")
    .select(COLUMNS)
    .eq("conversation_id", conversationId)
    .or(`created_at.lt.${before.created_at},and(created_at.eq.${before.created_at},id.lt.${before.id})`)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);
  if (error) throw error;
  return page(data as ChatMessageRow[], limit);
}
