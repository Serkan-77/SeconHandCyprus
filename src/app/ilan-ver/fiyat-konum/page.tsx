"use client";

import { useRouter } from "next/navigation";
import { WizardLayout } from "@/components/WizardLayout";
import { WizardPreviewCard } from "@/components/WizardPreviewCard";
import { Button, LinkButton } from "@/components/ui/Button";
import { Checkbox, Field, SelectField } from "@/components/ui/Field";
import { MapPreview } from "@/components/MapPreview";
import { useWizardDraft } from "@/lib/wizardStore";
import { regionNames as cities } from "@/lib/regions";

export default function AddPricePage() {
  const { draft, setDraft } = useWizardDraft();
  const router = useRouter();

  return (
    <WizardLayout active={2} preview={<WizardPreviewCard />}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          router.push("/ilan-ver/onizleme");
        }}
        className="flex flex-col gap-6"
      >
        <div>
          <h2 className="text-xl font-semibold">Fiyat ve konum</h2>
          <p className="mt-2 text-[13px] text-muted">
            Adil bir fiyat ve doğru konum, ilanının daha hızlı bulunmasını sağlar.
          </p>
        </div>

        <div className="grid grid-cols-[1fr_100px] gap-3">
          <Field
            label="Fiyat"
            type="number"
            min={0}
            inputMode="numeric"
            value={draft.price}
            onChange={(e) => setDraft({ price: e.target.value })}
            required
          />
          <SelectField
            label="Birim"
            options={["TL", "€"]}
            value={draft.currency}
            onChange={(e) => setDraft({ currency: e.target.value as "TL" | "€" })}
          />
        </div>

        <Checkbox
          label="Pazarlığa açık"
          checked={draft.negotiable}
          onChange={(e) => setDraft({ negotiable: e.target.checked })}
        />

        <SelectField
          label="Bölge"
          options={cities}
          value={draft.city}
          onChange={(e) => setDraft({ city: e.target.value })}
        />
        <Field
          label="Semt / mahalle (opsiyonel)"
          value={draft.district}
          onChange={(e) => setDraft({ district: e.target.value })}
          placeholder="Örn. Zeytinlik"
          maxLength={40}
          hint="Tam adresini yazma; buluşma yerini mesajla belirlersiniz."
        />
        <MapPreview label={draft.city} />

        <div className="mt-auto flex flex-col gap-3 border-t border-border pt-6 sm:flex-row">
          <LinkButton href="/ilan-ver/detaylar" variant="outline" full={false} className="sm:min-w-[140px]">
            Geri
          </LinkButton>
          <Button type="submit">Devam et</Button>
        </div>
      </form>
    </WizardLayout>
  );
}
