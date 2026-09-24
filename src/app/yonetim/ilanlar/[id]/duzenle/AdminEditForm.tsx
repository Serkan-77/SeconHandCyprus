"use client";

import { useState, useTransition } from "react";
import { Button, LinkButton } from "@/components/ui/Button";
import { Field, TextareaField } from "@/components/ui/Field";
import { FormError, FormSuccess } from "@/components/ui/FormError";
import { adminUpdateListing } from "@/lib/actions/admin";

export function AdminEditForm({
  listing,
  categories,
}: {
  listing: { id: string; title: string; categoryId: number; price: string; currency: string; description: string };
  categories: { id: number; name: string }[];
}) {
  const [result, setResult] = useState<{ error?: string; ok?: boolean }>({});
  const [pending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        startTransition(async () => {
          setResult(
            await adminUpdateListing(listing.id, {
              title: String(form.get("title")),
              categoryId: Number(form.get("category")),
              price: String(form.get("price")),
              description: String(form.get("description") ?? ""),
            }),
          );
        });
      }}
      className="flex max-w-[560px] flex-col gap-4 rounded-xl border border-border bg-surface p-5"
    >
      <Field label="Başlık" name="title" defaultValue={listing.title} required minLength={3} maxLength={120} />
      <label className="flex flex-col gap-2 text-[13px] font-semibold text-text">
        Kategori
        <select
          name="category"
          defaultValue={listing.categoryId}
          className="min-h-12 w-full rounded-field border border-border bg-surface px-4 text-base font-normal text-text"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <Field label={`Fiyat (${listing.currency})`} name="price" type="number" min={0} defaultValue={listing.price} required />
      <TextareaField label="Açıklama" name="description" defaultValue={listing.description} maxLength={3000} />
      {result.error ? <FormError>{result.error}</FormError> : null}
      {result.ok ? <FormSuccess>Değişiklikler kaydedildi.</FormSuccess> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" full={false} disabled={pending} className="sm:min-w-[160px]">
          Değişiklikleri kaydet
        </Button>
        {result.ok ? (
          <LinkButton href={`/yonetim/ilanlar/${listing.id}`} variant="outline" full={false}>
            İncelemeye dön
          </LinkButton>
        ) : null}
      </div>
    </form>
  );
}
