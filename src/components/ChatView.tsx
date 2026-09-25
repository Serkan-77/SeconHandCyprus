"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button, LinkButton } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { SelectField, TextareaField } from "@/components/ui/Field";
import { FormError } from "@/components/ui/FormError";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { chatTime, clockTime, initials } from "@/lib/format";
import { getBrowserClient } from "@/lib/supabase/client";
import { MEETING_TEXT, meetingActions, meetingStage, type MeetingState } from "@/lib/meeting";
import {
  blockUser,
  confirmMeeting,
  markConversationRead,
  rateUser,
  reportUser,
  sendMessage,
  unblockUser,
} from "@/lib/actions/messages";

export type ChatMessage = { id: string; body: string; sender_id: string; created_at: string; read_at: string | null };

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

function dayLabel(value: string) {
  const d = new Date(value);
  const today = new Date();
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(today) - start(d)) / 86400000);
  if (diff === 0) return "BUGÜN";
  if (diff === 1) return "DÜN";
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }).toLocaleUpperCase("tr-TR");
}

export function ChatView({
  me,
  conversations,
  activeId,
  initialMessages,
  hasRated,
}: {
  me: string;
  conversations: ChatConversation[];
  activeId: string | null;
  initialMessages: ChatMessage[];
  hasRated: boolean;
}) {
  const active = conversations.find((c) => c.id === activeId) ?? null;
  const [messages, setMessages] = useState(initialMessages);
  const [modal, setModal] = useState<ModalKind>(null);
  const [rating, setRating] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingDone, setRatingDone] = useState(hasRated);
  const [ratingSent, setRatingSent] = useState(false);
  const [blocked, setBlocked] = useState(active?.blockedByMe ?? false);
  const [meeting, setMeeting] = useState<MeetingState>(active?.meeting ?? { mine: false, theirs: false });
  const meetingStep = meetingStage(meeting);
  const { canConfirm, canRate } = meetingActions(meeting);
  const [sendError, setSendError] = useState("");
  const [modalError, setModalError] = useState("");
  const [reportSent, setReportSent] = useState(false);
  const [filter, setFilter] = useState("");
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Live updates: new messages from the other side and read receipts.
  useEffect(() => {
    if (!active) return;
    const supabase = getBrowserClient();
    markConversationRead(active.id);
    const channel = supabase
      .channel(`conversation:${active.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${active.id}` },
        (payload: { new: unknown }) => {
          const msg = payload.new as ChatMessage;
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
          if (msg.sender_id !== me) markConversationRead(active.id);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${active.id}` },
        (payload: { new: unknown }) => {
          const msg = payload.new as ChatMessage;
          setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, read_at: msg.read_at } : m)));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [active, me]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const visibleConversations = useMemo(() => {
    const q = filter.trim().toLocaleLowerCase("tr-TR");
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        c.other.name.toLocaleLowerCase("tr-TR").includes(q) || c.listing.title.toLocaleLowerCase("tr-TR").includes(q),
    );
  }, [conversations, filter]);

  function send(text: string) {
    if (!active || !text.trim()) return;
    if (blocked) {
      setSendError(`${active.other.name} kullanıcısını engellediğin için mesajlaşamıyorsun.`);
      return;
    }
    setSendError("");
    startTransition(async () => {
      const result = await sendMessage(active.id, text);
      if (result.message) {
        const msg = result.message;
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        if (inputRef.current) inputRef.current.value = "";
      } else if (result.error === "blocked") {
        setSendError("Mesaj gönderilemedi. Bu kullanıcıyla artık mesajlaşamazsın ya da hesabın kısıtlı.");
      } else {
        setSendError(result.error ?? "Mesaj gönderilemedi.");
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
    <div className="mx-auto max-w-[1328px] px-4 pb-10 sm:px-6">
      <nav aria-label="İçerik yolu" className="hidden py-4 text-[11px] text-muted sm:block">
        <Link href="/">Ana sayfa</Link> <span>/</span> <span className="text-text">Mesajlar</span>
      </nav>

      <div className="mt-4 grid h-[calc(100dvh-220px)] min-h-[560px] grid-cols-1 overflow-hidden rounded-2xl border border-border sm:mt-0 sm:h-[700px] lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className={cn("min-h-0 flex-col border-border bg-surface lg:flex lg:border-r", active ? "hidden" : "flex")}>
          <div className="flex items-center gap-2 px-5 pb-4 pt-6">
            <h1 className="text-xl font-semibold tracking-tight">Mesajlar</h1>
            {unreadTotal ? (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent-soft px-1 text-[10px] text-accent">
                {unreadTotal}
              </span>
            ) : null}
          </div>
          <label className="mx-5 mb-4 flex min-h-[42px] items-center gap-2 rounded-field border border-border px-3.5 text-muted">
            <Icon name="search" className="h-4 w-4" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Konuşma ara"
              aria-label="Konuşmalarda ara"
              className="w-full bg-transparent text-xs text-text outline-none"
            />
          </label>
          <div className="min-h-0 flex-1 overflow-auto">
            {visibleConversations.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-6 py-12 text-center text-xs text-muted">
                <Icon name="chat" className="h-8 w-8" />
                {conversations.length === 0
                  ? "Henüz bir konuşman yok. Beğendiğin bir ilanda “Satıcıya mesaj gönder”e dokun."
                  : "Aramana uyan konuşma yok."}
                {conversations.length === 0 ? (
                  <LinkButton href="/ilanlar" full={false} variant="secondary" className="mt-2">
                    İlanları keşfet
                  </LinkButton>
                ) : null}
              </div>
            ) : (
              visibleConversations.map((c) => (
                <Link
                  key={c.id}
                  href={`/mesajlar?c=${c.id}`}
                  aria-current={active?.id === c.id ? "page" : undefined}
                  className={cn(
                    "flex w-full items-center gap-2.5 border-b border-border px-5 py-5 text-left",
                    active?.id === c.id && "border-l-[3px] border-l-accent bg-bg pl-[17px]",
                  )}
                >
                  <span className="relative">
                    <Avatar initials={initials(c.other.name)} src={c.other.avatarUrl} />
                    {c.unread && c.id !== active?.id ? (
                      <i className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-surface bg-accent" />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <b className="truncate text-[13px]">{c.other.name}</b>
                      <small className="flex-shrink-0 text-[9px] text-muted">{chatTime(c.lastAt)}</small>
                    </span>
                    <strong className="mt-1 block truncate text-[10px] font-medium">{c.listing.title}</strong>
                    <p className={cn("mt-0.5 truncate text-[11px]", c.unread && c.id !== active?.id ? "text-text" : "text-muted")}>
                      {c.lastMessage}
                    </p>
                  </span>
                </Link>
              ))
            )}
          </div>
          <div className="mt-auto flex gap-2.5 p-5 text-[10px] leading-relaxed text-muted">
            <Icon name="shield" className="h-[18px] w-[18px] flex-shrink-0" />
            İletişimini uygulama içinde tutmak, konuşmalarını takip etmeyi kolaylaştırır.
          </div>
        </aside>

        {active ? (
          <section className="flex min-h-0 flex-col bg-surface">
            <div className="flex h-[72px] items-center gap-3 border-b border-border px-4 sm:h-20 sm:px-6">
              <Link href="/mesajlar" aria-label="Konuşmalara dön" className="grid h-10 w-10 place-items-center rounded-full lg:hidden">
                <Icon name="back" className="h-4 w-4" />
              </Link>
              <Link href={`/satici/${active.other.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar initials={initials(active.other.name)} src={active.other.avatarUrl} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{active.other.name}</span>
                  <span className="text-[10px] text-muted">
                    {blocked ? "Engellendi" : active.role === "buyer" ? "Satıcı" : "Alıcı"}
                  </span>
                </span>
              </Link>
              <button
                onClick={() => setModal(blocked ? "unblock" : "options")}
                aria-label="Sohbet seçenekleri"
                className="grid h-10 w-10 place-items-center rounded-full"
              >
                <Icon name="more" className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-3 border-b border-border bg-bg px-4 py-3 sm:px-6">
              <Image
                src={active.listing.image}
                alt={active.listing.title}
                width={43}
                height={43}
                className="h-[43px] w-[43px] rounded-lg object-cover"
              />
              <div className="min-w-0 flex-1">
                <strong className="block truncate text-xs">{active.listing.title}</strong>
                <span className="text-[10px] text-muted">{active.role === "buyer" ? "İlgilendiğin ilan" : "Senin ilanın"}</span>
              </div>
              {active.listing.slug ? (
                <Link href={`/ilan/${active.listing.slug}`} className="text-[11px] font-medium text-accent">
                  İlanı gör
                </Link>
              ) : (
                <span className="text-[11px] text-muted">Yayında değil</span>
              )}
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4 sm:p-7" aria-live="polite">
              <div className="mx-auto flex max-w-[600px] items-center gap-2.5 rounded-xl bg-brand-soft p-3 text-[11px]">
                <Icon name="shield" className="h-4 w-4 flex-shrink-0 text-accent" />
                Ürünü görmeden ödeme yapma. Güvenli ve kalabalık bir yerde buluş.
              </div>
              {messages.map((m, i) => {
                const label = dayLabel(m.created_at);
                const showDay = i === 0 || dayLabel(messages[i - 1].created_at) !== label;
                const mine = m.sender_id === me;
                return (
                  <div key={m.id} className="contents">
                    {showDay ? <p className="text-center text-[11px] text-muted">{label}</p> : null}
                    <div
                      className={cn(
                        "max-w-[85%] whitespace-pre-line break-words rounded-2xl border px-4 py-3 text-[13px] leading-relaxed sm:max-w-[76%]",
                        mine
                          ? "self-end rounded-br-md border-text bg-text text-surface"
                          : "self-start rounded-bl-md border-border bg-bg",
                      )}
                    >
                      {m.body}
                      <small className="mt-1.5 block text-[9px] opacity-65">
                        {clockTime(m.created_at)}
                        {mine ? (m.read_at ? " · Okundu" : " · Gönderildi") : ""}
                      </small>
                    </div>
                  </div>
                );
              })}
              {messages.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted">
                  {active.other.name} ile ilk mesajını gönder. Hazır sorulardan birini de seçebilirsin.
                </p>
              ) : null}
              <div ref={bottomRef} className="mt-auto flex flex-wrap items-center gap-2.5">
                {quickReplies[active.role].map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    disabled={pending}
                    className="min-h-9 rounded-full border border-border px-3.5 text-[10px]"
                  >
                    {q}
                  </button>
                ))}
                {messages.length > 0 ? (
                  <span className="flex flex-wrap items-center gap-2.5 text-[10px]" aria-live="polite">
                    {meetingStep !== "none" ? <span className="text-muted">{MEETING_TEXT[meetingStep]}</span> : null}
                    {canConfirm ? (
                      <button onClick={() => setModal("meeting")} className="font-medium text-accent">
                        Buluşmayı onayla
                      </button>
                    ) : null}
                    {canRate && !ratingDone ? (
                      <button onClick={() => setModal("rating")} className="font-medium text-accent">
                        Değerlendirme bırak
                      </button>
                    ) : null}
                  </span>
                ) : null}
              </div>
            </div>

            {sendError ? (
              <div className="mx-4 mb-3 flex items-center gap-2.5 rounded-xl bg-brand-soft px-4 py-3 text-xs sm:mx-5">
                <Icon name="info" className="h-4 w-4 flex-shrink-0 text-accent" />
                <span className="flex-1">{sendError}</span>
                <button type="button" onClick={() => setSendError("")} aria-label="Kapat" className="flex-shrink-0">
                  <Icon name="close" className="h-4 w-4" />
                </button>
              </div>
            ) : null}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(inputRef.current?.value ?? "");
              }}
              className="flex gap-2.5 border-t border-border p-4 sm:p-5"
            >
              <input
                ref={inputRef}
                placeholder={blocked ? "Bu kullanıcıyı engelledin" : "Mesajını yaz…"}
                aria-label="Mesaj"
                autoComplete="off"
                maxLength={2000}
                className="min-w-0 flex-1 rounded-field border border-border bg-bg px-3.5 py-3 text-base text-text outline-none"
              />
              <Button type="submit" full={false} disabled={pending} icon={<Icon name="send" className="h-4 w-4" />}>
                <span className="hidden sm:inline">Gönder</span>
              </Button>
            </form>
          </section>
        ) : (
          <section className="hidden flex-col items-center justify-center gap-4 bg-surface p-10 text-center lg:flex">
            <span className="flex h-[100px] w-[100px] -rotate-6 items-center justify-center rounded-[35px] bg-brand-soft text-brand">
              <Icon name="chat" className="h-11 w-11 rotate-6" />
            </span>
            <h2 className="text-xl font-semibold">Bir konuşma seç.</h2>
            <p className="max-w-xs text-sm text-muted">Soldaki listeden bir konuşma seçerek mesajlaşmaya devam et.</p>
          </section>
        )}
      </div>

      {active ? (
        <>
          <Modal title="Sohbet seçenekleri" open={modal === "options"} onClose={closeModal}>
            <div className="flex flex-col gap-1">
              <button
                onClick={() => setModal("report")}
                className="flex items-center gap-3 border-b border-border py-4 text-left text-sm"
              >
                <Icon name="flag" className="h-[18px] w-[18px] text-muted" />
                {active.other.name} kullanıcısını şikayet et
              </button>
              <button
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
                {active.other.name} kullanıcısını engelle
              </button>
              {modalError ? <FormError>{modalError}</FormError> : null}
            </div>
          </Modal>

          <Modal title={reportSent ? "Şikayet alındı" : "Kullanıcıyı şikayet et"} open={modal === "report"} onClose={closeModal}>
            {reportSent ? (
              <p className="text-sm text-muted">Teşekkürler. Moderasyon ekibimiz şikayetini 24 saat içinde inceleyecek.</p>
            ) : (
              <form
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
              </form>
            )}
          </Modal>

          <Modal title="Engeli kaldır" open={modal === "unblock"} onClose={closeModal}>
            <p className="text-sm text-muted">
              {active.other.name} kullanıcısının engelini kaldırmak istediğine emin misin? Engeli kaldırdığında tekrar
              mesajlaşabilirsiniz.
            </p>
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
            <p className="text-sm text-muted">
              {active.other.name} ile buluşmayı tamamladığını onaylıyor musun? İkiniz de onayladığınızda kısa bir
              değerlendirme bırakabilirsin.
            </p>
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
                <p className="text-sm text-muted">
                  Değerlendirmen gönderildi ve {active.other.name} kullanıcısının profilinde görünecek.
                </p>
                <Button full={false} onClick={closeModal}>
                  Tamam
                </Button>
              </div>
            ) : (
              <form
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
                <div className="flex justify-center gap-1.5" role="radiogroup" aria-label="Puan">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={rating === n}
                      onClick={() => setRating(n)}
                      aria-label={`${n} yıldız`}
                      className="text-[34px] text-accent"
                    >
                      {n <= rating ? "★" : "☆"}
                    </button>
                  ))}
                </div>
                <TextareaField
                  label="Yorum (opsiyonel)"
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value)}
                  maxLength={500}
                  placeholder="Buluşma nasıl geçti?"
                />
                <p className="text-center text-xs text-muted">
                  Değerlendirmen, kullanıcının profilinde görünür ve gelecekteki alıcılara yardımcı olur.
                </p>
                {modalError ? <FormError>{modalError}</FormError> : null}
                <Button type="submit" disabled={pending}>
                  Değerlendirmeyi gönder
                </Button>
              </form>
            )}
          </Modal>
        </>
      ) : null}
    </div>
  );
}
