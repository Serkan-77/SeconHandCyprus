"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { WizardLayout } from "@/components/WizardLayout";
import { Button, LinkButton } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { Icon } from "@/components/icons";
import { useWizardDraft } from "@/lib/wizardStore";
import { publicImageUrl } from "@/lib/supabase/env";
import { formatPrice } from "@/lib/format";
import { detailRows } from "@/lib/listingDetails";
import { createListing } from "@/lib/actions/listings";

export default function AddPreviewPage() {
  const { draft, setDraft, resetDraft } = useWizardDraft();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const missing = [
    draft.photos.length === 0 && { label: "En az 1 fotoğraf", href: "/ilan-ver/fotograflar" },
    draft.title.trim().length < 3 && { label: "Başlık", href: "/ilan-ver/detaylar" },
    !draft.category && { label: "Kategori", href: "/ilan-ver/detaylar" },
    !draft.price && { label: "Fiyat", href: "/ilan-ver/fiyat-konum" },
  ].filter(Boolean) as { label: string; href: string }[];

  function submit() {
    setError("");
    // Kept until the listing is created, so a retry cannot create it twice.
    const submissionKey = draft.submissionKey || crypto.randomUUID();
    if (!draft.submissionKey) setDraft({ submissionKey });
    startTransition(async () => {
      const result = await createListing({
        title: draft.title,
        categorySlug: draft.category,
        condition: draft.condition,
        description: draft.description,
        price: draft.price,
        currency: draft.currency,
        city: draft.city,
        district: draft.district,
        negotiable: draft.negotiable,
        photos: draft.photos,
        details: draft.details,
        submissionKey,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      resetDraft();
      router.push(`/ilan-ver/yayinda?id=${result.id}`);
    });
  }

  return (
    <WizardLayout active={3}>
      <div>
        <h2 className="text-xl font-semibold">Son bir kontrol</h2>
        <p className="mt-2 text-[13px] text-muted">
          İlanını yayına göndermeden önce her şeyin doğru olduğundan emin ol.
        </p>
      </div>

      <article className="overflow-hidden rounded-2xl border border-border">
        <div className="relative aspect-[1.8] w-full bg-bg">
          {draft.photos[0] ? (
            <Image src={publicImageUrl(draft.photos[0])} alt="" fill sizes="600px" className="object-cover" />
          ) : (
            <div className="grid h-full place-items-center text-muted">
              <Icon name="image" className="h-8 w-8" />
            </div>
          )}
          {draft.photos.length > 1 ? (
            <span className="absolute bottom-3 right-3 rounded-lg bg-white/93 px-2.5 py-1.5 text-[11px] text-[#111318]">
              {draft.photos.length} fotoğraf
            </span>
          ) : null}
        </div>
        <div className="p-5">
          <span className="text-[11px] text-muted">
            {draft.categoryName || "Kategori seçilmedi"} · {draft.condition}
          </span>
          <h3 className="mt-1.5 text-lg font-semibold">{draft.title || "İlan başlığı"}</h3>
          <strong className="mt-1 block text-2xl tracking-tight">
            {draft.price ? formatPrice(draft.price, draft.currency) : "Fiyat girilmedi"}
          </strong>
          <p className="mt-3 whitespace-pre-line text-[13px] text-muted">{draft.description || "Açıklama eklenmedi."}</p>
          {detailRows(draft.details).length ? (
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
              {detailRows(draft.details).map(([term, desc]) => (
                <div key={term}>
                  <dt className="text-[10px] text-muted">{term}</dt>
                  <dd>{desc}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-muted">
            <span>{[draft.city, draft.district].filter(Boolean).join(", ")}</span>
            {draft.negotiable ? <span>· Pazarlığa açık</span> : null}
          </div>
        </div>
      </article>

      {missing.length ? (
        <FormError>
          Göndermeden önce tamamla:{" "}
          {missing.map((m, i) => (
            <span key={m.label}>
              {i > 0 ? ", " : ""}
              <Link href={m.href} className="font-semibold text-accent underline">
                {m.label}
              </Link>
            </span>
          ))}
        </FormError>
      ) : (
        <div className="flex items-start gap-2.5 rounded-xl bg-brand-soft p-4 text-xs leading-relaxed">
          <Icon name="info" className="h-[18px] w-[18px] flex-shrink-0 text-accent" />
          İlanın yayınlanmadan önce kısa bir incelemeden geçer, genellikle birkaç saat içinde sonuçlanır.
        </div>
      )}

      {error ? <FormError>{error}</FormError> : null}

      <div className="mt-auto flex flex-col gap-3 border-t border-border pt-6 sm:flex-row">
        <LinkButton href="/ilan-ver/fiyat-konum" variant="outline" full={false} className="sm:min-w-[140px]">
          Geri
        </LinkButton>
        <Button onClick={submit} disabled={pending || missing.length > 0}>
          {pending ? "Gönderiliyor…" : "İlanı yayına gönder"}
        </Button>
      </div>
    </WizardLayout>
  );
}
