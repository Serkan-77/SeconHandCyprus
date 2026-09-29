"use client";
import * as I18n from "@/components/i18n/Localized";


import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { SelectField, TextareaField } from "@/components/ui/Field";
import { FormError, FormSuccess } from "@/components/ui/FormError";
import { applySanction } from "@/lib/actions/admin";

export function SanctionButton({ userId, status }: { userId: string; status: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [pending, startTransition] = useTransition();
  const options = ["Uyar", "Geçici kısıtla (7 gün)", "Hesabı askıya al", ...(status !== "active" ? ["Kısıtlamayı kaldır"] : [])];

  return (
    <>
      <I18n.div className="mt-5 flex flex-col gap-3">
        <Button variant="danger" full={false} onClick={() => setOpen(true)}>
          Yaptırım uygula
        </Button>
        {done ? <FormSuccess>{done}</FormSuccess> : null}
      </I18n.div>
      <Modal title="Gerekçeli yaptırım" open={open} onClose={() => setOpen(false)}>
        <I18n.form
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const kind = String(form.get("kind"));
            startTransition(async () => {
              const result = await applySanction(userId, kind, String(form.get("reason") ?? ""));
              if (result.error) setError(result.error);
              else {
                setError("");
                setDone(`${kind} uygulandı; kullanıcıya bildirim gönderildi.`);
                setOpen(false);
              }
            });
          }}
          className="flex flex-col gap-4"
        >
          <SelectField label="Yaptırım türü" name="kind" options={options} />
          <TextareaField label="Gerekçe" name="reason" placeholder="Bu işlemin nedenini kaydet." required minLength={5} />
          {error ? <FormError>{error}</FormError> : null}
          <Button type="submit" variant="danger" disabled={pending}>
            Uygula
          </Button>
        </I18n.form>
      </Modal>
    </>
  );
}
