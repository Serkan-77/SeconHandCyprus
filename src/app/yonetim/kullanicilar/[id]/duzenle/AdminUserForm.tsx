"use client";

import { useState, useTransition } from "react";
import { Button, LinkButton } from "@/components/ui/Button";
import { Checkbox, Field, TextareaField } from "@/components/ui/Field";
import { FormError, FormSuccess } from "@/components/ui/FormError";
import { Modal } from "@/components/ui/Modal";
import { adminDeleteUser, adminUpdateUser, type AdminUserInput } from "@/lib/actions/admin";
import { regionNames } from "@/lib/regions";

const selectClass =
  "min-h-12 w-full rounded-field border border-border bg-surface px-4 text-base font-normal text-text focus:outline-none";

export function AdminUserForm({
  userId,
  initial,
  isSelf,
  canDelete,
}: {
  userId: string;
  initial: AdminUserInput;
  isSelf: boolean;
  /** Admin accounts must be demoted before they can be deleted. */
  canDelete: boolean;
}) {
  const [accountType, setAccountType] = useState(initial.accountType);
  const [result, setResult] = useState<{ error?: string; ok?: boolean }>({});
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex max-w-[720px] flex-col gap-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const get = (name: string) => String(form.get(name) ?? "");
          startTransition(async () => {
            setResult(
              await adminUpdateUser(userId, {
                name: get("name"),
                region: get("region"),
                bio: get("bio"),
                phone: get("phone"),
                phoneVerified: form.get("phoneVerified") === "on",
                role: get("role") === "admin" ? "admin" : "user",
                accountType,
                store: {
                  storeName: get("storeName"),
                  address: get("storeAddress"),
                  phone: get("storePhone"),
                  website: get("storeWebsite"),
                  hours: get("storeHours"),
                },
                storeVerified: form.get("storeVerified") === "on",
              }),
            );
          });
        }}
        className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5"
      >
        <h2 className="text-sm font-semibold">Profil</h2>
        <Field label="Görünen ad" name="name" defaultValue={initial.name} required minLength={2} maxLength={40} />
        <label className="flex flex-col gap-2 text-[13px] font-semibold text-text">
          Bölge
          <select name="region" defaultValue={initial.region} className={selectClass}>
            <option value="">Belirtilmemiş</option>
            {regionNames.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <TextareaField label="Hakkında" name="bio" defaultValue={initial.bio} maxLength={500} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Telefon (gizli)" name="phone" type="tel" defaultValue={initial.phone} placeholder="+905331234567" />
          <label className="flex flex-col gap-2 text-[13px] font-semibold text-text">
            Rol
            <select name="role" defaultValue={initial.role} disabled={isSelf} className={selectClass}>
              <option value="user">Kullanıcı</option>
              <option value="admin">Yönetici</option>
            </select>
            {isSelf ? <input type="hidden" name="role" value="admin" /> : null}
          </label>
        </div>
        <Checkbox label="Telefon elle incelendi (rozet)" name="phoneVerified" defaultChecked={initial.phoneVerified} />

        <h2 className="mt-3 text-sm font-semibold">Hesap türü</h2>
        <div className="flex gap-2">
          {(["personal", "store"] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={accountType === t}
              onClick={() => setAccountType(t)}
              className={
                accountType === t
                  ? "min-h-10 rounded-button bg-accent px-4 text-xs font-semibold text-on-accent"
                  : "min-h-10 rounded-button border border-border px-4 text-xs"
              }
            >
              {t === "store" ? "Mağaza" : "Bireysel"}
            </button>
          ))}
        </div>
        {accountType === "store" ? (
          <div className="flex flex-col gap-4 rounded-xl bg-bg p-4">
            <Field label="Mağaza adı" name="storeName" defaultValue={initial.store.storeName} required minLength={2} maxLength={60} />
            <Field label="Adres" name="storeAddress" defaultValue={initial.store.address} maxLength={160} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Mağaza telefonu (herkese açık)" name="storePhone" type="tel" defaultValue={initial.store.phone} />
              <Field label="Web sitesi" name="storeWebsite" defaultValue={initial.store.website} maxLength={200} />
            </div>
            <Field label="Çalışma saatleri" name="storeHours" defaultValue={initial.store.hours} maxLength={80} />
            <Checkbox label="Onaylı mağaza (rozet ve yüksek ilan kotası)" name="storeVerified" defaultChecked={initial.storeVerified} />
          </div>
        ) : null}

        {result.error ? <FormError>{result.error}</FormError> : null}
        {result.ok ? <FormSuccess>Kullanıcı bilgileri kaydedildi.</FormSuccess> : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" full={false} disabled={pending} className="sm:min-w-[160px]">
            Kaydet
          </Button>
          <LinkButton href={`/yonetim/kullanicilar/${userId}`} variant="outline" full={false}>
            Kullanıcıya dön
          </LinkButton>
        </div>
      </form>

      {!isSelf ? (
        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold">Hesabı sil</h2>
          <p className="mt-1.5 text-xs text-muted">
            Profil, ilanlar, fotoğraflar, favoriler ve bildirimler kalıcı olarak silinir. Konuşmalar karşı tarafta
            &quot;Silinmiş kullanıcı&quot; olarak kalır; şikayet ve yaptırım kayıtları korunur.
          </p>
          {canDelete ? (
            <Button variant="danger" full={false} className="mt-4" onClick={() => setDeleteOpen(true)}>
              Hesabı kalıcı olarak sil
            </Button>
          ) : (
            <p className="mt-3 text-xs text-muted">Yönetici hesapları silinemez; önce rolünü &quot;Kullanıcı&quot; yap.</p>
          )}
        </section>
      ) : null}

      <Modal title="Hesabı sil" open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <p className="text-sm text-muted">
          <b className="text-text">{initial.name}</b> hesabı ve tüm içeriği kalıcı olarak silinecek. Bu işlem geri alınamaz.
        </p>
        {deleteError ? <FormError>{deleteError}</FormError> : null}
        <div className="flex gap-3">
          <Button variant="outline" full={false} onClick={() => setDeleteOpen(false)}>
            Vazgeç
          </Button>
          <Button
            variant="danger"
            full={false}
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await adminDeleteUser(userId);
                if (r?.error) setDeleteError(r.error);
              })
            }
          >
            Evet, sil
          </Button>
        </div>
      </Modal>
    </div>
  );
}
