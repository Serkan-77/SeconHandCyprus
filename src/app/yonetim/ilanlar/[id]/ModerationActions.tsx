"use client";
import * as I18n from "@/components/i18n/Localized";


import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { SelectField, TextareaField } from "@/components/ui/Field";
import { FormError, FormSuccess } from "@/components/ui/FormError";
import { Icon } from "@/components/icons";
import { approveListing, rejectListing, setFeatured } from "@/lib/actions/admin";

const rejectReasons = ["Fotoğraflar net değil", "Yanıltıcı bilgi", "Yasaklı ürün", "Yanlış kategori", "Diğer"];

export function ModerationActions({
  id,
  status,
  title,
  slug,
  featured,
}: {
  id: string;
  status: string;
  title: string;
  slug: string;
  featured: boolean;
}) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [pending, startTransition] = useTransition();

  function approve() {
    setError("");
    startTransition(async () => {
      const result = await approveListing(id);
      if (result.error) setError(result.error);
      else setDone(`${title} yayına alındı; satıcıya bildirim gönderildi.`);
    });
  }

  return (
    <I18n.div className="rounded-xl border border-border bg-surface p-5">
      <I18n.h3 className="mb-3 text-sm font-semibold">Karar</I18n.h3>
      {done ? (
        <div className="flex flex-col gap-3">
          <FormSuccess>{done}</FormSuccess>
          <I18n.Link href="/yonetim/ilanlar" className="text-xs font-medium text-accent">
            Sıradaki ilana geç →
          </I18n.Link>
        </div>
      ) : (
        <I18n.div className="flex flex-wrap gap-3">
          {status !== "active" ? (
            <Button full={false} disabled={pending} icon={<Icon name="check" className="h-4 w-4" />} onClick={approve}>
              Onayla ve yayınla
            </Button>
          ) : (
            <I18n.Link href={`/ilan/${slug}`} className="inline-flex min-h-12 items-center text-xs font-medium text-accent">
              Yayındaki ilanı gör
            </I18n.Link>
          )}
          {status !== "rejected" ? (
            <Button full={false} variant="outline" disabled={pending} onClick={() => setRejectOpen(true)}>
              {status === "active" ? "Yayından kaldır" : "Reddet"}
            </Button>
          ) : null}
        </I18n.div>
      )}
      {status === "active" ? (
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4 text-xs">
          <I18n.span className="text-muted">
            {featured ? "Bu ilan vitrinde; listelerde en üstte görünüyor." : "Vitrine eklenen ilanlar listelerde en üstte görünür."}
          </I18n.span>
          <Button
            variant="outline"
            full={false}
            disabled={pending}
            className="min-h-9 text-xs"
            onClick={() =>
              startTransition(async () => {
                const result = await setFeatured(id, !featured);
                if (result.error) setError(result.error);
              })
            }
          >
            {featured ? "Vitrinden çıkar" : "Vitrine ekle"}
          </Button>
        </div>
      ) : null}
      {error ? <FormError className="mt-3">{error}</FormError> : null}

      <Modal title="Gerekçeli ret" open={rejectOpen} onClose={() => setRejectOpen(false)}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            startTransition(async () => {
              const result = await rejectListing(id, String(form.get("reason")), String(form.get("note") ?? ""));
              if (result.error) setError(result.error);
              else setDone(`${title} reddedildi; satıcıya gerekçeyle bildirildi.`);
              setRejectOpen(false);
            });
          }}
          className="flex flex-col gap-4"
        >
          <SelectField label="Ret nedeni" name="reason" options={rejectReasons} />
          <TextareaField label="Satıcıya not (opsiyonel)" name="note" placeholder="Kısaca açıkla." maxLength={500} />
          <Button type="submit" variant="danger" disabled={pending}>
            İlanı reddet
          </Button>
        </form>
      </Modal>
    </I18n.div>
  );
}
