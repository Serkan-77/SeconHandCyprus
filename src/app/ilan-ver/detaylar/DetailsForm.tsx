"use client";

import { useRouter } from "next/navigation";
import { WizardLayout } from "@/components/WizardLayout";
import { WizardPreviewCard } from "@/components/WizardPreviewCard";
import { Button, LinkButton } from "@/components/ui/Button";
import { Field, SelectField, TextareaField } from "@/components/ui/Field";
import { ListingDetailsFields } from "@/components/ListingDetailsFields";
import { useWizardDraft } from "@/lib/wizardStore";

const conditions = ["Sıfır", "Az kullanılmış", "Yıpranmış"];
const selectClass =
  "min-h-12 w-full rounded-field border border-border bg-surface px-4 text-base font-normal text-text focus:outline-none";

export function DetailsForm({ categories }: { categories: { slug: string; name: string }[] }) {
  const { draft, setDraft } = useWizardDraft();
  const router = useRouter();

  return (
    <WizardLayout active={1} preview={<WizardPreviewCard />}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          router.push("/ilan-ver/fiyat-konum");
        }}
        className="flex flex-col gap-6"
      >
        <div>
          <h2 className="text-xl font-semibold">Ürün bilgileri</h2>
          <p className="mt-2 text-[13px] text-muted">
            Alıcıların aradığını bulmasına yardımcı olacak net bir başlık ve açıklama yaz.
          </p>
        </div>

        <Field
          label="Başlık"
          value={draft.title}
          onChange={(e) => setDraft({ title: e.target.value })}
          placeholder="Örn. Bouclé berjer"
          required
          minLength={3}
          maxLength={120}
          hint={`${draft.title.length}/120`}
        />
        <label className="flex flex-col gap-2 text-[13px] font-semibold text-text">
          Kategori
          <select
            required
            value={draft.category}
            onChange={(e) => {
              const category = categories.find((c) => c.slug === e.target.value);
              setDraft({ category: e.target.value, categoryName: category?.name ?? "" });
            }}
            className={selectClass}
          >
            <option value="" disabled>
              Kategori seç
            </option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <SelectField
          label="Ürün durumu"
          options={conditions}
          value={draft.condition}
          onChange={(e) => setDraft({ condition: e.target.value })}
        />
        <TextareaField
          label="Açıklama"
          value={draft.description}
          onChange={(e) => setDraft({ description: e.target.value })}
          placeholder="Ürünün durumunu, kullanım süresini ve öne çıkan özelliklerini anlat."
          hint="Dürüst ve ayrıntılı açıklamalar güven oluşturur."
          maxLength={5000}
        />
        <ListingDetailsFields value={draft.details} onChange={(details) => setDraft({ details })} />

        <div className="mt-auto flex flex-col gap-3 border-t border-border pt-6 sm:flex-row">
          <LinkButton href="/ilan-ver/fotograflar" variant="outline" full={false} className="sm:min-w-[140px]">
            Geri
          </LinkButton>
          <Button type="submit">Devam et</Button>
        </div>
      </form>
    </WizardLayout>
  );
}
