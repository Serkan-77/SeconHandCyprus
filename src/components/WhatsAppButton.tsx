"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Icon } from "@/components/icons";
import { getListingWhatsapp } from "@/lib/actions/listings";

export function WhatsAppButton({
  listingId,
  listingTitle,
  loggedIn,
}: {
  listingId: string;
  listingTitle: string;
  loggedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();

  function openModal() {
    if (!loggedIn) {
      router.push(`/giris-gerekli?returnTo=${encodeURIComponent(pathname)}`);
      return;
    }
    setOpen(true);
    if (phone || error) return;
    startTransition(async () => {
      const result = await getListingWhatsapp(listingId);
      if (result.phone) setPhone(result.phone.replace(/\D/g, ""));
      else setError(result.error ?? "Numara alınamadı.");
    });
  }

  return (
    <>
      <Button variant="outline" icon={<Icon name="phone" className="h-4 w-4" />} onClick={openModal}>
        WhatsApp ile iletişim
      </Button>
      <Modal title="WhatsApp'a geçiş" open={open} onClose={() => setOpen(false)}>
        {pending ? (
          <p className="text-sm text-muted">Satıcının iletişim tercihi kontrol ediliyor…</p>
        ) : error ? (
          <div className="flex items-start gap-2.5 rounded-xl bg-brand-soft p-4 text-sm">
            <Icon name="info" className="h-4 w-4 flex-shrink-0 text-accent" />
            {error}
          </div>
        ) : (
          <>
            <p className="text-sm text-muted">
              Kıbrıs İkinci El&apos;den ayrılıp satıcıyla WhatsApp üzerinden{" "}
              <b className="text-text">{listingTitle}</b> hakkında konuşacaksın. Ödeme ve buluşma detaylarında
              dikkatli ol.
            </p>
            <a
              href={`https://wa.me/${phone}?text=${encodeURIComponent(`Merhaba, "${listingTitle}" ilanınız hâlâ satılık mı?`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-button bg-brand text-sm font-semibold text-on-brand"
            >
              WhatsApp&apos;ı aç
            </a>
          </>
        )}
      </Modal>
    </>
  );
}
