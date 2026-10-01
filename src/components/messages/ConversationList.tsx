"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { Icon } from "@/components/icons";
import { Avatar } from "@/components/ui/Avatar";
import { MediaImage } from "@/components/ui/MediaImage";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { useRealtime } from "@/components/realtime/Realtime";
import { api } from "@/lib/api/client";
import type { ConversationSummary } from "@/lib/api/types";
import { formatLocalized } from "@/lib/i18n/format";
import { cn } from "@/lib/cn";

type Ctx = {
  conversations: ConversationSummary[];
  patch: (id: string, fn: (c: ConversationSummary) => ConversationSummary) => void;
  reload: () => Promise<void>;
};

const ConversationsContext = createContext<Ctx>({ conversations: [], patch: () => {}, reload: async () => {} });

export function useConversations() {
  return useContext(ConversationsContext);
}

/**
 * Messages area: the conversation list beside the open thread (desktop), or
 * one of the two at a time (phones). The list stays live through realtime
 * events and is shared with the thread through context.
 */
export function MessagesShell({ initial, me, children }: { initial: ConversationSummary[]; me: string; children: ReactNode }) {
  const [conversations, setConversations] = useState(initial);
  const segment = useSelectedLayoutSegment();
  const openId = segment && segment !== "__PAGE__" ? segment : null;

  const reload = useCallback(async () => {
    try {
      const { conversations: fresh } = await api.get<{ conversations: ConversationSummary[] }>("/conversations");
      setConversations(fresh);
    } catch {}
  }, []);

  const patch = useCallback((id: string, fn: (c: ConversationSummary) => ConversationSummary) => {
    setConversations((all) => {
      const next = all.map((c) => (c.id === id ? fn(c) : c));
      return next.sort((a, b) => Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt));
    });
  }, []);

  useRealtime((e) => {
    if (e.type === "message") {
      const known = conversations.some((c) => c.id === e.conversationId);
      if (!known) return void reload();
      const mine = e.message.senderId === me;
      patch(e.conversationId, (c) => ({
        ...c,
        lastMessageAt: e.message.createdAt,
        lastMessage: { body: e.message.body, mine, createdAt: e.message.createdAt },
        unread: mine || e.conversationId === openId ? c.unread : c.unread + 1,
      }));
    } else if (e.type === "conversation") {
      patch(e.conversation.id, (c) => {
        const iAmBuyer = c.role === "buyer";
        return {
          ...c,
          meeting: {
            mine: Boolean(iAmBuyer ? e.conversation.buyerConfirmedAt : e.conversation.sellerConfirmedAt),
            theirs: Boolean(iAmBuyer ? e.conversation.sellerConfirmedAt : e.conversation.buyerConfirmedAt),
            confirmedAt: e.conversation.meetingConfirmedAt,
          },
        };
      });
    } else if (e.type === "status" && e.connected) {
      void reload();
    }
  });

  const value = useMemo(() => ({ conversations, patch, reload }), [conversations, patch, reload]);

  return (
    <ConversationsContext.Provider value={value}>
      <div className="mx-auto grid max-w-[1320px] lg:h-[calc(100dvh-108px)] lg:grid-cols-[360px_1fr] lg:gap-0 lg:px-6 lg:py-4">
        <aside className={cn("min-h-0 lg:overflow-hidden lg:rounded-l-card lg:border lg:border-border", openId && "hidden lg:block")}>
          <ConversationList conversations={conversations} openId={openId} />
        </aside>
        <section className={cn("min-h-0 lg:overflow-hidden lg:rounded-r-card lg:border lg:border-l-0 lg:border-border", !openId && "hidden lg:block")}>{children}</section>
      </div>
    </ConversationsContext.Provider>
  );
}

function ConversationList({ conversations, openId }: { conversations: ConversationSummary[]; openId: string | null }) {
  const { t, locale } = useLocale();
  const [tab, setTab] = useState<"all" | "buyer" | "seller" | "unread">("all");
  const [q, setQ] = useState("");
  const needle = q.trim().toLocaleLowerCase("tr-TR");
  const list = conversations.filter(
    (c) =>
      (tab === "all" || (tab === "unread" ? c.unread > 0 : c.role === tab)) &&
      (!needle || c.listing?.title.toLocaleLowerCase("tr-TR").includes(needle) || c.other?.name?.toLocaleLowerCase("tr-TR").includes(needle)),
  );
  const tabs = [
    { key: "all", label: "Tümü" },
    { key: "unread", label: "Okunmamış" },
    { key: "buyer", label: "Alırken" },
    { key: "seller", label: "Satarken" },
  ] as const;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 pb-3 pt-4">
        <h1 className="text-xl font-bold tracking-tight">{t("Mesajlar")}</h1>
        <div className="relative mt-3">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("Kişi ya da ilan ara")}
            aria-label={t("Sohbetlerde ara")}
            className="h-10 w-full rounded-full border border-border-strong bg-surface pl-9 pr-3 text-[14px] focus:border-accent focus:outline-none"
          />
        </div>
        <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto" role="tablist">
          {tabs.map((x) => (
            <button
              key={x.key}
              role="tab"
              aria-selected={tab === x.key}
              onClick={() => setTab(x.key)}
              className={cn("h-8 flex-shrink-0 rounded-pill px-3 text-[13px] font-medium", tab === x.key ? "bg-brand text-on-brand" : "bg-brand-soft text-muted hover:text-text")}
            >
              {t(x.label)}
            </button>
          ))}
        </div>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto" aria-label={t("Sohbetler")}>
        {list.length ? (
          list.map((c) => (
            <li key={c.id}>
              <Link
                href={`/mesajlar/${c.id}`}
                aria-current={c.id === openId ? "page" : undefined}
                className={cn("flex gap-3 border-b border-border px-4 py-3 transition hover:bg-bg", c.id === openId && "bg-accent-soft hover:bg-accent-soft")}
              >
                <span className="relative flex-shrink-0">
                  <Avatar name={c.other?.name ?? "?"} src={c.other?.avatar} size="md" />
                  {c.listing?.image ? (
                    <span className="absolute -bottom-1 -right-1 h-6 w-6 overflow-hidden rounded-md ring-2 ring-surface">
                      <MediaImage urls={c.listing.image} alt="" max="sm" sizes="24px" />
                    </span>
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={cn("truncate text-[14px]", c.unread ? "font-bold" : "font-semibold")} translate="no">
                      {c.other?.name ?? t("Silinmiş kullanıcı")}
                    </span>
                    <span className="flex-shrink-0 text-[12px] text-subtle">{formatLocalized("chatTime", [c.lastMessageAt], locale)}</span>
                  </span>
                  <span className="block truncate text-[12px] text-muted" translate="no">
                    {c.listing?.title ?? t("İlan kaldırıldı")}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2">
                    <span className={cn("min-w-0 flex-1 truncate text-[13px]", c.unread ? "font-medium text-text" : "text-muted")}>
                      {c.lastMessage ? (
                        <>
                          {c.lastMessage.mine ? <span className="text-subtle">{t("Sen:")} </span> : null}
                          <span translate="no">{c.lastMessage.body}</span>
                        </>
                      ) : (
                        <span className="italic text-subtle">{t("Henüz mesaj yok")}</span>
                      )}
                    </span>
                    {c.unread ? <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-on-accent tabular">{c.unread}</span> : null}
                  </span>
                </span>
              </Link>
            </li>
          ))
        ) : (
          <li className="px-6 py-14 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand-soft text-muted">
              <Icon name="chat" className="h-6 w-6" />
            </span>
            <p className="mt-3 font-semibold">{t(conversations.length ? "Bu filtrede sohbet yok" : "Henüz mesajın yok")}</p>
            {!conversations.length ? (
              <p className="mt-1 text-[14px] text-muted">
                {t("Beğendiğin bir ilanda “Satıcıya mesaj gönder”e dokun; sohbetlerin burada toplanır.")}
              </p>
            ) : null}
            {!conversations.length ? (
              <Link href="/ilanlar" className="mt-4 inline-flex h-10 items-center rounded-button bg-brand px-4 text-[14px] font-semibold text-on-brand">
                {t("İlanlara göz at")}
              </Link>
            ) : null}
          </li>
        )}
      </ul>
    </div>
  );
}
