"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { SelectField, TextareaField } from "@/components/ui/Field";
import { FormError, FormSuccess } from "@/components/ui/FormError";
import { Icon } from "@/components/icons";
import { approveListing, rejectListing } from "@/lib/actions/admin";

const rejectReasons = ["Fotoğraflar net değil", "Yanıltıcı bilgi", "Yasaklı ürün", "Yanlış kategori", "Diğer"];

export function ModerationActions({
  id,
  status,
  title,
  slug,
}: {
  id: string;
  status: string;
  title: string;
  slug: string;
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
    <div className="rounded-xl border border-border bg-surface p-5">
      <h3 className="mb-3 text-sm font-semibold">Karar</h3>
      {done ? (
        <div className="flex flex-col gap-3">
          <FormSuccess>{done}</FormSuccess>
          <Link href="/yonetim/ilanlar" className="text-xs font-medium text-accent">
            Sıradaki ilana geç →
          </Link>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {status !== "active" ? (
            <Button full={false} disabled={pending} icon={<Icon name="check" className="h-4 w-4" />} onClick={approve}>
              Onayla ve yayınla
            </Button>
          ) : (
            <Link href={`/ilan/${slug}`} className="inline-flex min-h-12 items-center text-xs font-medium text-accent">
              Yayındaki ilanı gör
            </Link>
          )}
          {status !== "rejected" ? (
            <Button full={false} variant="outline" disabled={pending} onClick={() => setRejectOpen(true)}>
              {status === "active" ? "Yayından kaldır" : "Reddet"}
            </Button>
          ) : null}
        </div>
      )}
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
    </div>
  );
}
