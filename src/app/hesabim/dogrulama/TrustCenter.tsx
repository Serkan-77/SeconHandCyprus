"use client";

import { useActionState, useState, useTransition } from "react";
import { Icon, type IconName } from "@/components/icons";
import { Button, LinkButton } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { FormError } from "@/components/ui/FormError";
import { Modal } from "@/components/ui/Modal";
import { requestPhoneVerification } from "@/lib/actions/account";
import { resendEmailVerification } from "@/lib/actions/auth";

function Done({ label = "Doğrulandı" }: { label?: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-accent">
      <Icon name="check" className="h-4 w-4" />
      {label}
    </span>
  );
}

export function TrustCenter({
  email,
  emailVerified,
  phone,
  phoneVerified,
  phoneRequest,
  hasAvatar,
}: {
  email: string;
  emailVerified: boolean;
  phone: string;
  phoneVerified: boolean;
  phoneRequest: { detail: string; status: string } | null;
  hasAvatar: boolean;
}) {
  const [modal, setModal] = useState<"email" | "phone" | null>(null);
  const [emailResult, setEmailResult] = useState<{ error?: string; ok?: boolean }>({});
  const [emailPending, startEmail] = useTransition();
  const [phoneState, phoneAction, phonePending] = useActionState(requestPhoneVerification, undefined);

  const phoneRequested = phoneRequest?.status === "pending" || phoneState?.ok;

  const rows: { icon: IconName; title: string; sub: string; action: React.ReactNode }[] = [
    {
      icon: "mail",
      title: "E-posta adresi",
      sub: email,
      action: emailVerified ? <Done /> : (
        <Button variant="outline" full={false} onClick={() => setModal("email")}>
          Doğrula
        </Button>
      ),
    },
    {
      icon: "phone",
      title: "Telefon numarası",
      sub: phoneVerified ? phone : phoneRequested ? "İnceleniyor" : phoneRequest?.status === "rejected" ? "Son talep reddedildi" : "Doğrulanmadı",
      action: phoneVerified ? <Done /> : phoneRequested ? <Done label="Talep alındı" /> : (
        <Button variant="outline" full={false} onClick={() => setModal("phone")}>
          Doğrula
        </Button>
      ),
    },
    {
      icon: "user",
      title: "Profil fotoğrafı",
      sub: hasAvatar ? "Eklendi" : "Profil fotoğrafı güven oluşturur",
      action: hasAvatar ? <Done label="Tamam" /> : (
        <LinkButton href="/hesabim/duzenle" variant="outline" full={false}>
          Ekle
        </LinkButton>
      ),
    },
  ];

  const done = [emailVerified, phoneVerified, hasAvatar].filter(Boolean).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[30px]">Doğrulama merkezi</h1>
        <p className="mt-2 text-[13px] text-muted">
          Doğrulama rozeti yalnızca telefon ve e-posta doğrulamasını gösterir; kimlik ya da ürün garantisi değildir.
        </p>
      </div>

      <div className="rounded-xl bg-bg p-4">
        <div className="mb-2 flex justify-between text-xs">
          <b>Profil güveni</b>
          <span className="text-muted">{done}/3 adım</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-border">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(done / 3) * 100}%` }} />
        </div>
      </div>

      <div className="flex flex-col gap-0 overflow-hidden rounded-xl border border-border">
        {rows.map((item) => (
          <div key={item.title} className="flex flex-wrap items-center gap-3.5 border-b border-border p-5 last:border-0">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <Icon name={item.icon} className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{item.title}</span>
              <span className="block truncate text-xs text-muted">{item.sub}</span>
            </span>
            {item.action}
          </div>
        ))}
      </div>

      <Modal title="E-postanı doğrula" open={modal === "email"} onClose={() => setModal(null)}>
        {emailResult.ok ? (
          <p className="text-sm text-muted">
            <b className="text-text">{email}</b> adresine yeni bir doğrulama bağlantısı gönderdik. Bağlantıya tıkladıktan
            sonra bu sayfayı yenile.
          </p>
        ) : (
          <div className="flex flex-col gap-5">
            <p className="text-sm text-muted">
              <b className="text-text">{email}</b> adresine bir doğrulama bağlantısı göndereceğiz.
            </p>
            {emailResult.error ? <FormError>{emailResult.error}</FormError> : null}
            <Button
              disabled={emailPending}
              onClick={() =>
                startEmail(async () => {
                  const result = await resendEmailVerification();
                  setEmailResult(result ?? {});
                })
              }
            >
              {emailPending ? "Gönderiliyor…" : "Doğrulama bağlantısı gönder"}
            </Button>
          </div>
        )}
      </Modal>

      <Modal title="Telefonunu doğrula" open={modal === "phone"} onClose={() => setModal(null)}>
        {phoneState?.ok ? (
          <p className="text-sm text-muted">
            Talebin alındı. Ekibimiz numaranı kontrol ettikten sonra doğrulama rozetin profiline eklenecek.
          </p>
        ) : (
          <form action={phoneAction} className="flex flex-col gap-5">
            <Field
              label="Telefon numarası"
              type="tel"
              name="phone"
              defaultValue={phone}
              placeholder="+90 5xx xxx xx xx"
              required
            />
            {phoneState?.error ? <FormError>{phoneState.error}</FormError> : null}
            <Button type="submit" disabled={phonePending}>
              {phonePending ? "Gönderiliyor…" : "Doğrulama talebi gönder"}
            </Button>
          </form>
        )}
      </Modal>
    </div>
  );
}
