"use client";

import { useActionState, useState, useTransition } from "react";
import { Button, LinkButton } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { FormError, FormSuccess } from "@/components/ui/FormError";
import { Modal } from "@/components/ui/Modal";
import { closeStore, updateStore } from "@/lib/actions/account";

export type StoreValues = { storeName: string; address: string; phone: string; website: string; hours: string };

export function StoreForm({ userId, isStore, initial }: { userId: string; isStore: boolean; initial: StoreValues }) {
  const [state, action, saving] = useActionState(updateStore, undefined);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeError, setCloseError] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <>
      <form action={action} className="flex flex-col gap-4 rounded-2xl border border-border p-5 sm:p-7">
        <Field label="Mağaza adı" name="storeName" defaultValue={initial.storeName} required minLength={2} maxLength={60} placeholder="Örn. Girne Mobilya Evi" />
        <Field label="Adres (opsiyonel)" name="address" defaultValue={initial.address} maxLength={160} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Mağaza telefonu (opsiyonel)"
            name="phone"
            type="tel"
            defaultValue={initial.phone}
            placeholder="+905331234567"
            hint="Mağaza sayfanda herkese açık görünür. Boş bırakırsan gösterilmez."
          />
          <Field label="Web sitesi (opsiyonel)" name="website" defaultValue={initial.website} maxLength={200} placeholder="ornek.com" />
        </div>
        <Field label="Çalışma saatleri (opsiyonel)" name="hours" defaultValue={initial.hours} maxLength={80} placeholder="Hafta içi 09:00–18:00" />
        {state?.error ? <FormError>{state.error}</FormError> : null}
        {state?.ok ? <FormSuccess>Mağaza bilgilerin kaydedildi.</FormSuccess> : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" full={false} disabled={saving} className="sm:min-w-[180px]">
            {isStore ? "Mağaza bilgilerini kaydet" : "Mağaza hesabına geç"}
          </Button>
          {isStore ? (
            <LinkButton href={`/satici/${userId}`} variant="outline" full={false}>
              Mağaza sayfamı gör
            </LinkButton>
          ) : null}
        </div>
      </form>

      {isStore ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-5 text-xs">
          <span className="text-muted">Bireysel hesaba dönersen mağaza bilgilerin ve onay rozetin kaldırılır.</span>
          <Button variant="outline" full={false} className="min-h-10 text-xs" onClick={() => setCloseOpen(true)}>
            Bireysel hesaba dön
          </Button>
        </div>
      ) : null}

      <Modal title="Bireysel hesaba dön" open={closeOpen} onClose={() => setCloseOpen(false)}>
        <p className="text-sm text-muted">
          Mağaza bilgilerin silinecek ve varsa onaylı mağaza rozetin kaldırılacak. İlanların yayında kalır.
        </p>
        {closeError ? <FormError>{closeError}</FormError> : null}
        <div className="flex gap-3">
          <Button variant="outline" full={false} onClick={() => setCloseOpen(false)}>
            Vazgeç
          </Button>
          <Button
            full={false}
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await closeStore();
                if (result.error) setCloseError(result.error);
                else setCloseOpen(false);
              })
            }
          >
            Bireysel hesaba dön
          </Button>
        </div>
      </Modal>
    </>
  );
}
