"use client";
import * as I18n from "@/components/i18n/Localized";


import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { SelectField, TextareaField } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Icon } from "@/components/icons";
import { reportListing } from "@/lib/actions/listings";

const reasons = [
  "Sahte ya da yanıltıcı ilan",
  "Uygunsuz içerik",
  "Ürün satılmış / yayında değil",
  "Fiyat dışı ödeme talebi",
  "Diğer",
];

export function ReportListingButton({ listingId, loggedIn }: { listingId: string; loggedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();

  function close() {
    setOpen(false);
    setTimeout(() => {
      setSent(false);
      setError("");
    }, 250);
  }

  return (
    <>
      <I18n.button
        type="button"
        onClick={() => {
          if (!loggedIn) router.push(`/giris-gerekli?returnTo=${encodeURIComponent(pathname)}`);
          else setOpen(true);
        }}
        className="inline-flex min-h-11 items-center gap-2 text-[13px] font-medium text-accent"
      >
        <Icon name="flag" className="h-4 w-4" />
        Bu ilanı şikayet et
      </I18n.button>
      <Modal title={sent ? "Şikayet alındı" : "İlanı şikayet et"} open={open} onClose={close}>
        {sent ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Icon name="check" className="h-7 w-7" />
            </span>
            <I18n.p className="text-sm text-muted">Şikayetini aldık. Moderasyon ekibimiz ilanı 24 saat içinde inceleyecek.</I18n.p>
            <Button onClick={close} full={false}>
              Tamam
            </Button>
          </div>
        ) : (
          <I18n.form
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              startTransition(async () => {
                const result = await reportListing(
                  listingId,
                  String(form.get("reason")),
                  String(form.get("detail") ?? ""),
                );
                if (result.error) setError(result.error);
                else setSent(true);
              });
            }}
            className="flex flex-col gap-4"
          >
            <SelectField label="Şikayet nedeni" name="reason" options={reasons} />
            <TextareaField label="Detay (opsiyonel)" name="detail" placeholder="Kısaca açıklar mısın?" maxLength={1000} />
            {error ? <I18n.p className="text-xs text-danger">{error}</I18n.p> : null}
            <Button type="submit" disabled={pending}>
              {pending ? "Gönderiliyor…" : "Şikayeti gönder"}
            </Button>
          </I18n.form>
        )}
      </Modal>
    </>
  );
}
