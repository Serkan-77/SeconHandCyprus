"use client";
import * as I18n from "@/components/i18n/Localized";


import { useActionState } from "react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { FormError } from "@/components/ui/FormError";
import { TextLink } from "@/components/ui/TextLink";
import { signIn, signOut } from "@/lib/actions/auth";
import { ActionForm } from "@/components/ui/ActionForm";

export function AdminLoginForm({ signedInAs, denied }: { signedInAs: string | null; denied: boolean }) {
  const [state, action, pending] = useActionState(signIn, undefined);

  return (
    <I18n.div className="mx-auto flex min-h-[70vh] max-w-[400px] flex-col justify-center px-4">
      <div className="mb-6 flex flex-col items-start gap-2">
        <Logo />
        <I18n.span className="text-xs font-semibold tracking-[1.5px] text-muted">YÖNETİM</I18n.span>
      </div>

      {signedInAs ? (
        <div className="flex flex-col gap-5 rounded-2xl border border-border p-6">
          <I18n.h1 className="text-xl font-semibold">Yetkin yok</I18n.h1>
          <FormError>
            <I18n.b>{signedInAs}</I18n.b> hesabının yönetim paneline erişim yetkisi yok. Yönetici hesabıyla giriş yapmak için önce
            çıkış yap.
          </FormError>
          <form action={signOut}>
            <Button type="submit" variant="outline">
              Çıkış yap
            </Button>
          </form>
        </div>
      ) : (
        <ActionForm action={action} className="flex flex-col gap-5 rounded-2xl border border-border p-6">
          <I18n.h1 className="text-xl font-semibold">Yönetici girişi</I18n.h1>
          <input type="hidden" name="returnTo" value="/yonetim" />
          <Field label="E-posta" type="email" name="email" autoComplete="email" defaultValue={state?.email} required />
          <Field label="Şifre" type="password" name="password" autoComplete="current-password" required />
          <div className="flex justify-end">
            <TextLink href="/sifre-yenile">Şifremi unuttum</TextLink>
          </div>
          {state?.error ? <FormError>{state.error}</FormError> : null}
          {denied && !state?.error ? <FormError>Bu sayfa yalnızca yöneticiler içindir.</FormError> : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Giriş yapılıyor…" : "Giriş yap"}
          </Button>
          <I18n.p className="text-center text-[11px] text-muted">
            Yetki sunucu tarafında doğrulanır; yönetici rolü olmayan hesaplar paneli göremez.
          </I18n.p>
        </ActionForm>
      )}
    </I18n.div>
  );
}
