"use client";
import * as I18n from "@/components/i18n/Localized";


import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Field, SelectField, TextareaField } from "@/components/ui/Field";
import { FormError } from "@/components/ui/FormError";
import { Icon } from "@/components/icons";
import { sendAnnouncement } from "@/lib/actions/admin";

type Draft = { title: string; body: string; audience: string };

export function AnnouncementComposer() {
  const [preview, setPreview] = useState<Draft | null>(null);
  const [sent, setSent] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  if (sent !== null) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-surface py-12 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-accent-soft text-accent">
          <Icon name="check" className="h-7 w-7" />
        </span>
        <I18n.h1 className="text-xl font-semibold">Duyuru gönderildi.</I18n.h1>
        <I18n.p className="text-sm text-muted">{sent} kullanıcının bildirim merkezine iletildi.</I18n.p>
        <Button
          full={false}
          onClick={() => {
            setSent(null);
            setPreview(null);
          }}
          className="min-w-[200px]"
        >
          Yeni duyuru oluştur
        </Button>
      </div>
    );
  }

  if (preview) {
    return (
      <I18n.div className="flex flex-col gap-4">
        <I18n.h1 className="text-2xl font-semibold tracking-tight sm:text-[27px]">Duyuru gönderim onayı</I18n.h1>
        <div className="rounded-xl border border-border bg-surface p-5">
          <I18n.span className="text-[10px] text-muted">{preview.audience}</I18n.span>
          <I18n.h2 className="mt-1.5 text-base font-semibold">{preview.title}</I18n.h2>
          <I18n.p className="mt-2 whitespace-pre-line text-xs text-muted">{preview.body}</I18n.p>
        </div>
        {error ? <FormError>{error}</FormError> : null}
        <div className="flex gap-3">
          <Button variant="outline" full={false} onClick={() => setPreview(null)}>
            Düzenlemeye dön
          </Button>
          <Button
            full={false}
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await sendAnnouncement(preview.audience, preview.title, preview.body);
                if (result.error) setError(result.error);
                else setSent(result.count ?? 0);
              })
            }
          >
            {pending ? "Gönderiliyor…" : "Duyuruyu gönder"}
          </Button>
        </div>
      </I18n.div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <I18n.h1 className="text-2xl font-semibold tracking-tight sm:text-[27px]">Duyuru oluştur</I18n.h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          setError("");
          setPreview({
            title: String(form.get("title") ?? ""),
            body: String(form.get("body") ?? ""),
            audience: String(form.get("audience") ?? ""),
          });
        }}
        className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5"
      >
        <SelectField label="Kitle" name="audience" options={["Tüm kullanıcılar", "Aktif satıcılar", "Yeni kullanıcılar"]} />
        <Field label="Başlık" name="title" required maxLength={100} />
        <TextareaField label="Mesaj" name="body" required maxLength={600} />
        <Button type="submit">Önizle</Button>
      </form>
    </div>
  );
}
