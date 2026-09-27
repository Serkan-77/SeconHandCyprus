// Optional listing attributes (listings.details, migration 0014): what a buyer
// usually asks before messaging. Every field is optional; empty ones are not
// stored. No "@/" imports: tested directly with node --test.

export const DELIVERY_OPTIONS = ["Elden teslim", "Kargo ile gönderim", "Adrese teslim"] as const;
export const WARRANTY_OPTIONS = ["Garantisi devam ediyor", "Garantisi yok"] as const;

export type ListingDetails = {
  brand?: string;
  model?: string;
  color?: string;
  /** Year of purchase. */
  year?: number;
  warranty?: (typeof WARRANTY_OPTIONS)[number];
  invoice?: boolean;
  box?: boolean;
  exchange?: boolean;
  delivery?: (typeof DELIVERY_OPTIONS)[number][];
};

export const DETAIL_TEXT_MAX = 60;
export const DETAIL_YEAR_MIN = 1950;

/** Rows for the listing page, in a fixed order; unset fields are left out. */
export function detailRows(details: ListingDetails | null | undefined): [string, string][] {
  if (!details || typeof details !== "object") return [];
  const rows: [string, string | undefined][] = [
    ["Marka", details.brand],
    ["Model", details.model],
    ["Renk", details.color],
    ["Satın alma yılı", details.year ? String(details.year) : undefined],
    ["Garanti", details.warranty],
    ["Fatura", details.invoice === undefined ? undefined : details.invoice ? "Faturası var" : "Faturası yok"],
    ["Kutu / aksesuar", details.box === undefined ? undefined : details.box ? "Kutusu ve aksesuarları var" : "Yok"],
    ["Takas", details.exchange === undefined ? undefined : details.exchange ? "Takasa açık" : "Takas yok"],
    ["Teslimat", details.delivery?.length ? details.delivery.join(", ") : undefined],
  ];
  return rows.filter((row): row is [string, string] => Boolean(row[1]));
}
