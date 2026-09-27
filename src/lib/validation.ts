// Server-side input validation (P1-06) and marketplace limits (P1-05).
//
// Server actions validate with these schemas; the database enforces the same
// limits with CHECK constraints and triggers (migration 0009), so a request
// that skips the app (direct API call) is held to the same rules.
// No "@/" imports: tested directly with node --test.
import { z } from "zod";
import { regionNames } from "./regions.ts";
import { DELIVERY_OPTIONS, DETAIL_TEXT_MAX, DETAIL_YEAR_MIN, WARRANTY_OPTIONS } from "./listingDetails.ts";

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
  /** Photos per listing (DB trigger listing_images_limit). */
  maxPhotos: 10,
  /** Draft + pending + active listings per seller (DB trigger listings_quota). */
  maxOpenListings: 50,
  /** New listings per seller per 24 hours (DB trigger listings_quota). */
  maxNewListingsPerDay: 10,
} as const;

export const CONDITIONS = ["Sıfır", "Az kullanılmış", "Yıpranmış"] as const;
export const CURRENCIES = ["TL", "€"] as const;
const PHONE = /^\+?[0-9]{10,15}$/;

const text = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, min <= 1 ? `${label} boş olamaz.` : `${label} en az ${min} karakter olmalı.`)
    .max(max, `${label} en fazla ${max} karakter olabilir.`);
const optionalText = (max: number, label: string) => z.string().trim().max(max, `${label} en fazla ${max} karakter olabilir.`);
const city = z.enum(regionNames as [string, ...string[]], { error: "Listeden bir bölge seç." });
// An empty string must not coerce to 0.
const price = z
  .union([z.number(), z.string().trim().min(1, "Geçerli bir fiyat gir.")])
  .pipe(
    z.coerce
      .number<string | number>({ error: "Geçerli bir fiyat gir." })
      .refine(Number.isFinite, "Geçerli bir fiyat gir.")
      .min(0, "Fiyat negatif olamaz.")
      .max(LIMITS.priceMax, "Fiyat çok yüksek."),
  );
const district = optionalText(LIMITS.districtMax, "Semt").transform((v) => v || null);

export const phoneSchema = z
  .string()
  .transform((v) => v.replace(/\s/g, ""))
  .refine((v) => PHONE.test(v), "Geçerli bir telefon numarası gir.");

// Empty strings and unticked boxes are dropped, so only what the seller
// filled in is stored (listings.details, migration 0014).
const detailText = (label: string) =>
  optionalText(DETAIL_TEXT_MAX, label)
    .optional()
    .transform((v) => v || undefined);
const detailFlag = z
  .boolean()
  .optional()
  .transform((v) => v || undefined);

export const listingDetailsSchema = z
  .object({
    brand: detailText("Marka"),
    model: detailText("Model"),
    color: detailText("Renk"),
    year: z
      .union([z.number(), z.string().trim()])
      .optional()
      .transform((v, ctx) => {
        if (v === undefined || v === "") return undefined;
        const year = Number(v);
        if (!Number.isInteger(year) || year < DETAIL_YEAR_MIN || year > new Date().getFullYear()) {
          ctx.addIssue({ code: "custom", message: "Geçerli bir satın alma yılı gir." });
          return z.NEVER;
        }
        return year;
      }),
    warranty: z
      .union([z.enum(WARRANTY_OPTIONS), z.literal("")])
      .optional()
      .transform((v) => v || undefined),
    invoice: detailFlag,
    box: detailFlag,
    exchange: detailFlag,
    delivery: z
      .array(z.enum(DELIVERY_OPTIONS))
      .optional()
      .transform((v) => (v?.length ? [...new Set(v)] : undefined)),
  })
  .transform((d) => Object.fromEntries(Object.entries(d).filter(([, v]) => v !== undefined)));

export const listingCreateSchema = z.object({
  title: text(LIMITS.titleMin, LIMITS.titleMax, "Başlık"),
  categorySlug: z.string().trim().min(1, "Kategori seç."),
  condition: z.enum(CONDITIONS, { error: "Ürün durumunu seç." }),
  description: optionalText(LIMITS.descriptionMax, "Açıklama"),
  price,
  currency: z.enum(CURRENCIES, { error: "Para birimini seç." }),
  city,
  district: district.optional(),
  negotiable: z.boolean(),
  submissionKey: z.uuid({ error: "Sayfayı yenileyip tekrar dene." }),
  details: listingDetailsSchema.optional(),
  photos: z
    .array(z.string().min(1))
    .min(1, "En az 1 fotoğraf ekle.")
    .max(LIMITS.maxPhotos, `En fazla ${LIMITS.maxPhotos} fotoğraf ekleyebilirsin.`),
});

export const listingUpdateSchema = z.object({
  title: text(LIMITS.titleMin, LIMITS.titleMax, "Başlık"),
  price,
  city,
  district: district.optional(),
  description: optionalText(LIMITS.descriptionMax, "Açıklama"),
  negotiable: z.boolean().optional(),
  details: listingDetailsSchema.optional(),
});

export const profileSchema = z.object({
  name: text(LIMITS.displayNameMin, LIMITS.displayNameMax, "Görünen ad"),
  region: z.union([city, z.literal("")]).transform((v) => v || null),
  bio: optionalText(LIMITS.bioMax, "Hakkımda").transform((v) => v || null).optional(),
});

/** Store profile (migration 0014); empty optional fields are stored as null. */
export const storeSchema = z.object({
  storeName: text(2, 60, "Mağaza adı"),
  address: optionalText(160, "Adres").transform((v) => v || null),
  phone: z
    .string()
    .transform((v) => v.replace(/\s/g, ""))
    .refine((v) => !v || PHONE.test(v), "Geçerli bir telefon numarası gir.")
    .transform((v) => v || null),
  website: z
    .string()
    .trim()
    .transform((v) => (v && !/^https?:\/\//i.test(v) ? `https://${v}` : v))
    .refine((v) => v.length <= 200, "Web adresi en fazla 200 karakter olabilir.")
    .refine((v) => !v || /^https?:\/\/[^\s.]+\.[^\s]+$/i.test(v), "Geçerli bir web adresi gir.")
    .transform((v) => v || null),
  hours: optionalText(80, "Çalışma saatleri").transform((v) => v || null),
});

export const messageSchema = text(1, LIMITS.messageMax, "Mesaj");

export const ratingSchema = z.object({
  score: z.number().int("Puan 1 ile 5 arasında olmalı.").min(1, "Puan 1 ile 5 arasında olmalı.").max(5, "Puan 1 ile 5 arasında olmalı."),
  comment: optionalText(LIMITS.commentMax, "Yorum").transform((v) => v || null),
});

export const reportSchema = z.object({
  reason: text(1, LIMITS.reasonMax, "Şikayet nedeni"),
  detail: optionalText(LIMITS.detailMax, "Açıklama").transform((v) => v || null),
});

export const supportSchema = z.object({
  email: z.string().trim().max(LIMITS.emailMax, "E-posta adresi çok uzun.").pipe(z.email("Geçerli bir e-posta adresi gir.")),
  topic: text(1, LIMITS.topicMax, "Konu"),
  message: text(LIMITS.supportMin, LIMITS.supportMax, "Mesajın"),
});

/** The first human-readable message of a failed parse. */
export function firstError(error: z.ZodError) {
  return error.issues[0]?.message ?? "Girdiğin bilgileri kontrol et.";
}
