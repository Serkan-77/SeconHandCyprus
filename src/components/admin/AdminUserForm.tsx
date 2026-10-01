"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, controlClass } from "@/components/ui/Field";
import { FormError } from "@/components/ui/FormError";
import { useToast } from "@/components/ui/Toast";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { REGION_NAMES } from "@shared/constants";

export type AdminUserInput = {
  name: string;
  region: string;
  bio: string;
  phone: string;
  phoneVerified: boolean;
  role: "user" | "admin";
  accountType: "personal" | "store";
  store: { storeName: string; address: string; phone: string; website: string; hours: string };
  storeVerified: boolean;
};

export function AdminUserForm({ id, initial }: { id: string; initial: AdminUserInput }) {
  const { t } = useLocale();
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (patch: Partial<AdminUserInput>) => setForm((f) => ({ ...f, ...patch }));
  const setStore = (patch: Partial<AdminUserInput["store"]>) => setForm((f) => ({ ...f, store: { ...f.store, ...patch } }));

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await api.put(`/admin/users/${id}`, form);
          toast.show("Kullanıcı güncellendi.");
          router.push(`/yonetim/kullanicilar/${id}`);
          router.refresh();
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
      className="flex flex-col gap-4 rounded-card border border-border p-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Görünen ad" value={form.name} onChange={(e) => set({ name: e.target.value })} />
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
          {t("Bölge")}
          <select value={form.region} onChange={(e) => set({ region: e.target.value })} className={controlClass}>
            <option value="">—</option>
            {REGION_NAMES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <Field label="Telefon" value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
        <label className="flex items-center gap-2 pt-6 text-[14px]">
          <input type="checkbox" checked={form.phoneVerified} onChange={(e) => set({ phoneVerified: e.target.checked })} className="h-[18px] w-[18px] accent-[var(--accent)]" />
          {t("Telefon incelendi")}
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
          {t("Rol")}
          <select value={form.role} onChange={(e) => set({ role: e.target.value as "user" | "admin" })} className={controlClass}>
            <option value="user">{t("Kullanıcı")}</option>
            <option value="admin">{t("Yönetici")}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
          {t("Hesap türü")}
          <select value={form.accountType} onChange={(e) => set({ accountType: e.target.value as "personal" | "store" })} className={controlClass}>
            <option value="personal">{t("Bireysel")}</option>
            <option value="store">{t("Mağaza")}</option>
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
        {t("Hakkında")}
        <textarea value={form.bio} onChange={(e) => set({ bio: e.target.value })} rows={3} maxLength={500} className={`${controlClass} py-2`} />
      </label>
      {form.accountType === "store" ? (
        <fieldset className="grid gap-4 rounded-card border border-border p-4 sm:grid-cols-2">
          <legend className="px-1 text-[13px] font-semibold">{t("Mağaza")}</legend>
          <Field label="Mağaza adı" value={form.store.storeName} onChange={(e) => setStore({ storeName: e.target.value })} />
          <Field label="Adres" value={form.store.address} onChange={(e) => setStore({ address: e.target.value })} />
          <Field label="İşletme telefonu" value={form.store.phone} onChange={(e) => setStore({ phone: e.target.value })} />
          <Field label="Web sitesi" value={form.store.website} onChange={(e) => setStore({ website: e.target.value })} />
          <Field label="Çalışma saatleri" value={form.store.hours} onChange={(e) => setStore({ hours: e.target.value })} />
          <label className="flex items-center gap-2 pt-6 text-[14px]">
            <input type="checkbox" checked={form.storeVerified} onChange={(e) => set({ storeVerified: e.target.checked })} className="h-[18px] w-[18px] accent-[var(--accent)]" />
            {t("Doğrulanmış mağaza")}
          </label>
        </fieldset>
      ) : null}
      {error ? <FormError>{error}</FormError> : null}
      <div>
        <Button type="submit" loading={busy}>
          {t("Kaydet")}
        </Button>
      </div>
    </form>
  );
}
