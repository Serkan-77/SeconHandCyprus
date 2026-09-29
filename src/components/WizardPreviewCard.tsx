"use client";
import * as I18n from "@/components/i18n/Localized";


import { Icon } from "@/components/icons";
import { useWizardDraft } from "@/lib/wizardStore";
import { publicImageUrl } from "@/lib/supabase/env";

export function WizardPreviewCard() {
  const { draft } = useWizardDraft();

  return (
    <div>
      <I18n.span className="mb-4 block text-[9px] font-semibold tracking-[1.8px] text-muted">İLAN ÖNİZLEMESİ</I18n.span>
      <article className="overflow-hidden rounded-card border border-border bg-surface">
        <I18n.div className="relative aspect-[1.25] w-full bg-bg">
          {draft.photos[0] ? (
            <I18n.Image src={publicImageUrl(draft.photos[0])} alt="" fill sizes="250px" className="object-cover" />
          ) : (
            <div className="grid h-full place-items-center text-muted">
              <Icon name="image" className="h-8 w-8" />
            </div>
          )}
        </I18n.div>
        <div className="p-4">
          <I18n.span className="block text-[10px] text-muted">
            {draft.categoryName || "Kategori"} <I18n.span>· {draft.condition}</I18n.span>
          </I18n.span>
          <I18n.span className="mt-1.5 block truncate text-[15px] font-medium">
            {draft.title ? <I18n.Raw>{draft.title}</I18n.Raw> : "İlan başlığın burada görünecek"}
          </I18n.span>
          <I18n.strong className="my-1.5 block text-xl font-semibold tracking-tight">
            {draft.price ? <I18n.Formatted kind="formatPrice" args={[draft.price, draft.currency]} /> : "Fiyat"}
          </I18n.strong>
          <div className="flex items-center justify-between border-t border-border pt-2.5 text-[10px] text-muted">
            <I18n.span>{[draft.city, draft.district].filter(Boolean).join(", ")}</I18n.span>
            <I18n.span>Şimdi</I18n.span>
          </div>
        </div>
      </article>
      <I18n.p className="mt-4 text-[11px] leading-relaxed text-muted">Bilgilerin tamamlandıkça ilan kartın burada şekillenir.</I18n.p>
    </div>
  );
}
