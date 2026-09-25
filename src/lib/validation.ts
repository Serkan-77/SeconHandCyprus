// Server-side input validation (P1-06) and marketplace limits (P1-05).
//
// Server actions validate with these schemas; the database enforces the same
// limits with CHECK constraints and triggers (migration 0009), so a request
// that skips the app (direct API call) is held to the same rules.
// No "@/" imports: tested directly with node --test.
import { z } from "zod";
import { regionNames } from "./regions.ts";

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
});

export const profileSchema = z.object({
  name: text(LIMITS.displayNameMin, LIMITS.displayNameMax, "Görünen ad"),
  region: z.union([city, z.literal("")]).transform((v) => v || null),
  bio: optionalText(LIMITS.bioMax, "Hakkımda").transform((v) => v || null).optional(),
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
