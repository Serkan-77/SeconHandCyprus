"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { FavoriteHeart } from "@/components/ListingCard";
import { useToast } from "@/components/ui/Toast";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { api } from "@/lib/api/client";
import { ApiRequestError, errorMessage } from "@/lib/api/errors";
import { formatLocalized } from "@/lib/i18n/format";
import { cn } from "@/lib/cn";

type Props = {
  listingId: string;
  slug: string;
  title: string;
  price: number;
  currency: string;
  active: boolean;
  signedIn: boolean;
  isOwner: boolean;
  conversationId: string | null;
  acceptsWhatsapp: boolean;
};

function useContact({ listingId, slug, signedIn, conversationId }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const signIn = () => router.push(`/giris?returnTo=${encodeURIComponent(`/ilan/${slug}`)}`);

  async function message() {
    if (!signedIn) return signIn();
    if (conversationId) return router.push(`/mesajlar/${conversationId}`);
    setBusy(true);
    try {
      const { id } = await api.post<{ id: string }>("/conversations", { listingId });
      router.push(`/mesajlar/${id}`);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 401) return signIn();
      toast.show(errorMessage(e), { tone: "error" });
      setBusy(false);
    }
  }

  async function whatsapp(title: string, t: (s: string) => string) {
    if (!signedIn) return signIn();
    setBusy(true);
    try {
      const { phone } = await api.get<{ phone: string }>(`/listings/${listingId}/whatsapp`);
      const text = encodeURIComponent(t(`Merhaba, "${title}" ilanınızla ilgileniyorum.`));
      window.open(`https://wa.me/${phone.replace(/^\+/, "").replace(/^0/, "90")}?text=${text}`, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.show(errorMessage(e), { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function share(title: string, t: (s: string) => string) {
    const url = `${window.location.origin}/ilan/${slug}`;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // Cancelled or unsupported: fall back to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.show(t("Bağlantı kopyalandı"));
    } catch {
      toast.show(t("Bağlantı kopyalanamadı"), { tone: "error" });
    }
  }

  return { busy, message, whatsapp, share };
}

/** The main contact block in the sidebar. */
export function ContactActions(props: Props) {
  const { t } = useLocale();
  const c = useContact(props);
  if (props.isOwner) return null;
  if (!props.active) {
    return <p className="rounded-button bg-brand-soft px-4 py-3 text-center text-[14px] font-medium text-muted">{t("Bu ilan artık satışta değil.")}</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      <Button size="lg" full onClick={c.message} loading={c.busy} icon={<Icon name="chat" className="h-5 w-5" />}>
        {t(props.conversationId ? "Sohbete dön" : "Satıcıya mesaj gönder")}
      </Button>
      {props.acceptsWhatsapp ? (
        <Button size="lg" variant="outline" full onClick={() => c.whatsapp(props.title, t)} disabled={c.busy} icon={<Icon name="whatsapp" className="h-5 w-5" />}>
          {t("WhatsApp ile yaz")}
        </Button>
      ) : (
        <p className="text-center text-[12px] text-muted">{t("Satıcı yalnızca uygulama içi mesajla iletişim kuruyor.")}</p>
      )}
      <div className="mt-1 flex gap-2">
        <FavoriteInline id={props.listingId} />
        <Button variant="secondary" className="flex-1" onClick={() => c.share(props.title, t)} icon={<Icon name="share" className="h-4 w-4" />}>
          {t("Paylaş")}
        </Button>
      </div>
    </div>
  );
}

function FavoriteInline({ id }: { id: string }) {
  const { t } = useLocale();
  return (
    <div className="flex flex-1 items-center justify-center gap-2 rounded-button bg-brand-soft">
      <FavoriteHeart id={id} className="!bg-transparent !shadow-none !ring-0" />
      <span className="pr-3 text-[14px] font-semibold">{t("Kaydet")}</span>
    </div>
  );
}

/** Phones: price and the main action stay reachable at the bottom of the screen. */
export function MobileActionBar(props: Props) {
  const { t, locale } = useLocale();
  const c = useContact(props);
  if (props.isOwner || !props.active) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 px-4 pb-[calc(0.625rem+env(safe-area-inset-bottom))] pt-2.5 backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-lg items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] text-muted" translate="no">
            {props.title}
          </p>
          <p className="text-[18px] font-bold leading-tight tabular">{formatLocalized("formatPrice", [props.price, props.currency], locale)}</p>
        </div>
        <FavoriteHeart id={props.listingId} size="lg" className="!bg-brand-soft !shadow-none !ring-0" />
        {props.acceptsWhatsapp ? (
          <button
            type="button"
            onClick={() => c.whatsapp(props.title, t)}
            aria-label={t("WhatsApp ile yaz")}
            className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-full border border-border-strong"
          >
            <Icon name="whatsapp" className="h-5 w-5" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={c.message}
          disabled={c.busy}
          className={cn("flex h-11 flex-shrink-0 items-center gap-2 rounded-button bg-brand px-4 text-[14px] font-semibold text-on-brand", c.busy && "opacity-60")}
        >
          <Icon name="chat" className="h-[18px] w-[18px]" />
          {t(props.conversationId ? "Sohbet" : "Mesaj")}
        </button>
      </div>
    </div>
  );
}
