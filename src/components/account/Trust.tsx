"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { FormError, Notice } from "@/components/ui/FormError";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { formatLocalized } from "@/lib/i18n/format";

type Request = { id: string; kind: string; detail: string; status: "pending" | "approved" | "rejected"; createdAt: string };

export function Trust({ emailVerified, phoneVerified, phone, requests }: { emailVerified: boolean; phoneVerified: boolean; phone: string | null; requests: Request[] }) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const [value, setValue] = useState(phone ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = requests.find((r) => r.status === "pending");

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("Güven ve doğrulama")}</h1>
        <p className="mt-1 text-[14px] text-muted">{t("Profilinde yalnızca gerçekten doğrulanmış bilgiler gösterilir.")}</p>
      </div>
      <ul className="divide-y divide-border rounded-card border border-border">
        <li className="flex items-start gap-3 p-4">
          <Icon name="mail" className="mt-0.5 h-5 w-5 text-muted" />
          <div className="flex-1">
            <p className="font-medium">{t("E-posta adresi")}</p>
            <p className="text-[13px] text-muted">{t("Hesap açarken doğruladığın adres.")}</p>
          </div>
          <span className={emailVerified ? "text-[13px] font-semibold text-success" : "text-[13px] font-semibold text-warning"}>{t(emailVerified ? "Doğrulandı" : "Doğrulanmadı")}</span>
        </li>
        <li className="flex items-start gap-3 p-4">
          <Icon name="phone" className="mt-0.5 h-5 w-5 text-muted" />
          <div className="flex-1">
            <p className="font-medium">{t("Telefon numarası")}</p>
            <p className="text-[13px] text-muted">{t("Ekibimiz numaranın sana ait olduğunu elle inceler. SMS doğrulaması henüz yok.")}</p>
          </div>
          <span className={phoneVerified ? "text-[13px] font-semibold text-success" : "text-[13px] text-muted"}>{t(phoneVerified ? "İncelendi" : pending ? "İncelemede" : "İncelenmedi")}</span>
        </li>
      </ul>

      {!phoneVerified && !pending ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await api.post("/me/verification-requests", { phone: value });
              router.refresh();
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
          className="flex flex-col gap-3 rounded-card border border-border p-5"
        >
          <h2 className="font-semibold">{t("Telefonunu incelet")}</h2>
          <Field label="Telefon" type="tel" inputMode="tel" value={value} onChange={(e) => setValue(e.target.value)} placeholder="+90 533 123 45 67" />
          {error ? <FormError>{error}</FormError> : null}
          <div>
            <Button type="submit" loading={busy}>
              {t("İnceleme talebi gönder")}
            </Button>
          </div>
        </form>
      ) : null}
      {pending ? <Notice icon="clock">{t(`${pending.detail} numarası için talebin incelemede.`)}</Notice> : null}

      {requests.length ? (
        <section>
          <h2 className="mb-2 font-semibold">{t("Geçmiş talepler")}</h2>
          <ul className="divide-y divide-border rounded-card border border-border text-[14px]">
            {requests.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="tabular">{r.detail}</span>
                <span className="text-muted">{formatLocalized("formatDate", [r.createdAt], locale)}</span>
                <span className={r.status === "approved" ? "font-medium text-success" : r.status === "rejected" ? "font-medium text-danger" : "text-muted"}>
                  {t(r.status === "approved" ? "Onaylandı" : r.status === "rejected" ? "Reddedildi" : "Bekliyor")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
