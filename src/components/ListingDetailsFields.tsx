"use client";

import { Checkbox, Field } from "@/components/ui/Field";
import { DELIVERY_OPTIONS, DETAIL_TEXT_MAX, WARRANTY_OPTIONS, type ListingDetails } from "@/lib/listingDetails";

const selectClass =
  "min-h-12 w-full rounded-field border border-border bg-surface px-4 text-base font-normal text-text focus:outline-none";

/** The optional attributes block, shared by the wizard and both edit forms. */
export function ListingDetailsFields({
  value,
  onChange,
}: {
  value: ListingDetails;
  onChange: (next: ListingDetails) => void;
}) {
  function set<K extends keyof ListingDetails>(key: K, v: ListingDetails[K]) {
    const next = { ...value, [key]: v };
    if (v === undefined || v === "" || v === false || (Array.isArray(v) && !v.length)) delete next[key];
    onChange(next);
  }

  function toggleDelivery(option: (typeof DELIVERY_OPTIONS)[number], on: boolean) {
    const current = value.delivery ?? [];
    set("delivery", on ? [...current.filter((o) => o !== option), option] : current.filter((o) => o !== option));
  }

  return (
    <fieldset className="flex flex-col gap-4 rounded-xl border border-border p-4 sm:p-5">
      <legend className="px-1 text-[13px] font-semibold">
        Ek bilgiler <span className="font-normal text-muted">(opsiyonel)</span>
      </legend>
      <p className="-mt-1 text-[12px] text-muted">Doldurduğun bilgiler ilan sayfasında özellik tablosunda görünür.</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Marka"
          value={value.brand ?? ""}
          onChange={(e) => set("brand", e.target.value)}
          maxLength={DETAIL_TEXT_MAX}
          placeholder="Örn. IKEA, Apple"
        />
        <Field
          label="Model"
          value={value.model ?? ""}
          onChange={(e) => set("model", e.target.value)}
          maxLength={DETAIL_TEXT_MAX}
        />
        <Field
          label="Renk"
          value={value.color ?? ""}
          onChange={(e) => set("color", e.target.value)}
          maxLength={DETAIL_TEXT_MAX}
        />
        <Field
          label="Satın alma yılı"
          type="number"
          inputMode="numeric"
          min={1950}
          max={new Date().getFullYear()}
          value={value.year ?? ""}
          onChange={(e) => set("year", e.target.value ? Number(e.target.value) : undefined)}
        />
        <label className="flex flex-col gap-2 text-[13px] font-semibold text-text sm:col-span-2">
          Garanti
          <select
            value={value.warranty ?? ""}
            onChange={(e) => set("warranty", (e.target.value || undefined) as ListingDetails["warranty"])}
            className={selectClass}
          >
            <option value="">Belirtme</option>
            {WARRANTY_OPTIONS.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-col gap-2.5">
        <span className="text-[13px] font-semibold">Teslimat</span>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {DELIVERY_OPTIONS.map((option) => (
            <Checkbox
              key={option}
              label={option}
              checked={value.delivery?.includes(option) ?? false}
              onChange={(e) => toggleDelivery(option, e.target.checked)}
            />
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <Checkbox label="Faturası var" checked={Boolean(value.invoice)} onChange={(e) => set("invoice", e.target.checked)} />
        <Checkbox label="Kutusu / aksesuarları var" checked={Boolean(value.box)} onChange={(e) => set("box", e.target.checked)} />
        <Checkbox label="Takasa açık" checked={Boolean(value.exchange)} onChange={(e) => set("exchange", e.target.checked)} />
      </div>
    </fieldset>
  );
}
