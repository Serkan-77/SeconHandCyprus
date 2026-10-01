// Search URLs. Public URLs keep the Turkish parameter names that existing
// links and the search index already use; the API takes English names.
//
//   q          words                      sehir   city (comma list)
//   durum      conditions (comma list)    min/max price
//   birim      currency (TL | €)          tarih   1 | 7 | 30 days
//   pazarlik   1 = negotiable only        sirala  yeni | artan | azalan
//   magaza     1 = stores only            vitrin  1 = showcase only
//   sayfa      page                       a.<key>[.min|.max]  attribute filters

export type WebParams = Record<string, string | string[] | undefined>;

const MAP: Record<string, string> = {
  q: "q",
  sehir: "city",
  durum: "condition",
  min: "min",
  max: "max",
  birim: "currency",
  tarih: "since",
  pazarlik: "negotiable",
  sirala: "sort",
  magaza: "stores",
  vitrin: "featured",
  sayfa: "page",
};

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v.join(",") : v;
}

/** API query parameters for a results page. */
export function toApiQuery(params: WebParams, categorySlug?: string, pageSize = 24) {
  const out = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const v = first(value);
    if (!v) continue;
    if (key in MAP) out.set(MAP[key], v);
    else if (/^a\.[a-z][a-z0-9_]{1,39}(\.(min|max))?$/.test(key)) out.set(key, v.slice(0, 200));
  }
  if (categorySlug) out.set("category", categorySlug);
  out.set("pageSize", String(pageSize));
  out.set("facets", "1");
  return out;
}

/** Only category, a single city and the page are worth indexing; every other combination is noindex,follow. */
export function isIndexable(params: WebParams) {
  return Object.entries(params).every(([k, v]) => {
    if (v == null || v === "") return true;
    if (k === "sayfa") return true;
    if (k === "sehir") return !String(first(v)).includes(",");
    return false;
  });
}

/** A results URL with some parameters changed (undefined/"" removes one). Changing a filter resets the page. */
export function resultsHref(base: string, params: WebParams, changes: Record<string, string | undefined> = {}) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    const value = first(v);
    if (value && k !== "kategori") sp.set(k, value);
  }
  const touchesFilter = Object.keys(changes).some((k) => k !== "sayfa");
  if (touchesFilter) sp.delete("sayfa");
  for (const [k, v] of Object.entries(changes)) {
    if (v === undefined || v === "") sp.delete(k);
    else sp.set(k, v);
  }
  if (sp.get("sayfa") === "1") sp.delete("sayfa");
  const qs = sp.toString();
  return qs ? `${base}?${qs}` : base;
}

export function listValue(params: WebParams, key: string): string[] {
  const v = first(params[key]);
  return v ? v.split(",").filter(Boolean) : [];
}
