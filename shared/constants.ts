// Marketplace rules shared by the API (authoritative) and the web app (early
// feedback). The database enforces the same numbers with CHECK constraints and
// triggers (db/migrations/0001_baseline.sql), so a request that skips both is
// still held to them. No path aliases: imported by the API bundle, the web app
// and node --test directly.

export const LIMITS = {
  titleMin: 3,
  titleMax: 120,
  descriptionMax: 5000,
  districtMax: 60,
  priceMax: 10_000_000,
  displayNameMin: 2,
  displayNameMax: 40,
  bioMax: 500,
  messageMax: 2000,
  commentMax: 500,
  reasonMax: 100,
  detailMax: 1000,
  topicMax: 60,
  supportMin: 10,
  supportMax: 5000,
  emailMax: 254,
  passwordMin: 8,
  passwordMax: 128,
  /** Photos per listing (DB trigger listing_images_limit). */
  maxPhotos: 10,
  /** Draft + pending + active listings per seller (DB trigger listings_quota). */
  maxOpenListings: 50,
  /** New listings per seller per 24 hours (DB trigger listings_quota). */
  maxNewListingsPerDay: 10,
  /** Upload size before processing. */
  uploadMaxBytes: 12 * 1024 * 1024,
} as const;

export const CONDITIONS = ["Sıfır", "Az kullanılmış", "Yıpranmış"] as const;
export type Condition = (typeof CONDITIONS)[number];

export const CONDITION_INFO: Record<Condition, { en: string; hint: string; hintEn: string }> = {
  Sıfır: {
    en: "New",
    hint: "Hiç kullanılmamış; kutusu ya da etiketi duruyor olabilir.",
    hintEn: "Never used; may still have its box or tags.",
  },
  "Az kullanılmış": {
    en: "Lightly used",
    hint: "Kullanılmış ama bakımlı; küçük kullanım izleri olabilir.",
    hintEn: "Used and well kept; may show small signs of use.",
  },
  Yıpranmış: {
    en: "Well used",
    hint: "Belirgin kullanım izleri var; açıklamada anlat.",
    hintEn: "Clear signs of use; describe them in the description.",
  },
};

export const CURRENCIES = ["TL", "€"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const LISTING_STATUSES = ["draft", "pending", "active", "rejected", "sold", "removed"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const PHONE_PATTERN = /^\+?[0-9]{10,15}$/;

export const REGIONS = [
  { name: "Lefkoşa", slug: "lefkosa", side: "north", lat: 35.1856, lng: 33.3823 },
  { name: "Girne", slug: "girne", side: "north", lat: 35.3364, lng: 33.3199 },
  { name: "Gazimağusa", slug: "gazimagusa", side: "north", lat: 35.125, lng: 33.9417 },
  { name: "Güzelyurt", slug: "guzelyurt", side: "north", lat: 35.1983, lng: 32.9936 },
  { name: "İskele", slug: "iskele", side: "north", lat: 35.2869, lng: 33.8911 },
  { name: "Larnaka", slug: "larnaka", side: "south", lat: 34.9167, lng: 33.6233 },
  { name: "Limasol", slug: "limasol", side: "south", lat: 34.6841, lng: 33.0379 },
  { name: "Baf", slug: "baf", side: "south", lat: 34.7754, lng: 32.4245 },
] as const;

export const REGION_NAMES: string[] = REGIONS.map((r) => r.name);

export const SORTS = ["yeni", "artan", "azalan"] as const;
export type Sort = (typeof SORTS)[number];

/** Report reasons offered in the UI (free text is still validated by length). */
export const REPORT_REASONS = [
  "Dolandırıcılık şüphesi",
  "Yanlış kategori",
  "Yasaklı ürün",
  "Uygunsuz içerik",
  "Sahte / replika ürün",
  "İlan zaten satıldı",
  "Diğer",
] as const;
