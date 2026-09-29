"use client";
import * as I18n from "@/components/i18n/Localized";


import { useState, useTransition } from "react";
import { Button, LinkButton } from "@/components/ui/Button";
import { Checkbox, Field, SelectField, TextareaField } from "@/components/ui/Field";
import { FormError, FormSuccess } from "@/components/ui/FormError";
import { Modal } from "@/components/ui/Modal";
import { Icon } from "@/components/icons";
import { ListingDetailsFields } from "@/components/ListingDetailsFields";
import { adminDeleteListing, adminRemoveListingImage, adminUpdateListing } from "@/lib/actions/admin";
import { regionNames } from "@/lib/regions";
import type { ListingDetails } from "@/lib/listingDetails";

// Same lists as CONDITIONS / CURRENCIES in validation.ts, kept here so zod stays out of the client bundle.
const CONDITIONS = ["Sıfır", "Az kullanılmış", "Yıpranmış"];
const CURRENCIES = ["TL", "€"];

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "active", label: "Yayında" },
  { value: "pending", label: "İncelemede" },
  { value: "rejected", label: "Reddedildi" },
  { value: "sold", label: "Satıldı" },
  { value: "removed", label: "Yayından kaldırıldı" },
  { value: "draft", label: "Taslak" },
];

const selectClass =
  "min-h-12 w-full rounded-field border border-border bg-surface px-4 text-base font-normal text-text focus:outline-none";

export type AdminListing = {
  id: string;
  title: string;
  categoryId: number;
  price: string;
  currency: string;
  condition: string;
  city: string;
  district: string;
  description: string;
  negotiable: boolean;
  status: string;
  details: ListingDetails;
};

export function AdminEditForm({
  listing,
  categories,
  images,
}: {
  listing: AdminListing;
  categories: { id: number; name: string }[];
  images: { id: string; url: string }[];
}) {
  const [result, setResult] = useState<{ error?: string; ok?: boolean }>({});
  const [details, setDetails] = useState<ListingDetails>(listing.details);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex max-w-[720px] flex-col gap-6">
      <I18n.section className="rounded-xl border border-border bg-surface p-5">
        <I18n.h2 className="mb-3 text-sm font-semibold">Fotoğraflar ({images.length})</I18n.h2>
        {images.length ? (
          <I18n.div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
            {images.map((img, i) => (
              <div key={img.id} className="relative aspect-square overflow-hidden rounded-xl bg-bg">
                <I18n.Image src={img.url} alt={`Fotoğraf ${i + 1}`} fill sizes="140px" className="object-cover" />
                <I18n.button
                  type="button"
                  aria-label={`${i + 1}. fotoğrafı kaldır`}
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      setResult(await adminRemoveListingImage(img.id));
                    })
                  }
                  className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-white/90 text-[#111318]"
                >
                  <Icon name="close" className="h-4 w-4" />
                </I18n.button>
              </div>
            ))}
          </I18n.div>
        ) : (
          <I18n.p className="text-xs text-muted">Bu ilanda fotoğraf yok.</I18n.p>
        )}
        <I18n.p className="mt-3 text-[11px] text-muted">Uygunsuz bir fotoğrafı kaldırabilirsin; kaldırılan dosya depodan da silinir.</I18n.p>
      </I18n.section>

      <I18n.form
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          startTransition(async () => {
            setResult(
              await adminUpdateListing(listing.id, {
                title: String(form.get("title") ?? ""),
                categoryId: Number(form.get("category")),
                price: String(form.get("price") ?? ""),
                currency: String(form.get("currency") ?? ""),
                condition: String(form.get("condition") ?? ""),
                city: String(form.get("city") ?? ""),
                district: String(form.get("district") ?? ""),
                description: String(form.get("description") ?? ""),
                negotiable: form.get("negotiable") === "on",
                status: String(form.get("status") ?? ""),
                details,
              }),
            );
          });
        }}
        className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5"
      >
        <I18n.label className="flex flex-col gap-2 text-[13px] font-semibold text-text">
          İlan durumu
          <I18n.select name="status" defaultValue={listing.status} className={selectClass}>
            {STATUS_OPTIONS.map((o) => (
              <I18n.option key={o.value} value={o.value}>
                {o.label}
              </I18n.option>
            ))}
          </I18n.select>
        </I18n.label>
        <Field label="Başlık" name="title" defaultValue={listing.title} required minLength={3} maxLength={120} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <I18n.label className="flex flex-col gap-2 text-[13px] font-semibold text-text">
            Kategori
            <I18n.select name="category" defaultValue={listing.categoryId} className={selectClass}>
              {categories.map((c) => (
                <I18n.option key={c.id} value={c.id}>
                  {c.name}
                </I18n.option>
              ))}
            </I18n.select>
          </I18n.label>
          <SelectField label="Ürün durumu" name="condition" options={CONDITIONS} defaultValue={listing.condition} />
        </div>
        <div className="grid grid-cols-[1fr_110px] gap-4">
          <Field label="Fiyat" name="price" type="number" min={0} step="0.01" defaultValue={listing.price} required />
          <SelectField label="Para birimi" name="currency" options={CURRENCIES} defaultValue={listing.currency} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField label="Bölge" name="city" options={regionNames} defaultValue={listing.city} />
          <Field label="Semt (opsiyonel)" name="district" defaultValue={listing.district} maxLength={60} />
        </div>
        <TextareaField label="Açıklama" name="description" defaultValue={listing.description} maxLength={5000} />
        <Checkbox label="Pazarlığa açık" name="negotiable" defaultChecked={listing.negotiable} />
        <ListingDetailsFields value={details} onChange={setDetails} />
        {result.error ? <FormError>{result.error}</FormError> : null}
        {result.ok ? <FormSuccess>Değişiklikler kaydedildi.</FormSuccess> : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" full={false} disabled={pending} className="sm:min-w-[160px]">
            Değişiklikleri kaydet
          </Button>
          <LinkButton href={`/yonetim/ilanlar/${listing.id}`} variant="outline" full={false}>
            İncelemeye dön
          </LinkButton>
        </div>
      </I18n.form>

      <section className="rounded-xl border border-border bg-surface p-5">
        <I18n.h2 className="text-sm font-semibold">İlanı sil</I18n.h2>
        <I18n.p className="mt-1.5 text-xs text-muted">
          İlan ve fotoğrafları kalıcı olarak silinir. Bu ilan hakkındaki konuşmalar taraflarda kalır. Sadece gizlemek
          istiyorsan durumu &quot;Yayından kaldırıldı&quot; yap.
        </I18n.p>
        <Button variant="danger" full={false} className="mt-4" onClick={() => setConfirmDelete(true)}>
          İlanı kalıcı olarak sil
        </Button>
      </section>

      <Modal title="İlanı sil" open={confirmDelete} onClose={() => setConfirmDelete(false)}>
        <I18n.p className="text-sm text-muted">
          <I18n.b className="text-text"><I18n.Raw>{listing.title}</I18n.Raw></I18n.b> kalıcı olarak silinecek. Bu işlem geri alınamaz.
        </I18n.p>
        {result.error ? <FormError>{result.error}</FormError> : null}
        <div className="flex gap-3">
          <Button variant="outline" full={false} onClick={() => setConfirmDelete(false)}>
            Vazgeç
          </Button>
          <Button
            variant="danger"
            full={false}
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await adminDeleteListing(listing.id);
                if (r?.error) setResult(r);
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
