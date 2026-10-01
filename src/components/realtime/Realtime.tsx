"use client";

// One WebSocket per tab for the signed-in user (see api/src/realtime/hub.ts).
// Reconnects with backoff, pings to keep proxies from idling it out, and
// re-syncs unread counts after every reconnect so nothing is missed while
// offline. Components subscribe with useRealtime(handler).
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "@/lib/api/client";
import type { UnreadCounts } from "@/lib/api/types";
import { setLiveCounts } from "@/lib/liveCounts";

export type RealtimeEvent =
  | { type: "ready" }
  | { type: "message"; conversationId: string; message: { id: string; conversationId: string; senderId: string | null; body: string; createdAt: string; readAt: string | null } }
  | { type: "read"; conversationId: string; at: string }
  | { type: "conversation"; conversation: { id: string; buyerId: string | null; sellerId: string | null; buyerConfirmedAt: string | null; sellerConfirmedAt: string | null; meetingConfirmedAt: string | null } }
  | { type: "notification"; notification: { id: string; kind: string; title: string; body: string | null; link: string | null; createdAt: string } }
  | { type: "status"; connected: boolean };

type Listener = (event: RealtimeEvent) => void;

const RealtimeContext = createContext<{ subscribe: (fn: Listener) => () => void }>({ subscribe: () => () => {} });

function socketUrl() {
  const configured = process.env.NEXT_PUBLIC_WS_URL;
  if (configured) return configured;
  const { protocol, host } = window.location;
  return `${protocol === "https:" ? "wss" : "ws"}://${host}/api/v1/ws`;
}

export function RealtimeProvider({ userId, children }: { userId: string | null; children: ReactNode }) {
  const listeners = useRef(new Set<Listener>());

  useEffect(() => {
    if (!userId) return;
    let ws: WebSocket | null = null;
    let attempt = 0;
    let stopped = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let ping: ReturnType<typeof setInterval> | undefined;

    const emit = (e: RealtimeEvent) => listeners.current.forEach((fn) => fn(e));
    const syncCounts = () =>
      api
        .get<UnreadCounts>("/me/counts")
        .then(setLiveCounts)
        .catch(() => {});

    function connect() {
      if (stopped) return;
      ws = new WebSocket(socketUrl());
      ws.onmessage = (raw) => {
        let event: RealtimeEvent;
        try {
          event = JSON.parse(String(raw.data));
        } catch {
          return;
        }
        if (event.type === "ready") {
          attempt = 0;
          emit({ type: "status", connected: true });
          void syncCounts();
          return;
        }
        if (event.type === "message" || event.type === "notification" || event.type === "read") void syncCounts();
        emit(event);
      };
      ws.onclose = async (e) => {
        clearInterval(ping);
        emit({ type: "status", connected: false });
        if (stopped) return;
        // 4401: the access token expired or is invalid; refresh once, then retry.
        if (e.code === 4401) await api.refreshSession();
        if (e.code === 4001) return; // signed out elsewhere
        const delay = Math.min(30_000, 1000 * 2 ** attempt++) + Math.random() * 500;
        retry = setTimeout(connect, delay);
      };
      ping = setInterval(() => ws?.readyState === WebSocket.OPEN && ws.send('{"type":"ping"}'), 25_000);
    }

    // Reconnect promptly when the tab comes back or the network returns.
    const wake = () => {
      if (document.visibilityState === "visible" && (!ws || ws.readyState === WebSocket.CLOSED)) {
        clearTimeout(retry);
        attempt = 0;
        connect();
      }
    };
    connect();
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);
    return () => {
      stopped = true;
      clearTimeout(retry);
      clearInterval(ping);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", wake);
      ws?.close();
    };
  }, [userId]);

  // Created once; the listener set is only touched from effects and events.
  const [value] = useState(() => ({
    subscribe: (fn: Listener) => {
      listeners.current.add(fn);
      return () => {
        listeners.current.delete(fn);
      };
    },
  }));

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

/** Calls handler for every realtime event while the component is mounted. */
export function useRealtime(handler: Listener) {
  const { subscribe } = useContext(RealtimeContext);
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => subscribe((e) => ref.current(e)), [subscribe]);
}
