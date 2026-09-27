"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Button, LinkButton } from "@/components/ui/Button";
import { Checkbox, Field, TextareaField } from "@/components/ui/Field";
import { FormError, FormSuccess } from "@/components/ui/FormError";
import { Modal } from "@/components/ui/Modal";
import { Icon } from "@/components/icons";
import { ListingStatusBadge } from "@/components/ListingStatusBadge";
import { ListingDetailsFields } from "@/components/ListingDetailsFields";
import type { ListingDetails } from "@/lib/listingDetails";
import {
  addListingImages,
  deleteListing,
  removeListingImage,
  setListingStatus,
  updateListing,
} from "@/lib/actions/listings";
import { uploadImage } from "@/lib/upload";
import { regionNames } from "@/lib/regions";
import type { ListingStatus } from "@/lib/queries";

const MAX_PHOTOS = 10;

type Props = {
  listing: {
    id: string;
    slug: string;
    title: string;
    price: string;
    currency: string;
    city: string;
    district: string;
    description: string;
    negotiable: boolean;
    details: ListingDetails;
    status: ListingStatus;
    rejectReason: string | null;
    viewCount: number;
  };
  images: { id: string; url: string }[];
};

// A published listing whose text or photos change is reviewed again (P1-01).
const REVIEW_TEXT = "Değişiklikler kaydedildi. İlan içeriği değiştiği için yayından alındı ve tekrar incelemeye gönderildi.";

export function ManageListing({ listing, images }: Props) {
  const [modal, setModal] = useState<"sold" | "delete" | null>(null);
  const [message, setMessage] = useState<{ error?: string; ok?: string }>({});
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [details, setDetails] = useState<ListingDetails>(listing.details);

  function run(task: () => Promise<{ error?: string; ok?: boolean; review?: boolean } | void>, okText?: string) {
    setMessage({});
    startTransition(async () => {
      const result = await task();
      if (result && result.error) setMessage({ error: result.error });
      else if (result && result.review) setMessage({ ok: REVIEW_TEXT });
      else if (okText) setMessage({ ok: okText });
      setModal(null);
    });
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    if (images.length + files.length > MAX_PHOTOS) {
      setMessage({ error: `En fazla ${MAX_PHOTOS} fotoğraf ekleyebilirsin.` });
      return;
    }
    setUploading(true);
    setMessage({});
    try {
      const paths: string[] = [];
      for (const file of Array.from(files)) paths.push(await uploadImage("listing-images", file));
      const result = await addListingImages(listing.id, paths);
      if (result.error) setMessage({ error: result.error });
      else if (result.review) setMessage({ ok: REVIEW_TEXT });
    } catch (e) {
      setMessage({ error: e instanceof Error ? e.message : "Fotoğraf yüklenemedi." });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const editable = listing.status !== "removed";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/hesabim/ilanlar" className="mb-2 inline-flex items-center gap-1 text-[11px] text-muted">
            <Icon name="back" className="h-3.5 w-3.5" /> İlanlarım
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[30px]">İlanı yönet</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-muted">{listing.viewCount} görüntülenme</span>
          <ListingStatusBadge status={listing.status} />
        </div>
      </div>

      {listing.status === "rejected" ? (
        <FormError>
          <b>İlanın yayınlanamadı.</b> {listing.rejectReason ?? "Kurallara uygun bulunmadı."} Düzeltip tekrar incelemeye
          gönderebilirsin.
        </FormError>
      ) : listing.status === "active" ? (
        <Link
          href="/one-cikar"
          className="flex items-center gap-3 rounded-xl bg-bg p-4 text-xs text-text transition hover:bg-brand-soft"
        >
          <Icon name="spark" className="h-5 w-5 flex-shrink-0" />
          <span className="flex-1">
            <b className="block">İlanını öne çıkar</b>
            Vitrin ve üste taşıma paketleri yakında. Ayrıntıları gör.
          </span>
          <Icon name="chevron" className="h-4 w-4 flex-shrink-0 text-muted" />
        </Link>
      ) : listing.status === "pending" ? (
        <div className="flex items-start gap-2.5 rounded-xl bg-bg p-4 text-xs text-muted">
          <Icon name="clock" className="h-4 w-4 flex-shrink-0 text-accent" />
          İlanın incelemede. Onaylandığında sana bildirim göndereceğiz.
        </div>
      ) : null}

      <div className="flex flex-col gap-6 rounded-2xl border border-border p-5 sm:p-7">
        <section>
          <h2 className="mb-3 text-sm font-semibold">Fotoğraflar ({images.length}/{MAX_PHOTOS})</h2>
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
            {images.map((img, i) => (
              <div key={img.id} className="relative aspect-square overflow-hidden rounded-xl bg-bg">
                <Image src={img.url} alt={`Fotoğraf ${i + 1}`} fill sizes="160px" className="object-cover" />
                {i === 0 ? (
                  <span className="absolute bottom-1.5 left-1.5 rounded bg-white/90 px-1.5 py-0.5 text-[9px] text-[#111318]">
                    Kapak
                  </span>
                ) : null}
                {editable && images.length > 1 ? (
                  <button
                    type="button"
                    aria-label={`${i + 1}. fotoğrafı kaldır`}
                    disabled={pending}
                    onClick={() => run(() => removeListingImage(img.id))}
                    className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-white/90 text-[#111318]"
                  >
                    <Icon name="close" className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            ))}
            {editable && images.length < MAX_PHOTOS ? (
              <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border text-[10px] text-muted">
                <Icon name={uploading ? "refresh" : "plus"} className="h-5 w-5" />
                {uploading ? "Yükleniyor…" : "Ekle"}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  disabled={uploading}
                  className="hidden"
                  onChange={(e) => onFiles(e.target.files)}
                />
              </label>
            ) : null}
          </div>
        </section>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            run(
              () =>
                updateListing(listing.id, {
                  title: String(form.get("title")),
                  price: String(form.get("price")),
                  city: String(form.get("city")),
                  district: String(form.get("district") ?? ""),
                  description: String(form.get("description") ?? ""),
                  negotiable: form.get("negotiable") === "on",
                  details,
                }),
              "Değişiklikler kaydedildi.",
            );
          }}
          className="flex flex-col gap-4"
        >
          <h2 className="text-sm font-semibold">İlan bilgileri</h2>
          <Field label="Başlık" name="title" defaultValue={listing.title} required minLength={3} maxLength={120} disabled={!editable} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_1fr]">
            <Field
              label={`Fiyat (${listing.currency})`}
              name="price"
              type="number"
              min={0}
              defaultValue={listing.price}
              required
              disabled={!editable}
            />
            <label className="flex flex-col gap-2 text-[13px] font-semibold text-text">
              Bölge
              <select
                name="city"
                defaultValue={listing.city}
                disabled={!editable}
                className="min-h-12 w-full rounded-field border border-border bg-surface px-4 text-base font-normal text-text focus:outline-none"
              >
                {regionNames.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            <Field label="Semt (opsiyonel)" name="district" defaultValue={listing.district} maxLength={40} disabled={!editable} />
          </div>
          <TextareaField
            label="Açıklama"
            name="description"
            defaultValue={listing.description}
            maxLength={5000}
            disabled={!editable}
          />
          <Checkbox label="Pazarlığa açık" name="negotiable" defaultChecked={listing.negotiable} disabled={!editable} />
          {editable ? <ListingDetailsFields value={details} onChange={setDetails} /> : null}
          {message.error ? <FormError>{message.error}</FormError> : null}
          {message.ok ? <FormSuccess>{message.ok}</FormSuccess> : null}
          {editable ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" full={false} disabled={pending} className="sm:min-w-[160px]">
                Değişiklikleri kaydet
              </Button>
              {listing.status === "rejected" || listing.status === "draft" ? (
                <Button
                  type="button"
                  variant="secondary"
                  full={false}
                  disabled={pending}
                  onClick={() => run(() => setListingStatus(listing.id, "pending"), "İlanın tekrar incelemeye gönderildi.")}
                >
                  Tekrar incelemeye gönder
                </Button>
              ) : null}
            </div>
          ) : null}
        </form>

        <div className="flex flex-wrap gap-3 border-t border-border pt-6">
          {listing.status === "active" ? (
            <>
              <LinkButton href={`/ilan/${listing.slug}`} variant="outline" full={false}>
                İlanı görüntüle
              </LinkButton>
              <Button variant="outline" full={false} onClick={() => setModal("sold")}>
                Satıldı olarak işaretle
              </Button>
            </>
          ) : null}
          {listing.status === "sold" || listing.status === "removed" ? (
            <Button
              variant="outline"
              full={false}
              disabled={pending}
              onClick={() => run(() => setListingStatus(listing.id, "pending"), "İlanın yeniden yayın için incelemeye gönderildi.")}
            >
              Yeniden yayınla
            </Button>
          ) : null}
          <Button
            variant="danger"
            full={false}
            icon={<Icon name="trash" className="h-4 w-4" />}
            onClick={() => setModal("delete")}
          >
            İlanı sil
          </Button>
        </div>
      </div>

      <Modal title="Satışı tamamla" open={modal === "sold"} onClose={() => setModal(null)}>
        <p className="text-sm text-muted">
          {listing.title} ilanını satıldı olarak işaretlemek üzeresin. İlan artık arama sonuçlarında görünmeyecek.
        </p>
        <Button className="mt-5" disabled={pending} onClick={() => run(() => setListingStatus(listing.id, "sold"), "İlan satıldı olarak işaretlendi.")}>
          Satıldı olarak işaretle
        </Button>
      </Modal>

      <Modal title="İlan silme onayı" open={modal === "delete"} onClose={() => setModal(null)}>
        <p className="text-sm text-muted">
          {listing.title} ilanını ve fotoğraflarını kalıcı olarak silmek istediğine emin misin? Bu işlem geri alınamaz.
        </p>
        <div className="mt-5 flex gap-3">
          <Button variant="outline" full={false} onClick={() => setModal(null)}>
            Vazgeç
          </Button>
          <Button variant="danger" full={false} disabled={pending} onClick={() => run(() => deleteListing(listing.id))}>
            {pending ? "Siliniyor…" : "İlanı sil"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
