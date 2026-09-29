"use client";
import * as I18n from "@/components/i18n/Localized";


import { useActionState } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { Button, LinkButton } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { FormError } from "@/components/ui/FormError";
import { Icon } from "@/components/icons";
import { requestPasswordReset } from "@/lib/actions/auth";
import { ActionForm } from "@/components/ui/ActionForm";

export default function ResetPasswordPage() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);

  if (state?.ok) {
    return (
      <AuthLayout title="Bağlantıyı gönderdik." backHref="/giris" backLabel="Girişe dön">
        <div className="flex flex-col items-center gap-5 py-6 text-center">
          <span className="flex h-[85px] w-[85px] items-center justify-center rounded-full bg-accent-soft text-accent">
            <Icon name="mail" className="h-9 w-9" />
          </span>
          <I18n.p className="max-w-xs text-sm text-muted">
            <I18n.b className="text-text">{state.email}</I18n.b> adresi kayıtlıysa, şifre sıfırlama bağlantısı gönderdik. Gelen
            kutunu (ve gereksiz klasörünü) kontrol et.
          </I18n.p>
          <LinkButton href="/giris" full={false} variant="outline" className="min-w-[220px]">
            Girişe dön
          </LinkButton>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Şifreni sıfırla." backHref="/giris" backLabel="Girişe dön">
      <I18n.p className="text-sm text-muted">
        Hesabına kayıtlı e-posta adresini gir, sana bir sıfırlama bağlantısı gönderelim.
      </I18n.p>
      <ActionForm action={action} className="mt-6 flex flex-col gap-5">
        <Field label="E-posta adresi" type="email" name="email" autoComplete="email" defaultValue={state?.email} required />
        {state?.error ? <FormError>{state.error}</FormError> : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Gönderiliyor…" : "Sıfırlama bağlantısı gönder"}
        </Button>
      </ActionForm>
    </AuthLayout>
  );
}
