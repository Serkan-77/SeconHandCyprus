"use client";
// Browser calls to the API. Same origin (/api/v1, routed by Caddy in
// production and by next.config rewrites in development), so the HttpOnly
// session cookies travel automatically and no token is ever visible to
// JavaScript. Every call carries the CSRF header the API requires.
//
// An expired access token is refreshed once, transparently; concurrent calls
// share that one refresh.
import { ApiRequestError, NETWORK_MESSAGE, toApiError } from "./errors";
import type { UploadResult } from "./types";

let refreshing: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  refreshing ??= fetch("/api/v1/auth/refresh", { method: "POST", headers: { "x-kie-csrf": "1" }, credentials: "same-origin" })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => setTimeout(() => (refreshing = null), 0));
  return refreshing;
}

type Options = { method?: string; body?: unknown; signal?: AbortSignal };

async function send(path: string, opts: Options, form?: FormData) {
  const headers: Record<string, string> = { "x-kie-csrf": "1", accept: "application/json" };
  if (opts.body !== undefined && !form) headers["content-type"] = "application/json";
  return fetch(`/api/v1${path}`, {
    method: opts.method ?? (opts.body !== undefined || form ? "POST" : "GET"),
    headers,
    body: form ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)),
    credentials: "same-origin",
    signal: opts.signal,
    cache: "no-store",
  });
}

async function request<T>(path: string, opts: Options = {}, form?: FormData): Promise<T> {
  let res: Response;
  try {
    res = await send(path, opts, form);
    if (res.status === 401 && !path.startsWith("/auth/")) {
      const body = (await res.clone().json().catch(() => null)) as { error?: { code?: string } } | null;
      if (body?.error?.code === "token_expired" && (await refreshSession())) res = await send(path, opts, form);
    }
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiRequestError(0, "network", NETWORK_MESSAGE);
  }
  if (!res.ok) throw await toApiError(res);
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal }),
  post: <T>(path: string, body: unknown = {}) => request<T>(path, { method: "POST", body }),
  put: <T>(path: string, body: unknown = {}) => request<T>(path, { method: "PUT", body }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: "PATCH", body }),
  del: <T>(path: string, body?: unknown) => request<T>(path, { method: "DELETE", body }),
  upload: (file: File | Blob, kind: "listing" | "avatar" = "listing") => {
    const form = new FormData();
    form.append("file", file, file instanceof File ? file.name : "photo.jpg");
    return request<UploadResult>(`/uploads?kind=${kind}`, { method: "POST" }, form);
  },
  refreshSession,
};
