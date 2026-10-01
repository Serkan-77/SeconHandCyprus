// Category-specific listing attributes (db/migrations/0004).
//
// A category's attributes are the global ones (categoryId null), then each
// ancestor's from the root down, then its own. A definition lower in the tree
// replaces an inherited one with the same key; an inactive one hides it.
// Values are stored in listings.attributes keyed by attribute key.
//
// Used by the API (authoritative validation and filter parsing) and the web
// app (dynamic form, filters, specification table). No path aliases.

export type AttributeType = "text" | "number" | "select" | "multiselect" | "boolean" | "year";

export type AttributeOption = { value: string; label: string; label_en?: string };

export type AttributeDef = {
  id: number;
  categoryId: number | null;
  key: string;
  label: string;
  labelEn: string | null;
  type: AttributeType;
  unit: string | null;
  options: AttributeOption[];
  required: boolean;
  filterable: boolean;
  highlight: boolean;
  min: number | null;
  max: number | null;
  maxLength: number | null;
  placeholder: string | null;
  help: string | null;
  group: string;
  sortOrder: number;
  isActive: boolean;
};

export type AttributeValue = string | number | true | string[];
export type AttributeValues = Record<string, AttributeValue>;

const GROUP_ORDER = ["Genel", "Teknik", "Ölçü & Malzeme", "Özellikler", "Durum", "Teslimat"];
const GROUP_EN: Record<string, string> = {
  Genel: "General",
  Teknik: "Technical",
  "Ölçü & Malzeme": "Size & material",
  Özellikler: "Details",
  Durum: "Condition",
  Teslimat: "Delivery",
};

export function groupLabel(group: string, locale: "tr" | "en" = "tr") {
  return locale === "en" ? (GROUP_EN[group] ?? group) : group;
}

function groupRank(group: string) {
  const i = GROUP_ORDER.indexOf(group);
  return i === -1 ? GROUP_ORDER.length : i;
}

/**
 * Effective attributes for a category, given its ancestry from the root to
 * the category itself (e.g. [2, 1010] for Elektronik › Cep telefonu).
 */
export function effectiveAttributes(defs: AttributeDef[], chainRootToLeaf: number[]): AttributeDef[] {
  const byKey = new Map<string, AttributeDef>();
  const levels: (number | null)[] = [null, ...chainRootToLeaf];
  for (const level of levels) {
    for (const def of defs) {
      if (def.categoryId !== level) continue;
      if (def.isActive) byKey.set(def.key, def);
      else byKey.delete(def.key);
    }
  }
  return [...byKey.values()].sort(
    (a, b) => groupRank(a.group) - groupRank(b.group) || a.sortOrder - b.sortOrder || a.key.localeCompare(b.key),
  );
}

const TEXT_DEFAULT_MAX = 100;
const YEAR_MIN_DEFAULT = 1950;

function isEmpty(v: unknown) {
  return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
}

function label(def: AttributeDef, locale: "tr" | "en" = "tr") {
  return locale === "en" && def.labelEn ? def.labelEn : def.label;
}

/**
 * Checks raw input against the effective definitions. Unknown keys are
 * dropped, empty values and unticked boxes are not stored, and every error
 * is a sentence meant for the seller.
 */
export function validateAttributes(
  defs: AttributeDef[],
  input: Record<string, unknown> | null | undefined,
  { now = new Date() }: { now?: Date } = {},
): { values: AttributeValues; errors: Record<string, string> } {
  const values: AttributeValues = {};
  const errors: Record<string, string> = {};
  const raw = input && typeof input === "object" && !Array.isArray(input) ? input : {};

  for (const def of defs) {
    const v = raw[def.key];
    if (isEmpty(v) || (def.type === "boolean" && (v === false || v === "false" || v === "0"))) {
      if (def.required) errors[def.key] = `${def.label} alanını doldur.`;
      continue;
    }
    switch (def.type) {
      case "text": {
        if (typeof v !== "string" && typeof v !== "number") {
          errors[def.key] = `${def.label} geçersiz.`;
          break;
        }
        const s = String(v).replace(/\s+/g, " ").trim();
        const max = def.maxLength ?? TEXT_DEFAULT_MAX;
        if (!s) {
          if (def.required) errors[def.key] = `${def.label} alanını doldur.`;
        } else if (s.length > max) errors[def.key] = `${def.label} en fazla ${max} karakter olabilir.`;
        else values[def.key] = s;
        break;
      }
      case "number":
      case "year": {
        const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(",", ".").trim()) : NaN;
        const min = def.min ?? (def.type === "year" ? YEAR_MIN_DEFAULT : null);
        const max = def.type === "year" ? Math.min(def.max ?? Infinity, now.getFullYear() + 1) : def.max;
        if (!Number.isFinite(n) || (def.type === "year" && !Number.isInteger(n))) {
          errors[def.key] = `${def.label} için geçerli bir sayı gir.`;
        } else if ((min != null && n < min) || (max != null && n > max)) {
          errors[def.key] =
            min != null && max != null && Number.isFinite(max)
              ? `${def.label} ${min} ile ${max} arasında olmalı.`
              : `${def.label} geçersiz.`;
        } else values[def.key] = Math.round(n * 100) / 100;
        break;
      }
      case "select": {
        // One value only: String(["a"]) would otherwise pass as "a".
        const s = typeof v === "string" || typeof v === "number" ? String(v) : null;
        if (s === null || !def.options.some((o) => o.value === s)) errors[def.key] = `${def.label} için listeden bir seçenek seç.`;
        else values[def.key] = s!;
        break;
      }
      case "multiselect": {
        const list = (Array.isArray(v) ? v : String(v).split(",")).map(String).filter(Boolean);
        const allowed = new Set(def.options.map((o) => o.value));
        if (list.some((s) => !allowed.has(s))) errors[def.key] = `${def.label} için listeden seçim yap.`;
        else if (list.length) values[def.key] = [...new Set(list)];
        else if (def.required) errors[def.key] = `${def.label} alanını doldur.`;
        break;
      }
      case "boolean": {
        if (v === true || v === "true" || v === "1" || v === "on") values[def.key] = true;
        else errors[def.key] = `${def.label} geçersiz.`;
        break;
      }
    }
  }
  return { values, errors };
}

function optionLabel(def: AttributeDef, value: string, locale: "tr" | "en") {
  const o = def.options.find((x) => x.value === value);
  if (!o) return value;
  return locale === "en" && o.label_en ? o.label_en : o.label;
}

/** A stored value as text for the listing page ("256 GB", "Evet", "Kargo, Elden"). */
export function formatAttributeValue(def: AttributeDef, value: unknown, locale: "tr" | "en" = "tr"): string | null {
  if (isEmpty(value)) return null;
  switch (def.type) {
    case "boolean":
      return value === true ? (locale === "en" ? "Yes" : "Var") : null;
    case "select":
      return optionLabel(def, String(value), locale);
    case "multiselect":
      return (Array.isArray(value) ? value : [value]).map((v) => optionLabel(def, String(v), locale)).join(", ");
    case "number": {
      const n = Number(value);
      if (!Number.isFinite(n)) return null;
      const text = n.toLocaleString(locale === "en" ? "en-GB" : "tr-TR", { maximumFractionDigits: 2 });
      return def.unit ? (def.unit === "%" ? `%${text}` : `${text} ${def.unit}`) : text;
    }
    case "year":
      return String(value);
    default:
      return String(value);
  }
}

export type SpecGroup = { group: string; rows: { key: string; label: string; value: string }[] };

/** Filled attributes, grouped and ordered, for the specification table. */
export function specificationGroups(
  defs: AttributeDef[],
  values: Record<string, unknown> | null | undefined,
  locale: "tr" | "en" = "tr",
): SpecGroup[] {
  const groups: SpecGroup[] = [];
  for (const def of defs) {
    const text = formatAttributeValue(def, values?.[def.key], locale);
    if (!text) continue;
    // Boolean rows read as the label itself ("Faturası var") → "Evet".
    const row = { key: def.key, label: label(def, locale), value: def.type === "boolean" ? (locale === "en" ? "Yes" : "Evet") : text };
    const name = groupLabel(def.group, locale);
    let g = groups.find((x) => x.group === name);
    if (!g) groups.push((g = { group: name, rows: [] }));
    g.rows.push(row);
  }
  return groups;
}

/** Short facts for listing cards: the highlighted attributes that are filled. */
export function highlightFacts(defs: AttributeDef[], values: Record<string, unknown> | null | undefined, locale: "tr" | "en" = "tr", limit = 3) {
  const out: string[] = [];
  for (const def of defs) {
    if (!def.highlight || def.type === "boolean") continue;
    const text = formatAttributeValue(def, values?.[def.key], locale);
    if (text) out.push(text);
    if (out.length >= limit) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Filters in URLs: a.<key>=v1,v2 (select/multiselect: any of), a.<key>=1
// (boolean), a.<key>.min / a.<key>.max (number/year).
// ---------------------------------------------------------------------------

export type AttributeFilter =
  | { key: string; kind: "in"; values: string[] }
  | { key: string; kind: "true" }
  | { key: string; kind: "range"; min: number | null; max: number | null };

const MAX_FILTER_VALUES = 20;

export function parseAttributeFilters(
  defs: AttributeDef[],
  params: Record<string, string | string[] | undefined>,
): AttributeFilter[] {
  const filters: AttributeFilter[] = [];
  const get = (name: string) => {
    const v = params[name];
    return Array.isArray(v) ? v[0] : v;
  };
  for (const def of defs) {
    if (!def.filterable) continue;
    const base = `a.${def.key}`;
    if (def.type === "select" || def.type === "multiselect") {
      const raw = get(base);
      if (!raw) continue;
      const allowed = new Set(def.options.map((o) => o.value));
      const values = raw.split(",").filter((v) => allowed.has(v)).slice(0, MAX_FILTER_VALUES);
      if (values.length) filters.push({ key: def.key, kind: "in", values });
    } else if (def.type === "boolean") {
      if (get(base) === "1") filters.push({ key: def.key, kind: "true" });
    } else if (def.type === "number" || def.type === "year") {
      const num = (s: string | undefined) => (s != null && s !== "" && Number.isFinite(Number(s)) ? Number(s) : null);
      const min = num(get(`${base}.min`));
      const max = num(get(`${base}.max`));
      if (min != null || max != null) filters.push({ key: def.key, kind: "range", min, max });
    }
  }
  return filters;
}

/** The same filters back as URL parameters (for links and canonical checks). */
export function attributeFilterParams(filters: AttributeFilter[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of filters) {
    if (f.kind === "in") out[`a.${f.key}`] = f.values.join(",");
    else if (f.kind === "true") out[`a.${f.key}`] = "1";
    else {
      if (f.min != null) out[`a.${f.key}.min`] = String(f.min);
      if (f.max != null) out[`a.${f.key}.max`] = String(f.max);
    }
  }
  return out;
}
