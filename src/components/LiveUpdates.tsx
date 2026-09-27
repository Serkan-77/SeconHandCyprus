"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { getBrowserClient } from "@/lib/supabase/client";

type Toast = { id: string; title: string; body: string | null; link: string | null };

const TOAST_MS = 6000;
// Coalesces bursts (a message and its notification arrive together).
const REFRESH_DELAY_MS = 250;
// Catch-up when the tab comes back or the live connection is down.
const FALLBACK_POLL_MS = 30000;
const FOCUS_THROTTLE_MS = 10000;

/** The page the user is on, as a notification link would spell it. */
function currentPath() {
  return window.location.pathname + window.location.search;
}

/** The conversation open in /mesajlar, if any; ChatView handles its own messages. */
function openConversation() {
  if (window.location.pathname !== "/mesajlar") return null;
  return new URLSearchParams(window.location.search).get("c");
}

/**
 * Keeps the signed-in user's header badges, notification list and
 * conversation list current without a reload: new notifications and messages
 * arrive over Supabase Realtime (RLS limits both to the user's own rows), and a
 * short toast shows what came in.
 */
export function LiveUpdates({ userId }: { userId: string }) {
  const router = useRouter();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRefresh = useRef(0);

  useEffect(() => {
    const supabase = getBrowserClient();
    let live = false;

    function refreshSoon() {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => {
        lastRefresh.current = Date.now();
        router.refresh();
      }, REFRESH_DELAY_MS);
    }

    const channel = supabase
      .channel(`live:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload: { new: unknown }) => {
          const n = payload.new as Toast & { kind: string };
          // Already looking at it (e.g. the conversation the message belongs to).
          if (n.link && n.link === currentPath()) return;
          setToasts((prev) => [...prev.slice(-2), { id: n.id, title: n.title, body: n.body, link: n.link }]);
          setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== n.id)), TOAST_MS);
          refreshSoon();
        },
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload: { new: unknown }) => {
        const msg = payload.new as { conversation_id: string; sender_id: string | null };
        if (msg.sender_id === userId || msg.conversation_id === openConversation()) return;
        refreshSoon();
      })
      .subscribe((status: string) => {
        const wasLive = live;
        live = status === "SUBSCRIBED";
        // Reconnected after a drop: fetch what was missed meanwhile.
        if (live && !wasLive && lastRefresh.current) refreshSoon();
      });

    function onVisible() {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastRefresh.current < FOCUS_THROTTLE_MS) return;
      refreshSoon();
    }
    document.addEventListener("visibilitychange", onVisible);
    lastRefresh.current = Date.now();

    const poll = setInterval(() => {
      if (!live && document.visibilityState === "visible") refreshSoon();
    }, FALLBACK_POLL_MS);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(poll);
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      supabase.removeChannel(channel);
    };
  }, [userId, router]);

  if (!toasts.length) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6 sm:w-[360px]"
    >
      {toasts.map((t) => {
        const content = (
          <>
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Icon name="bell" className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block truncate text-[13px]">{t.title}</b>
              {t.body ? <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{t.body}</span> : null}
            </span>
          </>
        );
        const dismiss = () => setToasts((prev) => prev.filter((x) => x.id !== t.id));
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex w-full items-start gap-2 rounded-xl border border-border border-l-4 border-l-brand bg-surface p-3 shadow-lg"
          >
            {t.link ? (
              <Link href={t.link} onClick={dismiss} className="flex min-w-0 flex-1 items-start gap-3">
                {content}
              </Link>
            ) : (
              <div className="flex min-w-0 flex-1 items-start gap-3">{content}</div>
            )}
            <button type="button" onClick={dismiss} aria-label="Bildirimi kapat" className="grid h-7 w-7 place-items-center text-muted">
              <Icon name="close" className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
