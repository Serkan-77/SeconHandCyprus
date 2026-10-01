import "server-only";
import { apiServer } from "./server";
import type { SearchResult } from "./types";

/** Public listing searches carry no personal data, so they may share a short cache. */
export async function searchPublic(params: Record<string, string | number | undefined>, revalidate = 30): Promise<SearchResult> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") qs.set(k, String(v));
  try {
    return await apiServer<SearchResult>(`/listings?${qs}`, { anonymous: true, revalidate });
  } catch {
    return { items: [], total: 0, page: 1, pageSize: Number(params.pageSize ?? 24), facets: [] };
  }
}
