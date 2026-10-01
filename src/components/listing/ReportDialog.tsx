"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FormError, Notice } from "@/components/ui/FormError";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { api } from "@/lib/api/client";
import { ApiRequestError, errorMessage } from "@/lib/api/errors";
import { REPORT_REASONS } from "@shared/constants";

/** Report a listing or a user. Reasons are fixed; the detail is optional. */
export function ReportDialog({
  target,
  signedIn,
  label = "İlanı şikayet et",
  className,
}: {
  target: { kind: "listing" | "user"; id: string };
  signedIn: boolean;
  label?: string;
  className?: string;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("");
  const [detail, setDetail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) return setError(t("Bir şikayet nedeni seç."));
    setState("sending");
    setError("");
    try {
      await api.post(target.kind === "listing" ? `/listings/${target.id}/report` : `/users/${target.id}/report`, { reason, detail });
      setState("sent");
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 401) return router.push(`/giris?returnTo=${encodeURIComponent(pathname)}`);
      setError(errorMessage(err));
      setState("idle");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => (signedIn ? setOpen(true) : router.push(`/giris?returnTo=${encodeURIComponent(pathname)}`))}
        className={className ?? "inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-danger"}
      >
        <Icon name="flag" className="h-4 w-4" />
        {t(label)}
      </button>
      <Modal
        title={target.kind === "listing" ? "İlanı şikayet et" : "Kullanıcıyı şikayet et"}
        description="Şikayetin ekibimize gider; karşı taraf kimin şikayet ettiğini görmez."
        open={open}
        onClose={() => {
          setOpen(false);
          if (state === "sent") setTimeout(() => setState("idle"), 300);
        }}
      >
        {state === "sent" ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-success-soft text-success">
              <Icon name="check" className="h-6 w-6" />
            </span>
            <p className="font-semibold">{t("Teşekkürler, şikayetin alındı.")}</p>
            <p className="text-[14px] text-muted">{t("Ekibimiz inceleyip gerekirse işlem yapacak.")}</p>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("Kapat")}
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <fieldset>
              <legend className="mb-2 text-[13px] font-semibold">{t("Neden şikayet ediyorsun?")}</legend>
              <div className="space-y-1">
                {REPORT_REASONS.map((r) => (
                  <label key={r} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-button border border-border px-3 text-[14px] has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
                    <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="h-[18px] w-[18px] accent-[var(--accent)]" />
                    {t(r)}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
              {t("Ayrıntı (isteğe bağlı)")}
              <textarea
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder={t("Ne oldu? Örn. ürünü görmeden kapora istedi.")}
                className="rounded-field border border-border-strong bg-surface px-3.5 py-2.5 text-[15px] font-normal focus:border-accent focus:outline-none"
              />
            </label>
            {target.kind === "listing" ? (
              <Notice tone="warning" icon="shield">
                {t("Acil bir dolandırıcılık durumunda polise de başvur. Ödeme yaptıysan bankanı hemen ara.")}
              </Notice>
            ) : null}
            {error ? <FormError>{error}</FormError> : null}
            <Button type="submit" full loading={state === "sending"}>
              {t("Şikayeti gönder")}
            </Button>
          </form>
        )}
      </Modal>
    </>
  );
}
