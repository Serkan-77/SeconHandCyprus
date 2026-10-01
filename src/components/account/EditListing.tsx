"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { validateAttributes, type AttributeDef } from "@shared/attributes";
import { CONDITIONS, CONDITION_INFO, LIMITS, REGION_NAMES, type Condition } from "@shared/constants";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { controlClass } from "@/components/ui/Field";
import { FormError, Notice } from "@/components/ui/FormError";
import { useToast } from "@/components/ui/Toast";
import { ListingStatusBadge } from "@/components/ListingStatusBadge";
import { AttributeFields } from "@/components/sell/AttributeFields";
import { PhotoManager } from "@/components/sell/PhotoManager";
import { normalizePrice } from "@/components/sell/SellWizard";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { api } from "@/lib/api/client";
import { ApiRequestError, errorMessage } from "@/lib/api/errors";
import type { ImageUrls, ListingStatus } from "@/lib/api/types";
import { cn } from "@/lib/cn";

type Editable = {
  id: string;
  slug: string;
  status: ListingStatus;
  title: string;
  price: number;
  currency: string;
  condition: string;
  city: string;
  district: string | null;
  description: string;
  negotiable: boolean;
  attributes: Record<string, unknown>;
  rejectReason: string | null;
  categoryPath: { name: string; nameEn: string | null }[];
  images: { id: string; key: string; urls: ImageUrls | null }[];
};

export function EditListing({ listing, defs }: { listing: Editable; defs: AttributeDef[] }) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const toast = useToast();
  const [images, setImages] = useState(listing.images);
  const [form, setForm] = useState({
    title: listing.title,
    price: String(listing.price).replace(".", ","),
    currency: listing.currency as "TL" | "€",
    condition: listing.condition,
    city: listing.city,
    district: listing.district ?? "",
    description: listing.description,
    negotiable: listing.negotiable,
    attributes: listing.attributes,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const photos = useMemo(() => images.filter((i) => i.urls).map((i) => ({ key: i.key, urls: i.urls! })), [images]);

  async function reloadImages() {
    const { listing: fresh } = await api.get<{ listing: Editable }>(`/me/listings/${listing.id}`);
    setImages(fresh.images);
  }

  async function onPhotos(next: { key: string; urls: ImageUrls }[]) {
    const byKey = new Map(images.map((i) => [i.key, i]));
    const added = next.filter((p) => !byKey.has(p.key)).map((p) => p.key);
    const nextKeys = new Set(next.map((p) => p.key));
    const removed = images.filter((i) => !nextKeys.has(i.key));
    setPhotoBusy(true);
    try {
      let review = false;
      for (const img of removed) {
        const r = await api.del<{ review?: boolean }>(`/listings/${listing.id}/images/${img.id}`);
        review ||= Boolean(r.review);
      }
      if (added.length) {
        const r = await api.post<{ review?: boolean }>(`/listings/${listing.id}/images`, { keys: added });
        review ||= Boolean(r.review);
      }
      if (!added.length && !removed.length) {
        const ids = next.map((p) => byKey.get(p.key)!.id);
        await api.put(`/listings/${listing.id}/images/order`, { ids });
        setImages(next.map((p) => byKey.get(p.key)!));
      } else {
        await reloadImages();
      }
      if (review) toast.show("Fotoğraf değişikliği nedeniyle ilan yeniden incelemeye alındı.");
      router.refresh();
    } catch (e) {
      toast.show(errorMessage(e), { tone: "error" });
      await reloadImages().catch(() => {});
    } finally {
      setPhotoBusy(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (form.title.trim().length < LIMITS.titleMin) errs.title = t("Başlık en az 3 karakter olmalı.");
    const { errors: attrErrors, values } = validateAttributes(defs, form.attributes);
    for (const [k, v] of Object.entries(attrErrors)) errs[`attr.${k}`] = t(v);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    setError("");
    try {
      const r = await api.patch<{ review: boolean; slug: string }>(`/listings/${listing.id}`, {
        title: form.title.trim(),
        price: normalizePrice(form.price),
        currency: form.currency,
        condition: form.condition,
        city: form.city,
        district: form.district.trim(),
        description: form.description.trim(),
        negotiable: form.negotiable,
        attributes: values,
      });
      toast.show(r.review ? "Kaydedildi. İçerik değiştiği için ilan kısa bir incelemeden geçecek." : "Değişiklikler kaydedildi.");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiRequestError && err.fields) {
        setErrors(Object.fromEntries(Object.entries(err.fields).map(([k, v]) => [k.startsWith("attributes.") ? `attr.${k.slice(11)}` : k, v])));
      }
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const attrErrors = Object.fromEntries(Object.entries(errors).filter(([k]) => k.startsWith("attr.")).map(([k, v]) => [k.slice(5), v]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/hesabim/ilanlar" className="inline-flex items-center gap-1 text-[13px] font-medium text-muted hover:text-text">
          <Icon name="back" className="h-3.5 w-3.5" />
          {t("İlanlarım")}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{t("İlanı düzenle")}</h1>
          <ListingStatusBadge status={listing.status} />
        </div>
        <p className="mt-1 text-[14px] text-muted">
          {listing.categoryPath.map((c) => (locale === "en" && c.nameEn ? c.nameEn : c.name)).join(" › ")} ·{" "}
          <Link href={`/ilan/${listing.slug}`} className="font-medium text-accent hover:underline">
            {t("İlanı görüntüle")}
          </Link>
        </p>
      </div>

      {listing.status === "rejected" && listing.rejectReason ? (
        <Notice tone="danger">
          <p className="font-semibold">{t("Bu ilan yayınlanamadı.")}</p>
          <p className="mt-1">
            {t("Gerekçe:")} <span translate="no">{listing.rejectReason}</span>
          </p>
          <p className="mt-1">{t("Düzeltip kaydettikten sonra İlanlarım sayfasından tekrar incelemeye gönderebilirsin.")}</p>
        </Notice>
      ) : listing.status === "active" ? (
        <Notice icon="info">{t("Fiyat değişiklikleri hemen yayına girer. Başlık, açıklama, özellik ya da fotoğraf değişikliği ilanı kısa bir incelemeye gönderir.")}</Notice>
      ) : null}

      <section aria-labelledby="photos" className={cn(photoBusy && "pointer-events-none opacity-70")}>
        <h2 id="photos" className="mb-3 font-semibold">
          {t("Fotoğraflar")}
        </h2>
        <PhotoManager photos={photos} onChange={onPhotos} />
      </section>

      <form onSubmit={save} className="flex flex-col gap-5" noValidate>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="title" className="text-[13px] font-semibold">
            {t("Başlık")}
          </label>
          <input id="title" value={form.title} onChange={(e) => set({ title: e.target.value })} maxLength={LIMITS.titleMax} aria-invalid={Boolean(errors.title)} className={controlClass} />
          {errors.title ? <p className="text-[12px] font-medium text-danger">{errors.title}</p> : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="price" className="text-[13px] font-semibold">
              {t("Fiyat")}
            </label>
            <input id="price" inputMode="decimal" value={form.price} onChange={(e) => set({ price: e.target.value.replace(/[^\d.,]/g, "") })} className={cn(controlClass, "font-semibold tabular")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold">{t("Para birimi")}</span>
            <div className="flex h-11 gap-1 rounded-field border border-border-strong p-1">
              {(["TL", "€"] as const).map((c) => (
                <button key={c} type="button" aria-pressed={form.currency === c} onClick={() => set({ currency: c })} className={cn("min-w-14 rounded-[7px] px-3 font-semibold", form.currency === c ? "bg-brand text-on-brand" : "hover:bg-brand-soft")}>
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
        <label className="-mt-2 flex items-center gap-2.5 text-[14px]">
          <input type="checkbox" checked={form.negotiable} onChange={(e) => set({ negotiable: e.target.checked })} className="h-[18px] w-[18px] accent-[var(--accent)]" />
          {t("Pazarlığa açığım")}
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="condition" className="text-[13px] font-semibold">
              {t("Durum")}
            </label>
            <select id="condition" value={form.condition} onChange={(e) => set({ condition: e.target.value })} className={controlClass}>
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {locale === "en" ? CONDITION_INFO[c as Condition].en : c}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="city" className="text-[13px] font-semibold">
              {t("Bölge")}
            </label>
            <select id="city" value={form.city} onChange={(e) => set({ city: e.target.value })} className={controlClass}>
              {REGION_NAMES.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="district" className="text-[13px] font-semibold">
              {t("Semt / köy")}
            </label>
            <input id="district" value={form.district} onChange={(e) => set({ district: e.target.value })} maxLength={LIMITS.districtMax} className={controlClass} />
          </div>
        </div>
        {defs.length ? (
          <div className="rounded-card border border-border p-4">
            <h2 className="mb-4 font-semibold">{t("Özellikler")}</h2>
            <AttributeFields
              defs={defs}
              values={form.attributes}
              errors={attrErrors}
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
        <div className="flex flex-col gap-1.5">
          <label htmlFor="description" className="text-[13px] font-semibold">
            {t("Açıklama")}
          </label>
          <textarea id="description" value={form.description} onChange={(e) => set({ description: e.target.value })} rows={7} maxLength={LIMITS.descriptionMax} className={cn(controlClass, "min-h-40 resize-y py-2.5 leading-relaxed")} />
          <p className="text-right text-[12px] text-muted tabular">
            {form.description.length}/{LIMITS.descriptionMax}
          </p>
        </div>
        {error ? <FormError>{error}</FormError> : null}
        <div className="sticky bottom-[calc(72px+env(safe-area-inset-bottom))] flex justify-end gap-2 border-t border-border bg-surface/95 py-3 backdrop-blur lg:bottom-0">
          <Button type="submit" loading={saving}>
            {t("Değişiklikleri kaydet")}
          </Button>
        </div>
      </form>
    </div>
  );
}
