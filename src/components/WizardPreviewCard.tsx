"use client";

import Image from "next/image";
import { Icon } from "@/components/icons";
import { useWizardDraft } from "@/lib/wizardStore";
import { publicImageUrl } from "@/lib/supabase/env";
import { formatPrice } from "@/lib/format";

export function WizardPreviewCard() {
  const { draft } = useWizardDraft();

  return (
    <div>
      <span className="mb-4 block text-[9px] font-semibold tracking-[1.8px] text-muted">İLAN ÖNİZLEMESİ</span>
      <article className="overflow-hidden rounded-card border border-border bg-surface">
        <div className="relative aspect-[1.25] w-full bg-bg">
          {draft.photos[0] ? (
            <Image src={publicImageUrl(draft.photos[0])} alt="" fill sizes="250px" className="object-cover" />
          ) : (
            <div className="grid h-full place-items-center text-muted">
              <Icon name="image" className="h-8 w-8" />
            </div>
          )}
        </div>
        <div className="p-4">
          <span className="block text-[10px] text-muted">
            {draft.categoryName || "Kategori"} <span>· {draft.condition}</span>
          </span>
          <span className="mt-1.5 block truncate text-[15px] font-medium">
            {draft.title || "İlan başlığın burada görünecek"}
          </span>
          <strong className="my-1.5 block text-xl font-semibold tracking-tight">
            {draft.price ? formatPrice(draft.price, draft.currency) : "Fiyat"}
          </strong>
          <div className="flex items-center justify-between border-t border-border pt-2.5 text-[10px] text-muted">
            <span>{[draft.city, draft.district].filter(Boolean).join(", ")}</span>
            <span>Şimdi</span>
          </div>
        </div>
      </article>
      <p className="mt-4 text-[11px] leading-relaxed text-muted">Bilgilerin tamamlandıkça ilan kartın burada şekillenir.</p>
    </div>
  );
}
