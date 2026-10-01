"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AttributeDef } from "@shared/attributes";
import { CONDITIONS, LISTING_STATUSES, REGION_NAMES } from "@shared/constants";
import { Button } from "@/components/ui/Button";
import { controlClass } from "@/components/ui/Field";
import { FormError } from "@/components/ui/FormError";
import { useToast } from "@/components/ui/Toast";
import { AttributeFields } from "@/components/sell/AttributeFields";
import { statusLabel } from "@/components/ListingStatusBadge";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import type { Category } from "@/lib/api/types";
import { attributesFor, buildTree, type CategoryNode } from "@/lib/taxonomy";

type Initial = {
  id: string;
  title: string;
  categoryId: number;
  price: number;
  currency: string;
  condition: string;
  city: string;
  district: string | null;
  description: string;
  negotiable: boolean;
  status: string;
  attributes: Record<string, unknown>;
};

export function AdminListingForm({ initial, categories, attributes }: { initial: Initial; categories: Category[]; attributes: AttributeDef[] }) {
  const { t } = useLocale();
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({ ...initial, price: String(initial.price), district: initial.district ?? "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const defs = useMemo(() => attributesFor(categories, attributes, form.categoryId), [categories, attributes, form.categoryId]);
  const options = useMemo(() => {
    const out: { id: number; label: string }[] = [];
    const walk = (nodes: CategoryNode[], depth: number) =>
      nodes.forEach((n) => {
        out.push({ id: n.id, label: `${"— ".repeat(depth)}${n.name}${n.isActive ? "" : " (gizli)"}` });
        walk(n.children, depth + 1);
      });
    walk(buildTree(categories), 0);
    return out;
  }, [categories]);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await api.put(`/admin/listings/${initial.id}`, { ...form, district: form.district });
          toast.show("İlan güncellendi.");
          router.push(`/yonetim/ilanlar/${initial.id}`);
          router.refresh();
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
      className="flex flex-col gap-4 rounded-card border border-border p-5"
    >
      <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
        {t("Başlık")}
        <input value={form.title} onChange={(e) => set({ title: e.target.value })} maxLength={120} className={controlClass} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
          {t("Kategori")}
          <select value={form.categoryId} onChange={(e) => set({ categoryId: Number(e.target.value) })} className={controlClass}>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
          {t("Durum")}
          <select value={form.status} onChange={(e) => set({ status: e.target.value })} className={controlClass}>
            {LISTING_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(statusLabel[s])}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
          {t("Fiyat")}
          <div className="flex gap-2">
            <input value={form.price} onChange={(e) => set({ price: e.target.value })} inputMode="decimal" className={controlClass} />
            <select value={form.currency} onChange={(e) => set({ currency: e.target.value })} className={`${controlClass} w-24`}>
              <option>TL</option>
              <option>€</option>
            </select>
          </div>
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
          {t("Ürün durumu")}
          <select value={form.condition} onChange={(e) => set({ condition: e.target.value })} className={controlClass}>
            {CONDITIONS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
          {t("Bölge")}
          <select value={form.city} onChange={(e) => set({ city: e.target.value })} className={controlClass}>
            {REGION_NAMES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
          {t("Semt")}
          <input value={form.district} onChange={(e) => set({ district: e.target.value })} maxLength={60} className={controlClass} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-[14px]">
        <input type="checkbox" checked={form.negotiable} onChange={(e) => set({ negotiable: e.target.checked })} className="h-[18px] w-[18px] accent-[var(--accent)]" />
        {t("Pazarlığa açık")}
      </label>
      {defs.length ? (
        <div className="rounded-card border border-border p-4">
          <AttributeFields
            defs={defs.map((d) => ({ ...d, required: false }))}
            values={form.attributes}
            onChange={(key, value) =>
              setForm((f) => {
                const next = { ...f.attributes };
                if (value === undefined || value === "" || (Array.isArray(value) && !value.length)) delete next[key];
                else next[key] = value;
                return { ...f, attributes: next };
              })
            }
          />
        </div>
      ) : null}
      <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
        {t("Açıklama")}
        <textarea value={form.description} onChange={(e) => set({ description: e.target.value })} rows={8} maxLength={5000} className={`${controlClass} py-2.5`} />
      </label>
      {error ? <FormError>{error}</FormError> : null}
      <div>
        <Button type="submit" loading={busy}>
          {t("Kaydet")}
        </Button>
      </div>
    </form>
  );
}
