"use client";

import { useActionState } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { Button, LinkButton } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { FormError } from "@/components/ui/FormError";
import { Icon } from "@/components/icons";
import { updatePassword } from "@/lib/actions/auth";

export function NewPasswordForm({ valid }: { valid: boolean }) {
  const [state, action, pending] = useActionState(updatePassword, undefined);

  if (!valid) {
    return (
      <AuthLayout title="Bağlantı geçersiz ya da süresi dolmuş." backHref="/sifre-yenile" backLabel="Yeniden dene">
        <div className="flex flex-col items-center gap-5 py-6 text-center">
          <span className="flex h-[85px] w-[85px] items-center justify-center rounded-full bg-brand-soft text-brand">
            <Icon name="clock" className="h-9 w-9" />
          </span>
          <p className="max-w-xs text-sm text-muted">
            Bu şifre sıfırlama bağlantısının süresi dolmuş ya da daha önce kullanılmış. Yeni bir bağlantı isteyebilirsin.
          </p>
          <LinkButton href="/sifre-yenile" full={false} className="min-w-[220px]">
            Yeni bağlantı iste
          </LinkButton>
        </div>
      </AuthLayout>
    );
  }

  if (state?.ok) {
    return (
      <AuthLayout title="Şifren güncellendi." backHref="/" backLabel="Ana sayfa">
        <div className="flex flex-col items-center gap-5 py-6 text-center">
          <span className="flex h-[85px] w-[85px] items-center justify-center rounded-full bg-accent-soft text-accent">
            <Icon name="check" className="h-9 w-9" />
          </span>
          <p className="max-w-xs text-sm text-muted">Yeni şifren kaydedildi. Hesabınla devam edebilirsin.</p>
          <LinkButton href="/hesabim" full={false} className="min-w-[220px]">
            Hesabıma git
          </LinkButton>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Yeni şifre belirle." backHref="/giris" backLabel="Girişe dön">
      <p className="text-sm text-muted">Hesabın için yeni ve güvenli bir şifre oluştur.</p>
      <form action={action} className="mt-6 flex flex-col gap-5">
        <Field
          label="Yeni şifre"
          type="password"
          name="password"
          autoComplete="new-password"
          hint="En az 8 karakter kullan."
          minLength={8}
          required
        />
        <Field label="Yeni şifre (tekrar)" type="password" name="password2" autoComplete="new-password" required />
        {state?.error ? <FormError>{state.error}</FormError> : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Kaydediliyor…" : "Şifreyi güncelle"}
        </Button>
      </form>
    </AuthLayout>
  );
}
