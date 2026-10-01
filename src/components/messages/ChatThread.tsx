"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { MediaImage } from "@/components/ui/MediaImage";
import { Modal } from "@/components/ui/Modal";
import { FormError } from "@/components/ui/FormError";
import { useToast } from "@/components/ui/Toast";
import { ReportDialog } from "@/components/listing/ReportDialog";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { useRealtime } from "@/components/realtime/Realtime";
import { useConversations } from "@/components/messages/ConversationList";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import type { ConversationSummary } from "@/lib/api/types";
import { applyReadReceipt, dayKey, mergeMessages, type ChatMessage } from "@/lib/chat";
import { MEETING_TEXT, meetingActions, meetingStage } from "@/lib/meeting";
import { formatLocalized } from "@/lib/i18n/format";
import { LIMITS } from "@shared/constants";
import { cn } from "@/lib/cn";

const QUICK = {
  buyer: ["Merhaba, hâlâ satılık mı?", "Son fiyat nedir?", "Ne zaman görebilirim?", "Nerede buluşabiliriz?"],
  seller: ["Merhaba, evet hâlâ satılık.", "Hangi gün uygunsun?", "Fiyatta biraz esneyebilirim."],
};

function dayLabel(iso: string, locale: "tr" | "en", t: (s: string) => string) {
  const d = new Date(iso);
  const today = new Date();
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(today) - start(d)) / 86400000);
  if (diff === 0) return t("Bugün");
  if (diff === 1) return t("Dün");
  return formatLocalized("formatLongDate", [iso], locale);
}

export function ChatThread({
  initial,
  initialMessages,
  initialHasMore,
  me,
}: {
  initial: ConversationSummary;
  initialMessages: ChatMessage[];
  initialHasMore: boolean;
  me: string;
}) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const toast = useToast();
  const { patch } = useConversations();
  const [convo, setConvo] = useState(initial);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [text, setText] = useState("");
  const [modal, setModal] = useState<"options" | "meeting" | "rating" | null>(null);
  const [newBelow, setNewBelow] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const atBottom = useRef(true);
  const keepOffset = useRef<number | null>(null);
  const readTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const stage = meetingStage(convo.meeting);
  const { canConfirm, canRate } = meetingActions(convo.meeting);
  const bothTalked = messages.some((m) => m.senderId === me) && messages.some((m) => m.senderId && m.senderId !== me);

  const markRead = useCallback(() => {
    clearTimeout(readTimer.current);
    readTimer.current = setTimeout(() => {
      if (document.visibilityState !== "visible") return;
      void api.post(`/conversations/${convo.id}/read`).catch(() => {});
      patch(convo.id, (c) => ({ ...c, unread: 0 }));
    }, 400);
  }, [convo.id, patch]);

  useEffect(() => {
    markRead();
    const onVisible = () => document.visibilityState === "visible" && markRead();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [markRead]);

  useRealtime((e) => {
    if (e.type === "message" && e.conversationId === convo.id) {
      setMessages((list) => mergeMessages(list, [{ ...e.message }]));
      if (e.message.senderId !== me) {
        if (!atBottom.current) setNewBelow(true);
        markRead();
      }
    } else if (e.type === "read" && e.conversationId === convo.id) {
      setMessages((list) => applyReadReceipt(list, me, e.at));
    } else if (e.type === "conversation" && e.conversation.id === convo.id) {
      const iAmBuyer = convo.role === "buyer";
      setConvo((c) => ({
        ...c,
        meeting: {
          mine: Boolean(iAmBuyer ? e.conversation.buyerConfirmedAt : e.conversation.sellerConfirmedAt),
          theirs: Boolean(iAmBuyer ? e.conversation.sellerConfirmedAt : e.conversation.buyerConfirmedAt),
          confirmedAt: e.conversation.meetingConfirmedAt,
        },
      }));
    } else if (e.type === "status" && e.connected) {
      // Reconnected: fetch what may have arrived meanwhile.
      void api
        .get<{ messages: ChatMessage[] }>(`/conversations/${convo.id}/messages?limit=50`)
        .then((r) => setMessages((list) => mergeMessages(list, r.messages)))
        .catch(() => {});
    }
  });

  // Scroll handling: stick to the bottom unless the reader scrolled up;
  // keep the position when older messages are prepended.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (keepOffset.current !== null) {
      el.scrollTop = el.scrollHeight - keepOffset.current;
      keepOffset.current = null;
    } else if (atBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  function onScroll() {
    const el = scroller.current;
    if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (atBottom.current) setNewBelow(false);
    if (el.scrollTop < 120 && hasMore && !loadingOlder) void loadOlder();
  }

  async function loadOlder() {
    const oldest = messages.find((m) => !m.pending);
    if (!oldest) return;
    setLoadingOlder(true);
    try {
      const r = await api.get<{ messages: ChatMessage[]; hasMore: boolean }>(
        `/conversations/${convo.id}/messages?before=${encodeURIComponent(oldest.createdAt)}&beforeId=${oldest.id}`,
      );
      if (scroller.current) keepOffset.current = scroller.current.scrollHeight - scroller.current.scrollTop;
      setMessages((list) => mergeMessages(list, r.messages));
      setHasMore(r.hasMore);
    } catch {
      toast.show("Eski mesajlar yüklenemedi.", { tone: "error" });
    } finally {
      setLoadingOlder(false);
    }
  }

  async function send(body: string, retryOf?: string) {
    const trimmed = body.trim();
    if (!trimmed || !convo.canSend) return;
    const tempId = retryOf ?? `tmp-${crypto.randomUUID()}`;
    const temp: ChatMessage = { id: tempId, senderId: me, body: trimmed, createdAt: new Date().toISOString(), readAt: null, pending: "sending" };
    atBottom.current = true;
    setMessages((list) => mergeMessages(list.filter((m) => m.id !== tempId), [temp]));
    if (!retryOf) setText("");
    try {
      const { message } = await api.post<{ message: ChatMessage }>(`/conversations/${convo.id}/messages`, { body: trimmed });
      setMessages((list) => mergeMessages(list, [{ ...message, tempId }]));
      patch(convo.id, (c) => ({ ...c, lastMessageAt: message.createdAt, lastMessage: { body: message.body, mine: true, createdAt: message.createdAt } }));
    } catch (e) {
      setMessages((list) => list.map((m) => (m.id === tempId ? { ...m, pending: "failed" } : m)));
      toast.show(errorMessage(e), { tone: "error" });
    }
  }

  async function confirmMeeting() {
    try {
      const r = await api.post<{ bothConfirmed: boolean }>(`/conversations/${convo.id}/meeting`);
      setConvo((c) => ({ ...c, meeting: { ...c.meeting, mine: true, theirs: c.meeting.theirs || r.bothConfirmed } }));
      setModal(r.bothConfirmed ? "rating" : null);
      toast.show(r.bothConfirmed ? "Buluşma iki taraf tarafından onaylandı." : "Onayın kaydedildi.");
    } catch (e) {
      toast.show(errorMessage(e), { tone: "error" });
    }
  }

  async function setBlocked(block: boolean) {
    if (!convo.other) return;
    try {
      if (block) await api.post(`/users/${convo.other.id}/block`);
      else await api.del(`/users/${convo.other.id}/block`);
      setConvo((c) => ({ ...c, iBlocked: block, canSend: !block && !c.blockedMe && Boolean(c.other) }));
      setModal(null);
      toast.show(block ? "Kullanıcı engellendi." : "Engel kaldırıldı.");
    } catch (e) {
      toast.show(errorMessage(e), { tone: "error" });
    }
  }

  const otherName = convo.other?.name ?? t("Silinmiş kullanıcı");
  const coarse = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
  let lastDay = "";

  return (
    <div className="fixed inset-0 z-50 flex bg-surface lg:relative lg:inset-auto lg:z-auto lg:h-full">
      <div className="relative flex min-w-0 flex-1 flex-col">
      {/* Header */}
      <header className="flex h-[68px] flex-shrink-0 items-center gap-2 border-b border-border px-2 pt-[env(safe-area-inset-top)] lg:px-5">
        <button type="button" onClick={() => router.push("/mesajlar")} aria-label={t("Sohbetlere dön")} className="grid h-11 w-11 place-items-center rounded-full hover:bg-brand-soft lg:hidden">
          <Icon name="back" className="h-5 w-5" />
        </button>
        {convo.other ? (
          <Link href={`/satici/${convo.other.id}`} className="flex min-w-0 flex-1 items-center gap-2.5">
            <Avatar name={otherName} src={convo.other.avatar} size="md" />
            <span className="min-w-0">
              <span className="block truncate text-[16px] font-bold" translate="no">
                {otherName}
              </span>
              <span className="block text-[12px] text-muted">{t(convo.role === "buyer" ? "Satıcı" : "Alıcı")}</span>
            </span>
          </Link>
        ) : (
          <span className="flex-1 truncate px-2 font-semibold text-muted">{otherName}</span>
        )}
        <button type="button" onClick={() => setModal("options")} aria-label={t("Sohbet seçenekleri")} className="grid h-11 w-11 place-items-center rounded-full hover:bg-brand-soft">
          <Icon name="more" className="h-6 w-6" />
        </button>
      </header>

      {/* Listing context */}
      {convo.listing ? (
        <Link href={`/ilan/${convo.listing.slug}`} className="flex items-center gap-3 border-b border-border px-4 py-2.5 hover:bg-brand-soft xl:hidden">
          <span className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-md bg-brand-soft">
            <MediaImage urls={convo.listing.image} alt="" max="sm" sizes="44px" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium" translate="no">
              {convo.listing.title}
            </span>
            <span className="text-[13px] font-bold tabular">{formatLocalized("formatPrice", [convo.listing.price, convo.listing.currency], locale)}</span>
          </span>
          {convo.listing.status !== "active" ? (
            <span className="rounded-md bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-muted">{t(convo.listing.status === "sold" ? "Satıldı" : "Yayında değil")}</span>
          ) : (
            <Icon name="chevron" className="h-4 w-4 text-subtle" />
          )}
        </Link>
      ) : (
        <p className="border-b border-border px-4 py-2.5 text-[13px] text-muted xl:hidden">{t("Bu sohbetin ilanı kaldırılmış.")}</p>
      )}

      {/* Meeting */}
      {bothTalked || stage !== "none" ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-4 py-2 text-[13px] xl:hidden">
          <Icon name="handshake" className="h-4 w-4 flex-shrink-0 text-muted" />
          <span className="min-w-0 flex-1 text-muted">{stage === "none" ? t("Buluşup alışverişi tamamladınız mı?") : t(MEETING_TEXT[stage])}</span>
          {canConfirm && convo.other ? (
            <button type="button" onClick={() => setModal("meeting")} className="font-semibold text-accent">
              {t("Buluşmayı onayla")}
            </button>
          ) : null}
          {canRate && !convo.rated && convo.other ? (
            <button type="button" onClick={() => setModal("rating")} className="font-semibold text-accent">
              {t("Değerlendir")}
            </button>
          ) : null}
          {convo.rated ? <span className="font-medium text-success">{t("Değerlendirdin")}</span> : null}
        </div>
      ) : null}

      {/* Messages */}
      <div ref={scroller} onScroll={onScroll} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-5 sm:px-6 lg:px-10" aria-live="polite" aria-relevant="additions">
        {hasMore ? (
          <div className="mb-3 flex justify-center">
            <button type="button" onClick={loadOlder} disabled={loadingOlder} className="rounded-pill bg-brand-soft px-3 py-1.5 text-[12px] font-medium text-muted">
              {loadingOlder ? t("Yükleniyor…") : t("Daha eski mesajlar")}
            </button>
          </div>
        ) : (
          <div className="mx-auto mb-5 max-w-md px-4 py-2 text-center text-[12px] leading-relaxed text-muted xl:hidden">
            <Icon name="shield" className="mx-auto mb-1 h-4 w-4 text-success" />
            {t("Güvenliğin için: ürünü görmeden ödeme yapma, kapora gönderme ve konuşmayı uygulama içinde tut.")}
          </div>
        )}

        {messages.length === 0 && convo.canSend ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-[14px] text-muted">{t("İlk mesajını gönder. Hazır sorulardan birini de seçebilirsin.")}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {QUICK[convo.role].map((q) => (
                <button key={q} type="button" onClick={() => void send(t(q))} className="rounded-pill border border-border-strong px-3.5 py-2 text-[14px] hover:bg-brand-soft">
                  {t(q)}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <ol className="flex flex-col gap-1">
          {messages.map((m, i) => {
            const mine = m.senderId === me;
            const day = dayKey(m.createdAt);
            const showDay = day !== lastDay;
            lastDay = day;
            const next = messages[i + 1];
            const lastInGroup = !next || next.senderId !== m.senderId || dayKey(next.createdAt) !== day;
            return (
              <Fragment key={m.id}>
                {showDay ? (
                  <li className="my-3 flex justify-center" aria-hidden>
                    <span className="rounded-pill bg-brand-soft px-3 py-1 text-[12px] font-medium text-muted">{dayLabel(m.createdAt, locale, t)}</span>
                  </li>
                ) : null}
                <li className={cn("flex", mine ? "justify-end" : "justify-start", lastInGroup && "mb-2")}>
                  <div
                    className={cn(
                      "max-w-[82%] rounded-[20px] px-4 py-2.5 text-[15px] leading-snug sm:max-w-[64%]",
                      mine ? "bg-brand text-on-brand" : "bg-brand-soft text-text",
                      mine ? (lastInGroup ? "rounded-br-md" : "") : lastInGroup ? "rounded-bl-md" : "",
                      m.pending === "sending" && "opacity-70",
                      m.pending === "failed" && "bg-danger-soft text-text ring-1 ring-danger/40",
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words" translate="no">
                      {m.body}
                    </p>
                    <p className={cn("mt-0.5 flex items-center justify-end gap-1 text-[11px]", mine && !m.pending ? "text-on-brand/65" : "text-muted")}>
                      {m.pending === "failed" ? (
                        <button type="button" onClick={() => void send(m.body, m.id)} className="font-semibold text-danger underline">
                          {t("Gönderilemedi · Tekrar dene")}
                        </button>
                      ) : m.pending === "sending" ? (
                        t("Gönderiliyor…")
                      ) : (
                        <>
                          {formatLocalized("clockTime", [m.createdAt], locale)}
                          {mine ? <span aria-label={t(m.readAt ? "Görüldü" : "Gönderildi")}>{m.readAt ? "✓✓" : "✓"}</span> : null}
                        </>
                      )}
                    </p>
                  </div>
                </li>
              </Fragment>
            );
          })}
        </ol>
      </div>

      {newBelow ? (
        <button
          type="button"
          onClick={() => {
            scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
            setNewBelow(false);
          }}
          className="absolute bottom-24 left-1/2 z-10 -translate-x-1/2 rounded-pill bg-brand px-3.5 py-1.5 text-[13px] font-semibold text-on-brand shadow-md"
        >
          {t("Yeni mesaj")} ↓
        </button>
      ) : null}

      {/* Composer */}
      <div className="border-t border-border px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-10">
        {convo.canSend ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(text);
              composer.current?.focus();
            }}
            className="flex items-end gap-2"
          >
            <label className="sr-only" htmlFor="composer">
              {t("Mesajın")}
            </label>
            <textarea
              id="composer"
              ref={composer}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !coarse && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send(text);
                }
              }}
              rows={1}
              maxLength={LIMITS.messageMax}
              placeholder={t("Mesajını yaz…")}
              className="max-h-[140px] min-h-12 flex-1 resize-none rounded-2xl border border-border-strong bg-surface px-4 py-3 text-[15px] leading-snug focus:border-brand focus:outline-none"
            />
            <button
              type="submit"
              disabled={!text.trim()}
              aria-label={t("Gönder")}
              className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-2xl bg-brand text-on-brand transition disabled:bg-brand-soft disabled:text-subtle"
            >
              <Icon name="send" className="h-5 w-5" />
            </button>
          </form>
        ) : (
          <p className="py-2 text-center text-[13px] text-muted">
            {!convo.other
              ? t("Bu kullanıcı hesabını silmiş; mesaj gönderilemez.")
              : convo.iBlocked
                ? t("Bu kullanıcıyı engelledin. Mesajlaşmak için engeli kaldır.")
                : t("Bu sohbete mesaj gönderilemiyor.")}
          </p>
        )}
      </div>

      </div>

      {/* Context panel (wide screens): what this conversation is about */}
      <aside className="hidden w-[340px] flex-shrink-0 flex-col overflow-y-auto border-l border-border xl:flex" aria-label={t("Sohbet bilgisi")}>
        {convo.listing ? (
          <Link href={`/ilan/${convo.listing.slug}`} className="group block p-5">
            <span className="relative block aspect-[4/3] overflow-hidden rounded-2xl bg-brand-soft">
              <MediaImage urls={convo.listing.image} alt="" max="md" sizes="300px" className="transition duration-500 group-hover:scale-[1.03]" />
              {convo.listing.status !== "active" ? (
                <span className="absolute inset-0 grid place-items-center bg-black/50 text-[12px] font-bold uppercase tracking-[0.12em] text-white">
                  {t(convo.listing.status === "sold" ? "Satıldı" : "Yayında değil")}
                </span>
              ) : null}
            </span>
            <span className="mt-3 block text-[22px] font-bold tracking-tight tabular">{formatLocalized("formatPrice", [convo.listing.price, convo.listing.currency], locale)}</span>
            <span className="mt-0.5 line-clamp-2 block text-[14.5px] group-hover:underline" translate="no">
              {convo.listing.title}
            </span>
          </Link>
        ) : (
          <p className="p-5 text-[14px] text-muted">{t("Bu sohbetin ilanı kaldırılmış.")}</p>
        )}

        <section className="border-t border-border p-5">
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">{t(convo.role === "buyer" ? "Satıcı" : "Alıcı")}</p>
          {convo.other ? (
            <Link href={`/satici/${convo.other.id}`} className="mt-3 flex items-center gap-3">
              <Avatar name={otherName} src={convo.other.avatar} size="md" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold" translate="no">
                  {otherName}
                </span>
                <span className="text-[13px] text-accent">{t("Profili görüntüle")}</span>
              </span>
            </Link>
          ) : (
            <p className="mt-2 text-[14px] text-muted">{otherName}</p>
          )}
        </section>

        <section className="border-t border-border p-5">
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">{t("Buluşma")}</p>
          <ol className="mt-3 space-y-2 text-[14px]">
            {[
              { done: convo.meeting.mine, label: "Sen onayladın" },
              { done: convo.meeting.theirs, label: convo.role === "buyer" ? "Satıcı onayladı" : "Alıcı onayladı" },
              { done: convo.rated, label: "Değerlendirme" },
            ].map((s) => (
              <li key={s.label} className={cn("flex items-center gap-2.5", s.done ? "text-text" : "text-muted")}>
                <span className={cn("grid h-5 w-5 place-items-center rounded-full", s.done ? "bg-success text-white" : "border border-border-strong")}>
                  {s.done ? <Icon name="check" className="h-3 w-3" /> : null}
                </span>
                {t(s.label)}
              </li>
            ))}
          </ol>
          <div className="mt-4 flex flex-col gap-2">
            {canConfirm && convo.other ? (
              <button type="button" onClick={() => setModal("meeting")} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-brand text-[14px] font-semibold text-on-brand">
                <Icon name="handshake" className="h-4 w-4" />
                {t("Buluşmayı onayla")}
              </button>
            ) : null}
            {canRate && !convo.rated && convo.other ? (
              <button type="button" onClick={() => setModal("rating")} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-brand text-[14px] font-semibold text-on-brand">
                <Icon name="star" className="h-4 w-4" />
                {t("Değerlendir")}
              </button>
            ) : null}
            {stage === "none" && !canConfirm ? <p className="text-[13px] text-muted">{t("Buluşup alışverişi tamamladığınızda buradan onaylayın.")}</p> : null}
          </div>
        </section>

        <section className="mt-auto border-t border-border p-5 text-[13px] text-muted">
          <p className="flex items-center gap-2 font-semibold text-text">
            <Icon name="shield" className="h-4 w-4 text-success" />
            {t("Güvenli alışveriş")}
          </p>
          <p className="mt-1.5 leading-relaxed">{t("Ürünü görmeden ödeme yapma, kapora gönderme ve konuşmayı uygulama içinde tut.")}</p>
        </section>
      </aside>

      {/* Options */}
      <Modal title="Sohbet seçenekleri" open={modal === "options"} onClose={() => setModal(null)} size="sm">
        <div className="flex flex-col gap-1">
          {convo.other ? (
            <Link href={`/satici/${convo.other.id}`} className="flex min-h-12 items-center gap-3 rounded-button px-2 text-[15px] hover:bg-brand-soft">
              <Icon name="user" className="h-5 w-5 text-muted" />
              {t("Profili görüntüle")}
            </Link>
          ) : null}
          {convo.other ? (
            <button type="button" onClick={() => void setBlocked(!convo.iBlocked)} className="flex min-h-12 items-center gap-3 rounded-button px-2 text-left text-[15px] hover:bg-brand-soft">
              <Icon name="lock" className="h-5 w-5 text-muted" />
              {t(convo.iBlocked ? "Engeli kaldır" : "Kullanıcıyı engelle")}
            </button>
          ) : null}
          {convo.other ? (
            <ReportDialog
              target={{ kind: "user", id: convo.other.id }}
              signedIn
              label="Kullanıcıyı şikayet et"
              className="flex min-h-12 w-full items-center gap-3 rounded-button px-2 text-left text-[15px] text-danger hover:bg-danger-soft"
            />
          ) : null}
        </div>
      </Modal>

      <Modal
        title="Buluşmayı onayla"
        description="Ürünü görüp alışverişi tamamladıysanız onayla. İkiniz de onaylayınca birbirinizi değerlendirebilirsiniz."
        open={modal === "meeting"}
        onClose={() => setModal(null)}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setModal(null)}>
              {t("Vazgeç")}
            </Button>
            <Button onClick={confirmMeeting}>{t("Evet, buluştuk")}</Button>
          </>
        }
      >
        <p className="text-[14px] text-muted">{t("Onay geri alınamaz ve karşı tarafa bildirilir.")}</p>
      </Modal>

      {modal === "rating" && convo.other ? (
        <RatingDialog
          conversationId={convo.id}
          name={otherName}
          onClose={() => setModal(null)}
          onDone={() => {
            setConvo((c) => ({ ...c, rated: true }));
            patch(convo.id, (c) => ({ ...c, rated: true }));
          }}
        />
      ) : null}
    </div>
  );
}

function RatingDialog({ conversationId, name, onClose, onDone }: { conversationId: string; name: string; onClose: () => void; onDone: () => void }) {
  const { t } = useLocale();
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const labels = ["", "Kötü", "Pek iyi değil", "İdare eder", "İyi", "Harika"];

  return (
    <Modal title={sent ? "Teşekkürler!" : `${name} kullanıcısını değerlendir`} open onClose={onClose} size="sm">
      {sent ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-success-soft text-success">
            <Icon name="check" className="h-7 w-7" />
          </span>
          <p className="text-[14px] text-muted">{t("Değerlendirmen profilinde görünecek ve diğer kullanıcılara yardımcı olacak.")}</p>
          <Button onClick={onClose}>{t("Tamam")}</Button>
        </div>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!score) return setError(t("Bir puan seç."));
            setBusy(true);
            setError("");
            try {
              await api.post(`/conversations/${conversationId}/rating`, { score, comment });
              setSent(true);
              onDone();
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col items-center gap-1">
            <div className="flex gap-1" role="radiogroup" aria-label={t("Puan")}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={score === n}
                  aria-label={t(`${n} yıldız`)}
                  onClick={() => setScore(n)}
                  className={cn("grid h-12 w-12 place-items-center text-[34px] leading-none transition", n <= score ? "text-sand" : "text-border-strong hover:text-sand/60")}
                >
                  ★
                </button>
              ))}
            </div>
            <span className="h-5 text-[13px] font-medium text-muted">{score ? t(labels[score]) : ""}</span>
          </div>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
            {t("Yorum (isteğe bağlı)")}
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={LIMITS.commentMax}
              rows={3}
              placeholder={t("Buluşma nasıl geçti? Ürün anlatıldığı gibi miydi?")}
              className="rounded-field border border-border-strong bg-surface px-3.5 py-2.5 text-[15px] font-normal focus:border-accent focus:outline-none"
            />
          </label>
          {error ? <FormError>{error}</FormError> : null}
          <Button type="submit" full loading={busy}>
            {t("Değerlendirmeyi gönder")}
          </Button>
        </form>
      )}
    </Modal>
  );
}
