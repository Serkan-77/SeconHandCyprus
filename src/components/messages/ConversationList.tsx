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
      {/* A workspace that fills the screen under the header: rail | conversation (| context, inside the thread). */}
      <div className="grid lg:h-[calc(100dvh-134px)] lg:grid-cols-[380px_minmax(0,1fr)]">
        <aside className={cn("min-h-0 lg:overflow-hidden lg:border-r lg:border-border", openId && "hidden lg:block")}>
          <ConversationList conversations={conversations} openId={openId} />
        </aside>
        <section className={cn("min-h-0 lg:overflow-hidden", !openId && "hidden lg:block")}>{children}</section>
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
      <div className="px-4 pb-0 pt-5 sm:px-5">
        <h1 className="flex items-baseline gap-2 text-[26px] font-bold tracking-[-0.02em]">
          {t("Mesajlar")}
          {conversations.some((c) => c.unread) ? (
            <span className="text-[14px] font-semibold text-accent tabular">
              {conversations.reduce((n, c) => n + c.unread, 0)} {t("okunmamış")}
            </span>
          ) : null}
        </h1>
        <div className="relative mt-3">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("Kişi ya da ilan ara")}
            aria-label={t("Sohbetlerde ara")}
            className="h-11 w-full rounded-xl border border-border-strong bg-surface pl-9 pr-3 text-[14px] focus:border-brand focus:outline-none"
          />
        </div>
        <div className="no-scrollbar mt-3 flex gap-5 overflow-x-auto border-b border-border" role="tablist">
          {tabs.map((x) => (
            <button
              key={x.key}
              role="tab"
              aria-selected={tab === x.key}
              onClick={() => setTab(x.key)}
              className={cn("-mb-px h-10 flex-shrink-0 border-b-2 text-[14px] font-semibold", tab === x.key ? "border-brand text-text" : "border-transparent text-muted hover:text-text")}
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
                className={cn("relative flex gap-3.5 px-4 py-3.5 transition hover:bg-brand-soft sm:px-5", c.id === openId && "bg-brand-soft")}
              >
                {c.id === openId ? <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-brand" aria-hidden /> : null}
                <span className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-brand-soft">
                  {c.listing?.image ? <MediaImage urls={c.listing.image} alt="" max="sm" sizes="56px" /> : <Icon name="image" className="m-auto mt-4 h-6 w-6 text-subtle" />}
                  <span className="absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-surface">
                    <Avatar name={c.other?.name ?? "?"} src={c.other?.avatar} size="xs" />
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={cn("truncate text-[15px]", c.unread ? "font-bold" : "font-semibold")} translate="no">
                      {c.other?.name ?? t("Silinmiş kullanıcı")}
                    </span>
                    <span className={cn("flex-shrink-0 text-[12px]", c.unread ? "font-semibold text-accent" : "text-subtle")}>{formatLocalized("chatTime", [c.lastMessageAt], locale)}</span>
                  </span>
                  <span className="block truncate text-[12.5px] text-muted" translate="no">
                    {c.role === "buyer" ? t("Alırken") : t("Satarken")} · {c.listing?.title ?? t("İlan kaldırıldı")}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2">
                    <span className={cn("min-w-0 flex-1 truncate text-[13.5px]", c.unread ? "font-semibold text-text" : "text-muted")}>
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
                    {c.meeting.confirmedAt ? <Icon name="handshake" className="h-4 w-4 flex-shrink-0 text-success" aria-label={t("Buluşma onaylandı")} /> : null}
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
