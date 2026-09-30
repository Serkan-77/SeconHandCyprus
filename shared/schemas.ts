// Request validation shared by the API and the web app. The API is
// authoritative; the web app uses the same schemas for inline feedback.
import { z } from "zod";
import { CONDITIONS, CURRENCIES, LIMITS, PHONE_PATTERN, REGION_NAMES } from "./constants.ts";

const text = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, min <= 1 ? `${label} boş olamaz.` : `${label} en az ${min} karakter olmalı.`)
    .max(max, `${label} en fazla ${max} karakter olabilir.`);

const optionalText = (max: number, label: string) =>
  z.string().trim().max(max, `${label} en fazla ${max} karakter olabilir.`);

const stripPhone = (v: string) => v.replace(/[\s()-]/g, "");

export const regionSchema = z.enum(REGION_NAMES as [string, ...string[]], { error: "Listeden bir bölge seç." });

// An empty string must not coerce to 0.
export const priceSchema = z
  .union([z.number(), z.string().trim().min(1, "Geçerli bir fiyat gir.")])
  .pipe(
    z.coerce
      .number<string | number>({ error: "Geçerli bir fiyat gir." })
      .refine(Number.isFinite, "Geçerli bir fiyat gir.")
      .min(0, "Fiyat negatif olamaz.")
      .max(LIMITS.priceMax, "Fiyat çok yüksek."),
  )
  .transform((v) => Math.round(v * 100) / 100);

const district = optionalText(LIMITS.districtMax, "Semt").transform((v) => v || null);

export const phoneSchema = z
  .string()
  .transform(stripPhone)
  .refine((v) => PHONE_PATTERN.test(v), "Geçerli bir telefon numarası gir.");

const optionalPhone = z
  .string()
  .transform(stripPhone)
  .refine((v) => !v || PHONE_PATTERN.test(v), "Geçerli bir telefon numarası gir.")
  .transform((v) => v || null);

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(LIMITS.emailMax, "E-posta adresi çok uzun.")
  .pipe(z.email("Geçerli bir e-posta adresi gir."));

// Common passwords rejected outright; length does the rest.
const WEAK_PASSWORDS = new Set([
  "12345678", "123456789", "1234567890", "password", "password1", "qwerty123", "11111111", "00000000",
  "iloveyou", "sifre123", "şifre123", "parola123", "123123123", "abcd1234", "qwertyuiop", "1q2w3e4r",
]);

export const passwordSchema = z
  .string()
  .min(LIMITS.passwordMin, `Şifre en az ${LIMITS.passwordMin} karakter olmalı.`)
  .max(LIMITS.passwordMax, `Şifre en fazla ${LIMITS.passwordMax} karakter olabilir.`)
  .refine((v) => !WEAK_PASSWORDS.has(v.toLowerCase()), "Bu şifre çok yaygın. Daha güçlü bir şifre seç.");

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: text(LIMITS.displayNameMin, LIMITS.displayNameMax, "Ad"),
  region: z
    .union([regionSchema, z.literal(""), z.null()])
    .optional()
    .transform((v) => v || null),
  phone: z.string().optional().transform((v) => v ?? "").pipe(optionalPhone),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Şifreni gir.").max(LIMITS.passwordMax, "Şifre çok uzun."),
});

export const listingCreateSchema = z.object({
  title: text(LIMITS.titleMin, LIMITS.titleMax, "Başlık"),
  categoryId: z.coerce.number<number | string>({ error: "Kategori seç." }).int().positive("Kategori seç."),
  condition: z.enum(CONDITIONS, { error: "Ürün durumunu seç." }),
  description: optionalText(LIMITS.descriptionMax, "Açıklama"),
  price: priceSchema,
  currency: z.enum(CURRENCIES, { error: "Para birimini seç." }),
  city: regionSchema,
  district: district.optional(),
  negotiable: z.boolean(),
  submissionKey: z.uuid({ error: "Sayfayı yenileyip tekrar dene." }),
  attributes: z.record(z.string(), z.unknown()).optional(),
  photos: z
    .array(z.string().min(1).max(300))
    .min(1, "En az 1 fotoğraf ekle.")
    .max(LIMITS.maxPhotos, `En fazla ${LIMITS.maxPhotos} fotoğraf ekleyebilirsin.`),
});

export const listingUpdateSchema = z.object({
  title: text(LIMITS.titleMin, LIMITS.titleMax, "Başlık"),
  price: priceSchema,
  currency: z.enum(CURRENCIES, { error: "Para birimini seç." }).optional(),
  condition: z.enum(CONDITIONS, { error: "Ürün durumunu seç." }).optional(),
  city: regionSchema,
  district: district.optional(),
  description: optionalText(LIMITS.descriptionMax, "Açıklama"),
  negotiable: z.boolean().optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
});

export const profileSchema = z.object({
  name: text(LIMITS.displayNameMin, LIMITS.displayNameMax, "Görünen ad"),
  region: z.union([regionSchema, z.literal(""), z.null()]).transform((v) => v || null),
  bio: optionalText(LIMITS.bioMax, "Hakkımda").transform((v) => v || null).optional(),
  /** Upload key of a new avatar, null to remove it, absent to keep it. */
  avatar: z.string().max(300).nullable().optional(),
});

/** Store profile; empty optional fields are stored as null. */
export const storeSchema = z.object({
  storeName: text(2, 60, "Mağaza adı"),
  address: optionalText(160, "Adres").transform((v) => v || null),
  phone: optionalPhone,
  website: z
    .string()
    .trim()
    .transform((v) => (v && !/^https?:\/\//i.test(v) ? `https://${v}` : v))
    .refine((v) => v.length <= 200, "Web adresi en fazla 200 karakter olabilir.")
    .refine((v) => !v || /^https?:\/\/[^\s.]+\.[^\s]+$/i.test(v), "Geçerli bir web adresi gir.")
    .transform((v) => v || null),
  hours: optionalText(80, "Çalışma saatleri").transform((v) => v || null),
});

export const contactSchema = z.object({
  phone: optionalPhone,
  whatsapp: z.boolean(),
});

export const messageSchema = text(1, LIMITS.messageMax, "Mesaj");

export const ratingSchema = z.object({
  score: z
    .number()
    .int("Puan 1 ile 5 arasında olmalı.")
    .min(1, "Puan 1 ile 5 arasında olmalı.")
    .max(5, "Puan 1 ile 5 arasında olmalı."),
  comment: optionalText(LIMITS.commentMax, "Yorum").transform((v) => v || null),
});

export const reportSchema = z.object({
  reason: text(1, LIMITS.reasonMax, "Şikayet nedeni"),
  detail: optionalText(LIMITS.detailMax, "Açıklama").transform((v) => v || null),
});

export const supportSchema = z.object({
  email: z
    .string()
    .trim()
    .max(LIMITS.emailMax, "E-posta adresi çok uzun.")
    .pipe(z.email("Geçerli bir e-posta adresi gir.")),
  topic: text(1, LIMITS.topicMax, "Konu"),
  message: text(LIMITS.supportMin, LIMITS.supportMax, "Mesajın"),
});

/** The first human-readable message of a failed parse. */
export function firstError(error: z.ZodError) {
  return error.issues[0]?.message ?? "Girdiğin bilgileri kontrol et.";
}
