"use client";
import * as I18n from "@/components/i18n/Localized";


import { useActionState } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { Button, LinkButton } from "@/components/ui/Button";
import { Field, Checkbox } from "@/components/ui/Field";
import { TextLink } from "@/components/ui/TextLink";
import { FormError } from "@/components/ui/FormError";
import { Icon } from "@/components/icons";
import { signUp } from "@/lib/actions/auth";
import { GoogleButton, OrDivider } from "@/components/GoogleButton";
import { AUTH_METHODS } from "@/lib/site";
import { ActionForm } from "@/components/ui/ActionForm";

export default function RegisterPage() {
  const [state, action, pending] = useActionState(signUp, undefined);

  if (state?.ok) {
    return (
      <AuthLayout title="E-postanı kontrol et." backHref="/giris" backLabel="Girişe dön">
        <div className="flex flex-col items-center gap-5 py-6 text-center">
          <span className="flex h-[85px] w-[85px] items-center justify-center rounded-full bg-accent-soft text-accent">
            <Icon name="mail" className="h-9 w-9" />
          </span>
          <I18n.p className="max-w-xs text-sm text-muted">
            <I18n.b className="text-text">{state.email}</I18n.b> adresine bir doğrulama bağlantısı gönderdik. Bağlantıya
            tıkladığında hesabın açılacak ve profilini tamamlayabileceksin.
          </I18n.p>
          <LinkButton href="/giris" full={false} variant="outline" className="min-w-[220px]">
            Girişe dön
          </LinkButton>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Adaya hoş geldin." backHref="/" backLabel="Keşfetmeye dön">
      <I18n.p className="text-sm text-muted">Birkaç bilgiyle, sen de ilan verip mesajlaşmaya başla.</I18n.p>
      {AUTH_METHODS.google ? (
        <div className="mt-5 flex flex-col gap-4">
          <GoogleButton returnTo="/kurulum" />
          <OrDivider />
        </div>
      ) : null}

      <ActionForm action={action} className="mt-5 flex flex-col gap-5">
        <Field label="Ad Soyad" name="name" autoComplete="name" defaultValue={state?.values?.name} required minLength={2} />
        <Field label="E-posta adresi" type="email" name="email" autoComplete="email" defaultValue={state?.values?.email} required />
        <Field
          label="Telefon numarası (opsiyonel)"
          type="tel"
          name="phone"
          placeholder="+90 5xx xxx xx xx"
          autoComplete="tel"
          defaultValue={state?.values?.phone}
          hint="Doğrulama rozeti ve WhatsApp iletişimi için kullanılır."
        />
        <Field
          label="Şifre"
          type="password"
          name="password"
          autoComplete="new-password"
          hint="En az 8 karakter kullan."
          minLength={8}
          required
        />

        <div className="flex flex-col gap-3">
          <Checkbox
            required
            name="terms"
            label={
              <I18n.span>
                Okudum ve kabul ediyorum:{" "}
                <TextLink href="/kosullar" className="inline min-h-0">
                  Kullanım koşullarını
                </TextLink>{" "}
                ve{" "}
                <TextLink href="/gizlilik" className="inline min-h-0">
                  gizlilik bildirimini
                </TextLink>
              </I18n.span>
            }
          />
          <Checkbox name="marketing" label="Kampanya ve yeniliklerden e-posta ile haberdar olmak istiyorum." />
        </div>

        {state?.error ? <FormError>{state.error}</FormError> : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Hesap oluşturuluyor…" : "Kayıt ol"}
        </Button>

        <I18n.p className="text-center text-sm text-muted">
          Zaten hesabın var mı? <TextLink href="/giris">Giriş yap</TextLink>
        </I18n.p>
      </ActionForm>
    </AuthLayout>
  );
}
