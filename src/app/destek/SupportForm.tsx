"use client";
import * as I18n from "@/components/i18n/Localized";


import { useActionState } from "react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Button, LinkButton } from "@/components/ui/Button";
import { Field, SelectField, TextareaField } from "@/components/ui/Field";
import { FormError } from "@/components/ui/FormError";
import { Icon } from "@/components/icons";
import { createSupportTicket } from "@/lib/actions/account";
import { ActionForm } from "@/components/ui/ActionForm";

const topics = ["İlan sorunu", "Hesap ve doğrulama", "Şikayet ve güvenlik", "Kısıtlamaya itiraz", "Diğer"];

export function SupportForm({ defaultEmail }: { defaultEmail: string }) {
  const [state, action, pending] = useActionState(createSupportTicket, undefined);

  if (state?.ok) {
    return (
      <div className="mx-auto flex max-w-[500px] flex-col items-center gap-5 px-4 py-20 text-center">
        <span className="grid h-[85px] w-[85px] place-items-center rounded-full bg-accent-soft text-accent">
          <Icon name="check" className="h-9 w-9" />
        </span>
        <I18n.h1 className="text-2xl font-semibold">Destek talebin alındı.</I18n.h1>
        <I18n.p className="max-w-xs text-sm text-muted">Ekibimiz genellikle 24 saat içinde e-posta ile dönüş yapıyor.</I18n.p>
        <LinkButton href="/" full={false} className="min-w-[200px]">
          Ana sayfaya dön
        </LinkButton>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[640px] px-4 pb-16 sm:px-6">
      <Breadcrumbs items={["Destek talebi"]} />
      <I18n.h1 className="mb-2 text-2xl font-semibold tracking-tight sm:text-[32px]">Destek talebi oluştur</I18n.h1>
      <I18n.p className="mb-6 text-[13px] text-muted">Sana en hızlı şekilde dönüş yapabilmemiz için birkaç detay paylaş.</I18n.p>
      <ActionForm action={action} className="flex flex-col gap-5 rounded-2xl border border-border p-6">
        <SelectField label="Konu" name="topic" options={topics} />
        <Field label="E-posta adresin" type="email" name="email" defaultValue={defaultEmail} required />
        <TextareaField
          label="Mesajın"
          name="message"
          placeholder="Yaşadığın sorunu kısaca anlat. İlgili ilan numarası varsa ekle."
          required
          minLength={10}
          maxLength={3000}
        />
        {/* Honeypot (P1-07): hidden from people, filled in by form bots. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <I18n.label>
            Web sitesi
            <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
          </I18n.label>
        </div>
        {state?.error ? <FormError>{state.error}</FormError> : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Gönderiliyor…" : "Talebi gönder"}
        </Button>
      </ActionForm>
    </div>
  );
}
