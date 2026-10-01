"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { useToast } from "@/components/ui/Toast";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";

export function ResolveReport({ id, status }: { id: string; status: string }) {
  const { t } = useLocale();
  const router = useRouter();
  const toast = useToast();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  async function set(next: "reviewing" | "resolved") {
    setBusy(next);
    setError("");
    try {
      await api.post(`/admin/reports/${id}/status`, { status: next, note });
      toast.show(next === "resolved" ? "Şikayet çözüldü olarak kapatıldı." : "İncelemeye alındı.");
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }
  if (status === "resolved") return null;
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
        {t("Çözüm notu (yalnızca yöneticiler görür)")}
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} className="rounded-field border border-border-strong bg-surface px-3 py-2 text-[14px] font-normal" />
      </label>
      {error ? <FormError>{error}</FormError> : null}
      <div className="flex flex-wrap gap-2">
        {status === "pending" ? (
          <Button variant="outline" loading={busy === "reviewing"} onClick={() => set("reviewing")}>
            {t("İncelemeye al")}
          </Button>
        ) : null}
        <Button loading={busy === "resolved"} onClick={() => set("resolved")}>
          {t("Çözüldü olarak kapat")}
        </Button>
      </div>
    </div>
  );
}
