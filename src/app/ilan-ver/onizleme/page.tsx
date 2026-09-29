"use client";
import * as I18n from "@/components/i18n/Localized";


import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { WizardLayout } from "@/components/WizardLayout";
import { Button, LinkButton } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { Icon } from "@/components/icons";
import { useWizardDraft } from "@/lib/wizardStore";
import { publicImageUrl } from "@/lib/supabase/env";
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
      // A dropped connection throws; the draft and its key stay, so the same
      // button retries safely.
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
      }).catch(() => ({ error: "Bağlantı kesildi. İnternetini kontrol edip tekrar gönder.", id: undefined }));
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
        <I18n.h2 className="text-xl font-semibold">Son bir kontrol</I18n.h2>
        <I18n.p className="mt-2 text-[13px] text-muted">
          İlanını yayına göndermeden önce her şeyin doğru olduğundan emin ol.
        </I18n.p>
      </div>

      <article className="overflow-hidden rounded-2xl border border-border">
        <I18n.div className="relative aspect-[1.8] w-full bg-bg">
          {draft.photos[0] ? (
            <I18n.Image src={publicImageUrl(draft.photos[0])} alt="" fill sizes="600px" className="object-cover" />
          ) : (
            <div className="grid h-full place-items-center text-muted">
              <Icon name="image" className="h-8 w-8" />
            </div>
          )}
          {draft.photos.length > 1 ? (
            <I18n.span className="absolute bottom-3 right-3 rounded-lg bg-white/93 px-2.5 py-1.5 text-[11px] text-[#111318]">
              {draft.photos.length} fotoğraf
            </I18n.span>
          ) : null}
        </I18n.div>
        <I18n.div className="p-5">
          <I18n.span className="text-[11px] text-muted">
            {draft.categoryName || "Kategori seçilmedi"} · {draft.condition}
          </I18n.span>
          <I18n.h3 className="mt-1.5 text-lg font-semibold">{draft.title ? <I18n.Raw>{draft.title}</I18n.Raw> : "İlan başlığı"}</I18n.h3>
          <I18n.strong className="mt-1 block text-2xl tracking-tight">
            {draft.price ? <I18n.Formatted kind="formatPrice" args={[draft.price, draft.currency]} /> : "Fiyat girilmedi"}
          </I18n.strong>
          <I18n.p className="mt-3 whitespace-pre-line text-[13px] text-muted">{draft.description ? <I18n.Raw>{draft.description}</I18n.Raw> : "Açıklama eklenmedi."}</I18n.p>
          {detailRows(draft.details).length ? (
            <I18n.dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
              {detailRows(draft.details).map(([term, desc]) => (
                <div key={term}>
                  <I18n.dt className="text-[10px] text-muted">{term}</I18n.dt>
                  <I18n.dd>{desc}</I18n.dd>
                </div>
              ))}
            </I18n.dl>
          ) : null}
          <I18n.div className="mt-4 flex flex-wrap gap-2 text-[11px] text-muted">
            <I18n.span>{[draft.city, draft.district].filter(Boolean).join(", ")}</I18n.span>
            {draft.negotiable ? <I18n.span>· Pazarlığa açık</I18n.span> : null}
          </I18n.div>
        </I18n.div>
      </article>

      {missing.length ? (
        <FormError>
          Göndermeden önce tamamla:{" "}
          {missing.map((m, i) => (
            <I18n.span key={m.label}>
              {i > 0 ? ", " : ""}
              <I18n.Link href={m.href} className="font-semibold text-accent underline">
                {m.label}
              </I18n.Link>
            </I18n.span>
          ))}
        </FormError>
      ) : (
        <I18n.div className="flex items-start gap-2.5 rounded-xl bg-brand-soft p-4 text-xs leading-relaxed">
          <Icon name="info" className="h-[18px] w-[18px] flex-shrink-0 text-accent" />
          İlanın yayınlanmadan önce kısa bir incelemeden geçer, genellikle birkaç saat içinde sonuçlanır.
        </I18n.div>
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
