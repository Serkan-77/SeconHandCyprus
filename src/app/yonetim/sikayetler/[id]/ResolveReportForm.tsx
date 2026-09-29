"use client";
import * as I18n from "@/components/i18n/Localized";


import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { TextareaField } from "@/components/ui/Field";
import { FormError } from "@/components/ui/FormError";
import { setReportStatus } from "@/lib/actions/admin";

export function ResolveReportForm({ id, status }: { id: string; status: string }) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <I18n.form
      onSubmit={(e) => {
        e.preventDefault();
        const note = String(new FormData(e.currentTarget).get("note") ?? "");
        startTransition(async () => {
          const result = await setReportStatus(id, "resolved", note);
          if (result.error) setError(result.error);
        });
      }}
      className="flex h-max flex-col gap-4 rounded-xl border border-border bg-surface p-5"
    >
      <TextareaField label="Moderasyon notu" name="note" placeholder="Yapılan işlemi kısaca kaydet." required minLength={3} />
      {error ? <FormError>{error}</FormError> : null}
      <Button type="submit" disabled={pending}>
        Çözüldü olarak işaretle
      </Button>
      {status === "pending" ? (
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await setReportStatus(id, "reviewing");
              if (result.error) setError(result.error);
            })
          }
        >
          İncelemeye al
        </Button>
      ) : null}
    </I18n.form>
  );
}
