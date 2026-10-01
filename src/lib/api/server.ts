import "server-only";
// Server-side calls to the API (server components, route handlers, server
// actions). The API is reached on the internal network (API_INTERNAL_URL);
// the browser's session cookie and address are forwarded so the API applies
// the same authorization it would to the browser itself. Nothing here is
// cached across users: every call is per request.
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { ApiRequestError, toApiError } from "./errors";
import type { Me, Taxonomy, UnreadCounts } from "./types";

const API = (process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4000").replace(/\/$/, "");
const INTERNAL_TOKEN = process.env.INTERNAL_API_TOKEN ?? "";

async function forwardHeaders(): Promise<Record<string, string>> {
  const [jar, h] = await Promise.all([cookies(), headers()]);
  const out: Record<string, string> = { "x-kie-csrf": "1", accept: "application/json" };
  const access = jar.get("kie_at")?.value;
  if (access) out.cookie = `kie_at=${access}`;
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip");
  if (INTERNAL_TOKEN && ip) {
    out["x-kie-internal"] = INTERNAL_TOKEN;
    out["x-kie-client-ip"] = ip;
  }
  const id = h.get("x-request-id");
  if (id) out["x-request-id"] = id;
  return out;
}

type Options = { method?: string; body?: unknown; revalidate?: number | false; anonymous?: boolean };

export async function apiServer<T>(path: string, opts: Options = {}): Promise<T> {
  const base = opts.anonymous ? { "x-kie-csrf": "1", accept: "application/json" } : await forwardHeaders();
  const init: RequestInit & { next?: { revalidate?: number | false } } = {
    method: opts.method ?? "GET",
    headers: opts.body === undefined ? base : { ...base, "content-type": "application/json" },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    // Personal data is never cached. Public reference data may opt in.
    ...(opts.anonymous && opts.revalidate !== undefined ? { next: { revalidate: opts.revalidate } } : { cache: "no-store" as const }),
  };
  let res: Response;
  try {
    res = await fetch(`${API}/api/v1${path}`, init);
  } catch {
    throw new ApiRequestError(503, "unavailable", "Hizmete şu anda ulaşılamıyor. Birazdan tekrar dene.");
  }
  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Like apiServer, but a 404 becomes null (for pages that call notFound()). */
export async function apiServerOrNull<T>(path: string, opts: Options = {}): Promise<T | null> {
  try {
    return await apiServer<T>(path, opts);
  } catch (e) {
    if (e instanceof ApiRequestError && (e.status === 404 || e.status === 400)) return null;
    throw e;
  }
}

/** The signed-in user, or null. Memoised per request. */
export const getMe = cache(async (): Promise<Me | null> => {
  const jar = await cookies();
  if (!jar.get("kie_at")) return null;
  try {
    return await apiServer<Me>("/me");
  } catch (e) {
    if (e instanceof ApiRequestError && (e.status === 401 || e.status === 403)) return null;
    throw e;
  }
});

export const getUnread = cache(async (): Promise<UnreadCounts> => {
  if (!(await getMe())) return { messages: 0, notifications: 0 };
  try {
    return await apiServer<UnreadCounts>("/me/counts");
  } catch {
    return { messages: 0, notifications: 0 };
  }
});

/** Categories, attributes and regions: public, cached for a minute. */
export const getTaxonomy = cache(async (): Promise<Taxonomy> => {
  try {
    return await apiServer<Taxonomy>("/taxonomy", { anonymous: true, revalidate: 60 });
  } catch {
    return { categories: [], attributes: [], regions: [] };
  }
});

export const getFavoriteIds = cache(async (): Promise<string[]> => {
  if (!(await getMe())) return [];
  try {
    return (await apiServer<{ ids: string[] }>("/me/favorites/ids")).ids;
  } catch {
    return [];
  }
});
