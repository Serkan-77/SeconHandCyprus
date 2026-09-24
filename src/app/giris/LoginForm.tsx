"use client";

import { useActionState, useState } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { TextLink } from "@/components/ui/TextLink";
import { Icon } from "@/components/icons";
import { FormError } from "@/components/ui/FormError";
import { signIn, signInWithPhone } from "@/lib/actions/auth";

export function LoginForm({ returnTo, linkError }: { returnTo: string; linkError: boolean }) {
  const [mode, setMode] = useState<"email" | "phone">("email");
  const [emailState, emailAction, emailPending] = useActionState(signIn, undefined);
  const [phoneState, phoneAction, phonePending] = useActionState(signInWithPhone, undefined);
  const next = returnTo !== "/" ? `?returnTo=${encodeURIComponent(returnTo)}` : "";

  return (
    <AuthLayout title="Tekrar hoş geldin." backHref="/" backLabel="Keşfetmeye dön">
      <p className="text-sm text-muted">Favorilerin, mesajların ve yeni keşiflerin seni bekliyor.</p>

      {linkError ? (
        <FormError className="mt-5">Bağlantının süresi dolmuş ya da daha önce kullanılmış. Tekrar giriş yap.</FormError>
      ) : null}

      <div className="mt-5 flex gap-0 border-b border-border" role="tablist">
        {(["email", "phone"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={mode === tab}
            onClick={() => setMode(tab)}
            className={
              "flex-1 border-b-2 px-1 py-3 text-xs " +
              (mode === tab ? "border-brand font-semibold text-brand" : "border-transparent text-muted")
            }
          >
            {tab === "email" ? "E-posta" : "Telefon"}
          </button>
        ))}
      </div>

      {mode === "email" ? (
        <form action={emailAction} className="mt-5 flex flex-col gap-5">
          <input type="hidden" name="returnTo" value={returnTo} />
          <Field label="E-posta adresi" type="email" name="email" autoComplete="email" required />
          <Field label="Şifre" type="password" name="password" autoComplete="current-password" required />
          <div className="flex items-center justify-end">
            <TextLink href="/sifre-yenile">Şifremi unuttum</TextLink>
          </div>
          {emailState?.error ? <FormError>{emailState.error}</FormError> : null}
          <Button type="submit" disabled={emailPending}>
            {emailPending ? "Giriş yapılıyor…" : "Giriş yap"}
          </Button>
        </form>
      ) : (
        <form action={phoneAction} className="mt-5 flex flex-col gap-5">
          <Field
            label="Telefon numarası"
            type="tel"
            name="phone"
            placeholder="+90 5xx xxx xx xx"
            autoComplete="tel"
            hint="Hesabına kayıtlı numaraya tek kullanımlık kod gönderilir."
            required
          />
          {phoneState?.error ? <FormError>{phoneState.error}</FormError> : null}
          <Button type="submit" disabled={phonePending}>
            {phonePending ? "Kod gönderiliyor…" : "Giriş kodu gönder"}
          </Button>
        </form>
      )}

      <div className="mt-5 flex items-center gap-2.5 rounded-xl bg-brand-soft p-3.5 text-xs leading-relaxed">
        <Icon name="lock" className="h-[18px] w-[18px] flex-shrink-0 text-accent" />
        Bilgilerin yalnızca hesabın ve iletişimin için kullanılır.
      </div>

      <p className="mt-5 text-center text-sm text-muted">
        Hesabın yok mu? <TextLink href={`/kayit${next}`}>Kayıt ol</TextLink>
      </p>
    </AuthLayout>
  );
}
