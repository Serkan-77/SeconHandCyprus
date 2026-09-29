"use client";
import * as I18n from "@/components/i18n/Localized";
import { useLocale } from "@/components/i18n/LocaleProvider";


import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button, LinkButton } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { SelectField, TextareaField } from "@/components/ui/Field";
import { FormError } from "@/components/ui/FormError";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";
import { getBrowserClient } from "@/lib/supabase/client";
import { MEETING_TEXT, meetingActions, meetingStage, type MeetingState } from "@/lib/meeting";
import { fetchLatestMessages, mergeMessages } from "@/lib/chat";
import {
  blockUser,
  confirmMeeting,
  loadOlderMessages,
  markConversationRead,
  rateUser,
  reportUser,
  sendMessage,
  unblockUser,
} from "@/lib/actions/messages";

/** sender_id is null once the sender deleted their account (P1-09). */
export type ChatMessage = { id: string; body: string; sender_id: string | null; created_at: string; read_at: string | null };

export type ChatConversation = {
  id: string;
  role: "buyer" | "seller";
  other: { id: string; name: string; avatarUrl: string | null };
  listing: { title: string; slug: string | null; image: string };
  lastMessage: string;
  lastAt: string;
  unread: number;
  blockedByMe: boolean;
  /** Each side confirms the meeting separately; ratings open once both have. */
  meeting: MeetingState;
};

type ModalKind = "options" | "report" | "unblock" | "meeting" | "rating" | null;

const quickReplies = {
  buyer: ["Hâlâ satılık mı?", "Son fiyat nedir?", "Nerede buluşalım?"],
  seller: ["Evet, hâlâ satılık.", "Hangi gün uygunsun?", "Fiyatta biraz esneyebilirim."],
};

const reportReasons = ["Dolandırıcılık şüphesi", "Taciz ya da hakaret", "Fiyat dışı ödeme talebi", "Spam", "Diğer"];

function dayLabel(value: string, locale: 'tr' | 'en') {
  const d = new Date(value);
  const today = new Date();
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(today) - start(d)) / 86400000);
  if (diff === 0) return "BUGÜN";
  if (diff === 1) return "DÜN";
  const language = locale === 'tr' ? 'tr-TR' : 'en-GB';
  return d.toLocaleDateString(language, { day: "numeric", month: "long", year: "numeric" }).toLocaleUpperCase(language);
}

export function ChatView({
  me,
  conversations,
  activeId,
  initialMessages,
  initialHasOlder = false,
  hasRated,
}: {
  me: string;
  conversations: ChatConversation[];
  activeId: string | null;
  initialMessages: ChatMessage[];
  /** More messages exist before the first one loaded (the page opens on the newest). */
  initialHasOlder?: boolean;
  hasRated: boolean;
}) {
  const active = conversations.find((c) => c.id === activeId) ?? null;
  const router = useRouter();
  const { t, locale } = useLocale();
  const [messages, setMessages] = useState(initialMessages);
  const [hasOlder, setHasOlder] = useState(initialHasOlder);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderError, setOlderError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const [modal, setModal] = useState<ModalKind>(null);
  const [rating, setRating] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingDone, setRatingDone] = useState(hasRated);
  const [ratingSent, setRatingSent] = useState(false);
  const [blocked, setBlocked] = useState(active?.blockedByMe ?? false);
  const [meeting, setMeeting] = useState<MeetingState>(active?.meeting ?? { mine: false, theirs: false });
  // A live refresh can bring the other side's confirmation; confirmations only
  // ever get added, so merge instead of replacing what this side just did.
  const [seenMeeting, setSeenMeeting] = useState(active?.meeting);
  if (active && active.meeting !== seenMeeting) {
    setSeenMeeting(active.meeting);
    setMeeting((m) => ({ mine: m.mine || active.meeting.mine, theirs: m.theirs || active.meeting.theirs }));
  }
  const meetingStep = meetingStage(meeting);
  const { canConfirm, canRate } = meetingActions(meeting);
  // The other side deleted their account: the history stays readable, nothing else.
  const otherGone = Boolean(active && !active.other.id);
  const [sendError, setSendError] = useState("");
  const [modalError, setModalError] = useState("");
  const [reportSent, setReportSent] = useState(false);
  const [filter, setFilter] = useState("");
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Live updates: new messages from the other side and read receipts. Keyed on
  // the id: a router refresh hands in a new `active` object for the same
  // conversation, which must not drop and re-open the channel.
  const activeConversationId = active?.id ?? null;
  // Re-renders the messages page for the list and badges, but never after the
  // user has already moved on to another page.
  const refreshIfStillHere = useCallback(() => {
    if (window.location.pathname === "/mesajlar") router.refresh();
  }, [router]);
  useEffect(() => {
    if (!activeConversationId) return;
    const conversationId = activeConversationId;
    const supabase = getBrowserClient();
    let everSubscribed = false;
    // Marks the other side's messages read, then refreshes the page so the
    // conversation list and the header badge show the new state.
    async function readAndRefresh() {
      await markConversationRead(conversationId);
      refreshIfStillHere();
    }
    markConversationRead(conversationId);
    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload: { new: unknown }) => {
          const msg = payload.new as ChatMessage;
          setMessages((prev) => mergeMessages(prev, [msg]));
          if (msg.sender_id !== me) readAndRefresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload: { new: unknown }) => {
          const msg = payload.new as ChatMessage;
          setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, read_at: msg.read_at } : m)));
        },
      )
      .subscribe((status: string) => {
        if (status !== "SUBSCRIBED") return;
        // Once live, and again after every reconnect, pick up anything that
        // arrived while the channel was not listening.
        const reconnect = everSubscribed;
        everSubscribed = true;
        fetchLatestMessages(supabase, conversationId)
          .then((latest) => {
            setMessages((prev) => mergeMessages(prev, latest.messages));
            if (reconnect && latest.messages.some((m) => m.sender_id !== me && !m.read_at)) readAndRefresh();
          })
          .catch(() => {});
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeConversationId, me, refreshIfStillHere]);

  // Follow the conversation when a newer message arrives, but not when an
  // older page is prepended above what the user is reading.
  const newestId = messages.at(-1)?.id;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [newestId]);

  async function showOlder() {
    const first = messages[0];
    if (!active || !first || loadingOlder) return;
    setLoadingOlder(true);
    setOlderError("");
    const list = listRef.current;
    const heightBefore = list?.scrollHeight ?? 0;
    const result = await loadOlderMessages(active.id, { created_at: first.created_at, id: first.id }).catch(() => ({
      error: "Eski mesajlar yüklenemedi.",
      messages: undefined,
      hasMore: undefined,
    }));
    setLoadingOlder(false);
    if (result.error || !result.messages) {
      setOlderError(result.error ?? "Eski mesajlar yüklenemedi.");
      return;
    }
    setMessages((prev) => mergeMessages(prev, result.messages ?? []));
    setHasOlder(Boolean(result.hasMore));
    // Keep the message that was on top where it was.
    requestAnimationFrame(() => {
      if (list) list.scrollTop += list.scrollHeight - heightBefore;
    });
  }

  const visibleConversations = useMemo(() => {
    const q = filter.trim().toLocaleLowerCase("tr-TR");
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        c.other.name.toLocaleLowerCase("tr-TR").includes(q) || c.listing.title.toLocaleLowerCase("tr-TR").includes(q),
    );
  }, [conversations, filter]);

  // `pending` only updates on the next render, so a second Enter pressed
  // before that would send the same text twice; the ref blocks it at once.
  const sendingRef = useRef(false);

  function send(text: string) {
    if (!active || !text.trim() || otherGone || sendingRef.current) return;
    if (blocked) {
      setSendError(`${active.other.name} kullanıcısını engellediğin için mesajlaşamıyorsun.`);
      return;
    }
    setSendError("");
    sendingRef.current = true;
    // Clear the box right away; the text comes back if sending fails.
    const typed = inputRef.current?.value === text;
    if (typed && inputRef.current) inputRef.current.value = "";
    startTransition(async () => {
      try {
        const result = await sendMessage(active.id, text);
        if (result.message) {
          const msg = result.message;
          setMessages((prev) => mergeMessages(prev, [msg]));
          // The conversation list shows the new last message.
          refreshIfStillHere();
          return;
        }
        if (typed && inputRef.current && !inputRef.current.value) inputRef.current.value = text;
        setSendError(
          result.error === "blocked"
            ? "Mesaj gönderilemedi. Bu kullanıcıyla artık mesajlaşamazsın ya da hesabın kısıtlı."
            : (result.error ?? "Mesaj gönderilemedi."),
        );
      } catch {
        // Connection dropped: keep the text and say so instead of crashing the page.
        if (typed && inputRef.current && !inputRef.current.value) inputRef.current.value = text;
        setSendError("Mesaj gönderilemedi. Bağlantını kontrol edip tekrar dene.");
      } finally {
        sendingRef.current = false;
      }
    });
  }

  function closeModal() {
    setModal(null);
    setModalError("");
    setTimeout(() => {
      setReportSent(false);
      setRatingSent(false);
    }, 250);
  }

  const unreadTotal = conversations.reduce((sum, c) => sum + (c.id === active?.id ? 0 : c.unread), 0);

  return (
    <I18n.div className="mx-auto max-w-[1328px] px-4 pb-10 sm:px-6">
      <I18n.nav aria-label="İçerik yolu" className="hidden py-4 text-[11px] text-muted sm:block">
        <I18n.Link href="/">Ana sayfa</I18n.Link> <I18n.span>/</I18n.span> <I18n.span className="text-text">Mesajlar</I18n.span>
      </I18n.nav>

      <I18n.div className="mt-4 grid h-[calc(100dvh-220px)] min-h-[560px] grid-cols-1 overflow-hidden rounded-2xl border border-border sm:mt-0 sm:h-[700px] lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className={cn("min-h-0 flex-col border-border bg-surface lg:flex lg:border-r", active ? "hidden" : "flex")}>
          <I18n.div className="flex items-center gap-2 px-5 pb-4 pt-6">
            <I18n.h1 className="text-xl font-semibold tracking-tight">Mesajlar</I18n.h1>
            {unreadTotal ? (
              <I18n.span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent-soft px-1 text-[10px] text-accent">
                {unreadTotal}
              </I18n.span>
            ) : null}
          </I18n.div>
          <label className="mx-5 mb-4 flex min-h-[42px] items-center gap-2 rounded-field border border-border px-3.5 text-muted">
            <Icon name="search" className="h-4 w-4" />
            <I18n.input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Konuşma ara"
              aria-label="Konuşmalarda ara"
              className="w-full bg-transparent text-xs text-text outline-none"
            />
          </label>
          <I18n.div className="min-h-0 flex-1 overflow-auto">
            {visibleConversations.length === 0 ? (
              <I18n.div className="flex flex-col items-center gap-3 px-6 py-12 text-center text-xs text-muted">
                <Icon name="chat" className="h-8 w-8" />
                {conversations.length === 0
                  ? "Henüz bir konuşman yok. Beğendiğin bir ilanda “Satıcıya mesaj gönder”e dokun."
                  : "Aramana uyan konuşma yok."}
                {conversations.length === 0 ? (
                  <LinkButton href="/ilanlar" full={false} variant="secondary" className="mt-2">
                    İlanları keşfet
                  </LinkButton>
                ) : null}
              </I18n.div>
            ) : (
              visibleConversations.map((c) => (
                <I18n.Link
                  key={c.id}
                  href={`/mesajlar?c=${c.id}`}
                  aria-current={active?.id === c.id ? "page" : undefined}
                  className={cn(
                    "flex w-full items-center gap-2.5 border-b border-border px-5 py-5 text-left",
                    active?.id === c.id && "border-l-[3px] border-l-accent bg-bg pl-[17px]",
                  )}
                >
                  <I18n.span className="relative">
                    <Avatar initials={initials(c.other.name)} src={c.other.avatarUrl} />
                    {c.unread && c.id !== active?.id ? (
                      <i className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-surface bg-accent" />
                    ) : null}
                  </I18n.span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <I18n.b className="truncate text-[13px]"><I18n.Raw>{c.other.name}</I18n.Raw></I18n.b>
                      <I18n.small className="flex-shrink-0 text-[9px] text-muted"><I18n.Formatted kind="chatTime" args={[c.lastAt]} /></I18n.small>
                    </span>
                    <I18n.strong className="mt-1 block truncate text-[10px] font-medium"><I18n.Raw>{c.listing.title}</I18n.Raw></I18n.strong>
                    <I18n.p className={cn("mt-0.5 truncate text-[11px]", c.unread && c.id !== active?.id ? "text-text" : "text-muted")}>
                      <I18n.Raw>{c.lastMessage}</I18n.Raw>
                    </I18n.p>
                  </span>
                </I18n.Link>
              ))
            )}
          </I18n.div>
          <I18n.div className="mt-auto flex gap-2.5 p-5 text-[10px] leading-relaxed text-muted">
            <Icon name="shield" className="h-[18px] w-[18px] flex-shrink-0" />
            İletişimini uygulama içinde tutmak, konuşmalarını takip etmeyi kolaylaştırır.
          </I18n.div>
        </aside>

        {active ? (
          <I18n.section className="flex min-h-0 flex-col bg-surface">
            <I18n.div className="flex h-[72px] items-center gap-3 border-b border-border px-4 sm:h-20 sm:px-6">
              <I18n.Link href="/mesajlar" aria-label="Konuşmalara dön" className="grid h-10 w-10 place-items-center rounded-full lg:hidden">
                <Icon name="back" className="h-4 w-4" />
              </I18n.Link>
              {otherGone ? (
                <span className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar initials={initials(active.other.name)} src={null} />
                  <I18n.span className="block truncate text-sm font-semibold"><I18n.Raw>{active.other.name}</I18n.Raw></I18n.span>
                </span>
              ) : (
                <>
                  <I18n.Link href={`/satici/${active.other.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar initials={initials(active.other.name)} src={active.other.avatarUrl} />
                    <span className="min-w-0">
                      <I18n.span className="block truncate text-sm font-semibold"><I18n.Raw>{active.other.name}</I18n.Raw></I18n.span>
                      <I18n.span className="text-[10px] text-muted">
                        {blocked ? "Engellendi" : active.role === "buyer" ? "Satıcı" : "Alıcı"}
                      </I18n.span>
                    </span>
                  </I18n.Link>
                  <I18n.button
                    onClick={() => setModal(blocked ? "unblock" : "options")}
                    aria-label="Sohbet seçenekleri"
                    className="grid h-10 w-10 place-items-center rounded-full"
                  >
                    <Icon name="more" className="h-4 w-4" />
                  </I18n.button>
                </>
              )}
            </I18n.div>

            <I18n.div className="flex items-center gap-3 border-b border-border bg-bg px-4 py-3 sm:px-6">
              <I18n.Image
                src={active.listing.image}
                alt={active.listing.title}
                width={43}
                height={43}
                className="h-[43px] w-[43px] rounded-lg object-cover"
              />
              <div className="min-w-0 flex-1">
                <I18n.strong className="block truncate text-xs"><I18n.Raw>{active.listing.title}</I18n.Raw></I18n.strong>
                <I18n.span className="text-[10px] text-muted">{active.role === "buyer" ? "İlgilendiğin ilan" : "Senin ilanın"}</I18n.span>
              </div>
              {active.listing.slug ? (
                <I18n.Link href={`/ilan/${active.listing.slug}`} className="text-[11px] font-medium text-accent">
                  İlanı gör
                </I18n.Link>
              ) : (
                <I18n.span className="text-[11px] text-muted">Yayında değil</I18n.span>
              )}
            </I18n.div>

            <I18n.div ref={listRef} className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4 sm:p-7" aria-live="polite">
              <I18n.div className="mx-auto flex max-w-[600px] items-center gap-2.5 rounded-xl bg-brand-soft p-3 text-[11px]">
                <Icon name="shield" className="h-4 w-4 flex-shrink-0 text-accent" />
                Ürünü görmeden ödeme yapma. Güvenli ve kalabalık bir yerde buluş.
              </I18n.div>
              {hasOlder ? (
                <I18n.button
                  type="button"
                  onClick={showOlder}
                  disabled={loadingOlder}
                  className="self-center text-[11px] font-medium text-accent"
                >
                  {loadingOlder ? "Yükleniyor…" : "Daha eski mesajları göster"}
                </I18n.button>
              ) : null}
              {olderError ? <I18n.p className="self-center text-[11px] text-danger">{olderError}</I18n.p> : null}
              {messages.map((m, i) => {
                const label = dayLabel(m.created_at, locale);
                const showDay = i === 0 || dayLabel(messages[i - 1].created_at, locale) !== label;
                const mine = m.sender_id === me;
                return (
                  <I18n.div key={m.id} className="contents">
                    {showDay ? <I18n.p className="text-center text-[11px] text-muted">{label}</I18n.p> : null}
                    <I18n.div
                      className={cn(
                        "max-w-[85%] whitespace-pre-line break-words rounded-2xl border px-4 py-3 text-[13px] leading-relaxed sm:max-w-[76%]",
                        mine
                          ? "self-end rounded-br-md border-text bg-text text-surface"
                          : "self-start rounded-bl-md border-border bg-bg",
                      )}
                    >
                      <I18n.Raw>{m.body}</I18n.Raw>
                      <I18n.small className="mt-1.5 block text-[9px] opacity-65">
                        <I18n.Formatted kind="clockTime" args={[m.created_at]} />
                        {mine ? (m.read_at ? " · Okundu" : " · Gönderildi") : ""}
                      </I18n.small>
                    </I18n.div>
                  </I18n.div>
                );
              })}
              {messages.length === 0 ? (
                <I18n.p className="py-6 text-center text-xs text-muted">
                  <I18n.Raw>{active.other.name}</I18n.Raw> ile ilk mesajını gönder. Hazır sorulardan birini de seçebilirsin.
                </I18n.p>
              ) : null}
              <I18n.div ref={bottomRef} className="mt-auto flex flex-wrap items-center gap-2.5">
                {otherGone ? null : quickReplies[active.role].map((q) => (
                  <I18n.button
                    key={q}
                    onClick={() => send(t(q))}
                    disabled={pending}
                    className="min-h-9 rounded-full border border-border px-3.5 text-[10px]"
                  >
                    {q}
                  </I18n.button>
                ))}
                {messages.length > 0 && !otherGone ? (
                  <I18n.span className="flex flex-wrap items-center gap-2.5 text-[10px]" aria-live="polite">
                    {meetingStep !== "none" ? <I18n.span className="text-muted">{MEETING_TEXT[meetingStep]}</I18n.span> : null}
                    {canConfirm ? (
                      <I18n.button onClick={() => setModal("meeting")} className="font-medium text-accent">
                        Buluşmayı onayla
                      </I18n.button>
                    ) : null}
                    {canRate && !ratingDone ? (
                      <I18n.button onClick={() => setModal("rating")} className="font-medium text-accent">
                        Değerlendirme bırak
                      </I18n.button>
                    ) : null}
                  </I18n.span>
                ) : null}
              </I18n.div>
            </I18n.div>

            {sendError ? (
              <div className="mx-4 mb-3 flex items-center gap-2.5 rounded-xl bg-brand-soft px-4 py-3 text-xs sm:mx-5">
                <Icon name="info" className="h-4 w-4 flex-shrink-0 text-accent" />
                <I18n.span className="flex-1">{sendError}</I18n.span>
                <I18n.button type="button" onClick={() => setSendError("")} aria-label="Kapat" className="flex-shrink-0">
                  <Icon name="close" className="h-4 w-4" />
                </I18n.button>
              </div>
            ) : null}
            {otherGone ? (
              <I18n.p className="border-t border-border p-4 text-center text-xs text-muted sm:p-5">
                Bu kullanıcı hesabını sildi. Konuşma geçmişi duruyor ama yeni mesaj gönderemezsin.
              </I18n.p>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send(inputRef.current?.value ?? "");
                }}
                className="flex gap-2.5 border-t border-border p-4 sm:p-5"
              >
                <I18n.input
                  ref={inputRef}
                  placeholder={blocked ? "Bu kullanıcıyı engelledin" : "Mesajını yaz…"}
                  aria-label="Mesaj"
                  autoComplete="off"
                  maxLength={2000}
                  className="min-w-0 flex-1 rounded-field border border-border bg-bg px-3.5 py-3 text-base text-text outline-none"
                />
                <Button type="submit" full={false} disabled={pending} icon={<Icon name="send" className="h-4 w-4" />}>
                  <I18n.span className="hidden sm:inline">Gönder</I18n.span>
                </Button>
              </form>
            )}
          </I18n.section>
        ) : (
          <section className="hidden flex-col items-center justify-center gap-4 bg-surface p-10 text-center lg:flex">
            <span className="flex h-[100px] w-[100px] -rotate-6 items-center justify-center rounded-[35px] bg-brand-soft text-brand">
              <Icon name="chat" className="h-11 w-11 rotate-6" />
            </span>
            <I18n.h2 className="text-xl font-semibold">Bir konuşma seç.</I18n.h2>
            <I18n.p className="max-w-xs text-sm text-muted">Soldaki listeden bir konuşma seçerek mesajlaşmaya devam et.</I18n.p>
          </section>
        )}
      </I18n.div>

      {active ? (
        <>
          <Modal title="Sohbet seçenekleri" open={modal === "options"} onClose={closeModal}>
            <I18n.div className="flex flex-col gap-1">
              <I18n.button
                onClick={() => setModal("report")}
                className="flex items-center gap-3 border-b border-border py-4 text-left text-sm"
              >
                <Icon name="flag" className="h-[18px] w-[18px] text-muted" />
                <I18n.Raw>{active.other.name}</I18n.Raw> kullanıcısını şikayet et
              </I18n.button>
              <I18n.button
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await blockUser(active.other.id);
                    if (result.error) setModalError(result.error);
                    else {
                      setBlocked(true);
                      closeModal();
                    }
                  })
                }
                className="flex items-center gap-3 py-4 text-left text-sm text-danger"
              >
                <Icon name="close" className="h-[18px] w-[18px]" />
                <I18n.Raw>{active.other.name}</I18n.Raw> kullanıcısını engelle
              </I18n.button>
              {modalError ? <FormError>{modalError}</FormError> : null}
            </I18n.div>
          </Modal>

          <Modal title={reportSent ? "Şikayet alındı" : "Kullanıcıyı şikayet et"} open={modal === "report"} onClose={closeModal}>
            {reportSent ? (
              <I18n.p className="text-sm text-muted">Teşekkürler. Moderasyon ekibimiz şikayetini 24 saat içinde inceleyecek.</I18n.p>
            ) : (
              <I18n.form
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  startTransition(async () => {
                    const result = await reportUser(active.other.id, String(form.get("reason")), String(form.get("detail") ?? ""));
                    if (result.error) setModalError(result.error);
                    else setReportSent(true);
                  });
                }}
                className="flex flex-col gap-4"
              >
                <SelectField label="Şikayet nedeni" name="reason" options={reportReasons} />
                <TextareaField label="Detay (opsiyonel)" name="detail" maxLength={1000} />
                {modalError ? <FormError>{modalError}</FormError> : null}
                <Button type="submit" disabled={pending}>
                  Şikayeti gönder
                </Button>
              </I18n.form>
            )}
          </Modal>

          <Modal title="Engeli kaldır" open={modal === "unblock"} onClose={closeModal}>
            <I18n.p className="text-sm text-muted">
              <I18n.Raw>{active.other.name}</I18n.Raw> kullanıcısının engelini kaldırmak istediğine emin misin? Engeli kaldırdığında tekrar
              mesajlaşabilirsiniz.
            </I18n.p>
            <div className="mt-5 flex gap-3">
              <Button variant="outline" full={false} onClick={closeModal}>
                Vazgeç
              </Button>
              <Button
                full={false}
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await unblockUser(active.other.id);
                    setBlocked(false);
                    setSendError("");
                    closeModal();
                  })
                }
              >
                Engeli kaldır
              </Button>
            </div>
          </Modal>

          <Modal title="Buluşmayı onayla" open={modal === "meeting"} onClose={closeModal}>
            <I18n.p className="text-sm text-muted">
              <I18n.Raw>{active.other.name}</I18n.Raw> ile buluşmayı tamamladığını onaylıyor musun? İkiniz de onayladığınızda kısa bir
              değerlendirme bırakabilirsin.
            </I18n.p>
            {modalError ? <FormError className="mt-4">{modalError}</FormError> : null}
            <Button
              className="mt-5"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await confirmMeeting(active.id);
                  if (result.error) setModalError(result.error);
                  else if (result.bothConfirmed) {
                    setMeeting({ mine: true, theirs: true });
                    setModalError("");
                    setModal("rating");
                  } else {
                    setMeeting((m) => ({ ...m, mine: true }));
                    closeModal();
                  }
                })
              }
            >
              Buluşmayı onayla
            </Button>
          </Modal>

          <Modal
            title={ratingSent ? "Teşekkürler!" : `${active.other.name} kullanıcısını değerlendir`}
            open={modal === "rating"}
            onClose={closeModal}
          >
            {ratingSent ? (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <Icon name="check" className="h-7 w-7" />
                </span>
                <I18n.p className="text-sm text-muted">
                  Değerlendirmen gönderildi ve <I18n.Raw>{active.other.name}</I18n.Raw> kullanıcısının profilinde görünecek.
                </I18n.p>
                <Button full={false} onClick={closeModal}>
                  Tamam
                </Button>
              </div>
            ) : (
              <I18n.form
                onSubmit={(e) => {
                  e.preventDefault();
                  startTransition(async () => {
                    const result = await rateUser(active.id, active.other.id, rating, ratingComment);
                    if (result.error) setModalError(result.error);
                    else {
                      setRatingSent(true);
                      setRatingDone(true);
                    }
                  });
                }}
                className="flex flex-col gap-4"
              >
                <I18n.div className="flex justify-center gap-1.5" role="radiogroup" aria-label="Puan">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <I18n.button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={rating === n}
                      onClick={() => setRating(n)}
                      aria-label={`${n} yıldız`}
                      className="text-[34px] text-accent"
                    >
                      {n <= rating ? "★" : "☆"}
                    </I18n.button>
                  ))}
                </I18n.div>
                <TextareaField
                  label="Yorum (opsiyonel)"
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value)}
                  maxLength={500}
                  placeholder="Buluşma nasıl geçti?"
                />
                <I18n.p className="text-center text-xs text-muted">
                  Değerlendirmen, kullanıcının profilinde görünür ve gelecekteki alıcılara yardımcı olur.
                </I18n.p>
                {modalError ? <FormError>{modalError}</FormError> : null}
                <Button type="submit" disabled={pending}>
                  Değerlendirmeyi gönder
                </Button>
              </I18n.form>
            )}
          </Modal>
        </>
      ) : null}
    </I18n.div>
  );
}
