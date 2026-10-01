"use client";

import { useId } from "react";
import type { AttributeDef } from "@shared/attributes";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { controlClass } from "@/components/ui/Field";
import { cn } from "@/lib/cn";

type Values = Record<string, unknown>;

function useLabels() {
  const { locale, t } = useLocale();
  return {
    t,
    label: (a: AttributeDef) => (locale === "en" && a.labelEn ? a.labelEn : a.label),
    option: (o: { label: string; label_en?: string }) => (locale === "en" && o.label_en ? o.label_en : t(o.label)),
  };
}

function Chip({ selected, onClick, children, role = "radio" }: { selected: boolean; onClick: () => void; children: React.ReactNode; role?: "radio" | "checkbox" }) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "min-h-10 rounded-pill border px-3.5 text-[14px] font-medium transition",
        selected ? "border-brand bg-brand text-on-brand" : "border-border-strong bg-surface hover:bg-brand-soft",
      )}
    >
      {children}
    </button>
  );
}

export function AttributeField({
  def,
  value,
  onChange,
  error,
}: {
  def: AttributeDef;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
}) {
  const L = useLabels();
  const id = useId();
  const noteId = `${id}-note`;
  const label = L.label(def);
  const note = error ?? (def.help ? L.t(def.help) : undefined);

  const header = (
    <div className="flex items-baseline justify-between gap-2">
      <span id={`${id}-label`} className="text-[13px] font-semibold">
        {label}
        {def.required ? <span className="ml-0.5 text-danger" aria-hidden>*</span> : null}
      </span>
      {!def.required ? <span className="text-[12px] text-subtle">{L.t("İsteğe bağlı")}</span> : null}
    </div>
  );
  const footer = note ? (
    <p id={noteId} className={cn("text-[12px]", error ? "font-medium text-danger" : "text-muted")}>
      {note}
    </p>
  ) : null;

  if (def.type === "boolean") {
    return (
      <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-field border border-border-strong px-3.5">
        <span className="text-[14px] font-medium">{label}</span>
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked ? true : undefined)}
          className="h-5 w-5 accent-[var(--accent)]"
        />
      </label>
    );
  }

  if (def.type === "select" && def.options.length <= 6) {
    return (
      <div className="flex flex-col gap-2">
        {header}
        <div role="radiogroup" aria-labelledby={`${id}-label`} aria-describedby={note ? noteId : undefined} className="flex flex-wrap gap-2">
          {def.options.map((o) => (
            <Chip key={o.value} selected={value === o.value} onClick={() => onChange(value === o.value ? undefined : o.value)}>
              {L.option(o)}
            </Chip>
          ))}
        </div>
        {footer}
      </div>
    );
  }

  if (def.type === "multiselect") {
    const list = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div className="flex flex-col gap-2">
        {header}
        <div role="group" aria-labelledby={`${id}-label`} className="flex flex-wrap gap-2">
          {def.options.map((o) => {
            const on = list.includes(o.value);
            return (
              <Chip key={o.value} role="checkbox" selected={on} onClick={() => onChange(on ? list.filter((v) => v !== o.value) : [...list, o.value])}>
                {L.option(o)}
              </Chip>
            );
          })}
        </div>
        {footer}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id}>{header}</label>
      {def.type === "select" ? (
        <select
          id={id}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          aria-invalid={Boolean(error)}
          aria-describedby={note ? noteId : undefined}
          className={controlClass}
        >
          <option value="">{L.t("Seç")}</option>
          {def.options.map((o) => (
            <option key={o.value} value={o.value}>
              {L.option(o)}
            </option>
          ))}
        </select>
      ) : (
        <div className="relative">
          <input
            id={id}
            type="text"
            inputMode={def.type === "number" || def.type === "year" ? "decimal" : undefined}
            value={value == null ? "" : String(value)}
            onChange={(e) => onChange(e.target.value)}
            maxLength={def.type === "text" ? (def.maxLength ?? 100) : 12}
            placeholder={def.placeholder ? L.t(def.placeholder) : def.type === "year" ? "2022" : undefined}
            aria-invalid={Boolean(error)}
            aria-describedby={note ? noteId : undefined}
            className={cn(controlClass, def.unit && "pr-14")}
          />
          {def.unit ? <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] text-muted">{def.unit}</span> : null}
        </div>
      )}
      {footer}
    </div>
  );
}

/** Renders a set of attribute definitions, laid out in a responsive grid. */
export function AttributeFields({
  defs,
  values,
  onChange,
  errors = {},
}: {
  defs: AttributeDef[];
  values: Values;
  onChange: (key: string, value: unknown) => void;
  errors?: Record<string, string>;
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {defs.map((def) => (
        <div key={def.key} className={cn(def.type === "select" && def.options.length <= 6 ? "sm:col-span-2" : "", def.type === "multiselect" && "sm:col-span-2")}>
          <AttributeField def={def} value={values[def.key]} onChange={(v) => onChange(def.key, v)} error={errors[def.key]} />
        </div>
      ))}
    </div>
  );
}
