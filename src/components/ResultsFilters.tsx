"use client";
import * as I18n from "@/components/i18n/Localized";


import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field } from "@/components/ui/Field";
import { cn } from "@/lib/cn";

const conditions = ["Sıfır", "Az kullanılmış", "Yıpranmış"];

type Values = {
  kategori: string;
  sehir: string;
  min: string;
  max: string;
  birim: string;
  durum: string[];
  tarih: string;
  pazarlik: boolean;
  q: string;
  sirala: string;
};

const selectClass =
  "min-h-12 w-full rounded-field border border-border bg-surface px-4 text-base font-normal text-text focus:outline-none";

function Select({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue: string;
  options: { value: string; label: string }[];
}) {
  return (
    <I18n.label className="flex flex-col gap-2 text-[13px] font-semibold text-text">
      {label}
      <I18n.select name={name} defaultValue={defaultValue} className={selectClass}>
        {options.map((o) => (
          <I18n.option key={o.value} value={o.value}>
            {o.label}
          </I18n.option>
        ))}
      </I18n.select>
    </I18n.label>
  );
}

export function ResultsFilters({
  categories,
  regions,
  values,
  activeCount,
}: {
  categories: { slug: string; name: string }[];
  regions: string[];
  values: Values;
  activeCount: number;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const sp = new URLSearchParams();
    let category = "";
    for (const [key, value] of form.entries()) {
      if (typeof value !== "string" || !value.trim()) continue;
      if (key === "kategori") category = value;
      else sp.append(key, value.trim());
    }
    if (values.q) sp.set("q", values.q);
    if (values.sirala) sp.set("sirala", values.sirala);
    setOpen(false);
    const base = category ? `/kategori/${category}` : "/ilanlar";
    router.push(`${base}${sp.size ? `?${sp}` : ""}`);
  }

  // Remount the form whenever the URL-driven values change so defaults stay in sync.
  const formKey = JSON.stringify(values);

  return (
    <>
      <I18n.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex min-h-[42px] w-max items-center gap-2 rounded-button border border-border px-3.5 text-xs lg:hidden"
      >
        <Icon name="filter" className="h-4 w-4" />
        Filtreler{activeCount ? ` (${activeCount})` : ""}
      </I18n.button>
      <I18n.form
        key={formKey}
        onSubmit={onSubmit}
        className={cn(
          "h-max flex-col gap-6 rounded-xl border border-border p-5 lg:flex",
          open ? "flex" : "hidden",
        )}
        aria-label="İlan filtreleri"
      >
        <div className="flex items-center justify-between">
          <I18n.h2 className="text-base font-semibold">Filtreler</I18n.h2>
          <I18n.button
            type="button"
            onClick={() => {
              setOpen(false);
              router.push(values.q ? `/ilanlar?q=${encodeURIComponent(values.q)}` : "/ilanlar");
            }}
            className="text-[11px] font-medium text-accent"
          >
            Temizle
          </I18n.button>
        </div>
        <Select
          label="Kategori"
          name="kategori"
          defaultValue={values.kategori}
          options={[{ value: "", label: "Tüm kategoriler" }, ...categories.map((c) => ({ value: c.slug, label: c.name }))]}
        />
        <Select
          label="Şehir"
          name="sehir"
          defaultValue={values.sehir}
          options={[{ value: "", label: "Tüm Kıbrıs" }, ...regions.map((r) => ({ value: r, label: r }))]}
        />
        <fieldset className="flex flex-col gap-3">
          <I18n.legend className="mb-1 text-[13px] font-medium">Fiyat aralığı</I18n.legend>
          <div className="grid grid-cols-2 gap-2">
            <Field label="En az" type="number" min={0} name="min" defaultValue={values.min} />
            <Field label="En çok" type="number" min={0} name="max" defaultValue={values.max} />
          </div>
          <Select
            label="Para birimi"
            name="birim"
            defaultValue={values.birim}
            options={[
              { value: "", label: "Tümü" },
              { value: "TL", label: "TL" },
              { value: "€", label: "€" },
            ]}
          />
        </fieldset>
        <I18n.fieldset className="flex flex-col gap-3">
          <I18n.legend className="mb-1 text-[13px] font-medium">Ürün durumu</I18n.legend>
          {conditions.map((c) => (
            <Checkbox key={c} label={c} name="durum" value={c} defaultChecked={values.durum.includes(c)} />
          ))}
        </I18n.fieldset>
        <Select
          label="İlan tarihi"
          name="tarih"
          defaultValue={values.tarih}
          options={[
            { value: "", label: "Tüm zamanlar" },
            { value: "1", label: "Son 24 saat" },
            { value: "7", label: "Son 7 gün" },
            { value: "30", label: "Son 30 gün" },
          ]}
        />
        <Checkbox label="Pazarlığa açık" name="pazarlik" value="1" defaultChecked={values.pazarlik} />
        <Button type="submit">Sonuçları göster</Button>
      </I18n.form>
    </>
  );
}

export function SortSelect({ value }: { value: string }) {
  const router = useRouter();
  return (
    <I18n.label className="ml-auto text-[11px] text-muted">
      Sırala
      <I18n.select
        aria-label="İlanları sırala"
        value={value}
        onChange={(e) => {
          const sp = new URLSearchParams(window.location.search);
          if (e.target.value) sp.set("sirala", e.target.value);
          else sp.delete("sirala");
          sp.delete("sayfa");
          router.push(`${window.location.pathname}${sp.size ? `?${sp}` : ""}`);
        }}
        className="ml-2 rounded-md border border-border bg-surface px-2 py-2.5 text-xs text-text"
      >
        <I18n.option value="">En yeni</I18n.option>
        <I18n.option value="artan">Fiyat: artan</I18n.option>
        <I18n.option value="azalan">Fiyat: azalan</I18n.option>
      </I18n.select>
    </I18n.label>
  );
}
