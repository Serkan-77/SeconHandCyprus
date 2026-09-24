"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { FormError } from "@/components/ui/FormError";
import { signIn, signOut } from "@/lib/actions/auth";

export function AdminLoginForm({ signedInAs, denied }: { signedInAs: string | null; denied: boolean }) {
  const [state, action, pending] = useActionState(signIn, undefined);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-[400px] flex-col justify-center px-4">
      <div className="mb-6 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand text-2xl tracking-[-2px] text-on-brand">
          k.
        </span>
        <span className="text-sm font-semibold">Kıbrıs İkinci El · Yönetim</span>
      </div>

      {signedInAs ? (
        <div className="flex flex-col gap-5 rounded-2xl border border-border p-6">
          <h1 className="text-xl font-semibold">Yetkin yok</h1>
          <FormError>
            <b>{signedInAs}</b> hesabının yönetim paneline erişim yetkisi yok. Yönetici hesabıyla giriş yapmak için önce
            çıkış yap.
          </FormError>
          <form action={signOut}>
            <Button type="submit" variant="outline">
              Çıkış yap
            </Button>
          </form>
        </div>
      ) : (
        <form action={action} className="flex flex-col gap-5 rounded-2xl border border-border p-6">
          <h1 className="text-xl font-semibold">Yönetici girişi</h1>
          <input type="hidden" name="returnTo" value="/yonetim" />
          <Field label="E-posta" type="email" name="email" autoComplete="email" required />
          <Field label="Şifre" type="password" name="password" autoComplete="current-password" required />
          {state?.error ? <FormError>{state.error}</FormError> : null}
          {denied && !state?.error ? <FormError>Bu sayfa yalnızca yöneticiler içindir.</FormError> : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Giriş yapılıyor…" : "Giriş yap"}
          </Button>
          <p className="text-center text-[11px] text-muted">
            Yetki sunucu tarafında doğrulanır; yönetici rolü olmayan hesaplar paneli göremez.
          </p>
        </form>
      )}
    </div>
  );
}
