"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { CONDITIONS, CURRENCIES, firstError, listingDetailsSchema, phoneSchema, profileSchema, storeSchema } from "@/lib/validation";
import { deleteUserAsAdmin } from "@/lib/accountDeletion";
import type { ListingDetails } from "@/lib/listingDetails";
import { regionNames } from "@/lib/regions";

type Result = { error?: string; ok?: boolean; count?: number };

// Every admin write is also enforced by RLS (`is_admin()`); this check only
// produces a friendlier error before hitting the database.
async function admin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, ok: false as const };
  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return { supabase, user, ok: data?.role === "admin" };
}

const DENIED = { error: "Bu işlem için yönetici yetkisi gerekiyor." };

export async function approveListing(id: string): Promise<Result> {
  const { supabase, ok } = await admin();
  if (!ok) return DENIED;
  const { data, error } = await supabase
    .from("listings")
    .update({ status: "active", reject_reason: null })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) return { error: "İlan onaylanamadı. Sayfayı yenileyip tekrar dene." };
  refresh();
  return { ok: true };
}

export async function rejectListing(id: string, reason: string, note: string): Promise<Result> {
  const { supabase, ok } = await admin();
  if (!ok) return DENIED;
  const text = note.trim() ? `${reason}. ${note.trim()}` : reason;
  const { data, error } = await supabase
    .from("listings")
    .update({ status: "rejected", reject_reason: text })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) return { error: "İlan reddedilemedi. Sayfayı yenileyip tekrar dene." };
  refresh();
  return { ok: true };
}

const ADMIN_STATUSES = ["draft", "pending", "active", "rejected", "sold", "removed"] as const;

const adminListingSchema = z.object({
  title: z.string().trim().min(3, "Başlık en az 3 karakter olmalı.").max(120, "Başlık en fazla 120 karakter olabilir."),
  categoryId: z.number({ error: "Kategori seç." }).int().positive("Kategori seç."),
  price: z
    .string()
    .trim()
    .min(1, "Geçerli bir fiyat gir.")
    .pipe(
      z.coerce
        .number<string>({ error: "Geçerli bir fiyat gir." })
        .refine(Number.isFinite, "Geçerli bir fiyat gir.")
        .min(0, "Fiyat negatif olamaz.")
        .max(10_000_000, "Fiyat çok yüksek."),
    ),
  currency: z.enum(CURRENCIES, { error: "Para birimini seç." }),
  condition: z.enum(CONDITIONS, { error: "Ürün durumunu seç." }),
  city: z.enum(regionNames as [string, ...string[]], { error: "Listeden bir bölge seç." }),
  district: z
    .string()
    .trim()
    .max(60, "Semt en fazla 60 karakter olabilir.")
    .transform((v) => v || null),
  description: z.string().trim().max(5000, "Açıklama en fazla 5000 karakter olabilir."),
  negotiable: z.boolean(),
  status: z.enum(ADMIN_STATUSES, { error: "Geçersiz ilan durumu." }),
  details: listingDetailsSchema,
});

/** Admins may change every field of any listing, including its status. */
export async function adminUpdateListing(
  id: string,
  fields: {
    title: string;
    categoryId: number;
    price: string;
    currency: string;
    condition: string;
    city: string;
    district: string;
    description: string;
    negotiable: boolean;
    status: string;
    details: ListingDetails;
  },
): Promise<Result> {
  const { supabase, ok } = await admin();
  if (!ok) return DENIED;
  const parsed = adminListingSchema.safeParse(fields);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const v = parsed.data;
  const { data, error } = await supabase
    .from("listings")
    .update({
      title: v.title,
      category_id: v.categoryId,
      price: v.price,
      currency: v.currency,
      condition: v.condition,
      city: v.city,
      district: v.district,
      description: v.description,
      negotiable: v.negotiable,
      status: v.status,
      details: v.details,
      ...(v.status === "active" ? { reject_reason: null } : {}),
    })
    .eq("id", id)
    .select("id");
  if (error) return { error: "Değişiklikler kaydedilemedi." };
  if (!data?.length) return { error: "İlan bulunamadı." };
  refresh();
  return { ok: true };
}

/** Deletes a listing and its photo files; conversations about it stay (0012). */
export async function adminDeleteListing(id: string): Promise<Result> {
  const { supabase, ok } = await admin();
  if (!ok) return DENIED;
  const { data: images } = await supabase.from("listing_images").select("path").eq("listing_id", id);
  const { data, error } = await supabase.from("listings").delete().eq("id", id).select("id");
  if (error) return { error: "İlan silinemedi." };
  if (!data?.length) return { error: "İlan bulunamadı." };
  const paths = (images ?? []).map((i) => i.path).filter((p) => !p.startsWith("http"));
  if (paths.length) await supabase.storage.from("listing-images").remove(paths);
  redirect("/yonetim/ilanlar?durum=hepsi");
}

export async function adminRemoveListingImage(imageId: string): Promise<Result> {
  const { supabase, ok } = await admin();
  if (!ok) return DENIED;
  const { data: image } = await supabase.from("listing_images").select("path").eq("id", imageId).maybeSingle();
  if (!image) return { error: "Fotoğraf bulunamadı." };
  const { data, error } = await supabase.from("listing_images").delete().eq("id", imageId).select("id");
  if (error || !data?.length) return { error: "Fotoğraf kaldırılamadı." };
  if (!image.path.startsWith("http")) await supabase.storage.from("listing-images").remove([image.path]);
  refresh();
  return { ok: true };
}

export type AdminUserInput = {
  name: string;
  region: string;
  bio: string;
  phone: string;
  phoneVerified: boolean;
  role: "user" | "admin";
  accountType: "personal" | "store";
  store: { storeName: string; address: string; phone: string; website: string; hours: string };
  storeVerified: boolean;
};

/** Edits any profile: public fields, contact phone, role and store details. */
export async function adminUpdateUser(userId: string, input: AdminUserInput): Promise<Result> {
  const { supabase, user, ok } = await admin();
  if (!ok || !user) return DENIED;
  if (userId === user.id && input.role !== "admin") return { error: "Kendi yönetici yetkini kaldıramazsın." };
  const profile = profileSchema.safeParse({ name: input.name, region: input.region, bio: input.bio });
  if (!profile.success) return { error: firstError(profile.error) };
  let phone: string | null = null;
  if (input.phone.trim()) {
    const parsedPhone = phoneSchema.safeParse(input.phone);
    if (!parsedPhone.success) return { error: firstError(parsedPhone.error) };
    phone = parsedPhone.data;
  }
  const isStore = input.accountType === "store";
  const store = isStore ? storeSchema.safeParse(input.store) : null;
  if (store && !store.success) return { error: firstError(store.error) };
  const storeData = store?.success ? store.data : null;

  const { data: updated, error } = await supabase
    .from("profiles")
    .update({
      display_name: profile.data.name,
      region: profile.data.region,
      bio: profile.data.bio ?? null,
      role: input.role === "admin" ? "admin" : "user",
      account_type: isStore ? "store" : "personal",
      store_name: storeData?.storeName ?? null,
      store_address: storeData?.address ?? null,
      store_phone: storeData?.phone ?? null,
      store_website: storeData?.website ?? null,
      store_hours: storeData?.hours ?? null,
      store_verified: isStore && input.storeVerified,
    })
    .eq("id", userId)
    .select("id");
  if (error) return { error: "Profil kaydedilemedi." };
  if (!updated?.length) return { error: "Kullanıcı bulunamadı." };
  const { error: contactError } = await supabase
    .from("profile_private")
    .update({ phone, ...(phone ? {} : { whatsapp_enabled: false }) })
    .eq("id", userId);
  if (contactError) return { error: "Telefon kaydedilemedi." };
  // A phone change resets the flag in the database (0007), so set it after.
  const { error: flagError } = await supabase
    .from("profiles")
    .update({ phone_verified: Boolean(phone) && input.phoneVerified })
    .eq("id", userId);
  if (flagError) return { error: "Telefon inceleme durumu kaydedilemedi." };
  refresh();
  return { ok: true };
}

/** Deletes another user's account, their files first (admin_delete_user, 0014). */
export async function adminDeleteUser(userId: string): Promise<Result> {
  const { supabase, user, ok } = await admin();
  if (!ok || !user) return DENIED;
  if (userId === user.id) return { error: "Kendi hesabını buradan silemezsin." };
  const result = await deleteUserAsAdmin(supabase, userId);
  if (result.error) return { error: result.error };
  redirect("/yonetim/kullanicilar");
}

export async function adminDeleteRating(id: string): Promise<Result> {
  const { supabase, ok } = await admin();
  if (!ok) return DENIED;
  const { data, error } = await supabase.from("ratings").delete().eq("id", id).select("id");
  if (error || !data?.length) return { error: "Değerlendirme silinemedi." };
  refresh();
  return { ok: true };
}

const sanctionMap: Record<string, { kind: string; days?: number }> = {
  Uyar: { kind: "warn" },
  "Geçici kısıtla (7 gün)": { kind: "restrict", days: 7 },
  "Hesabı askıya al": { kind: "suspend" },
  "Kısıtlamayı kaldır": { kind: "lift" },
};

export async function applySanction(userId: string, label: string, reason: string): Promise<Result> {
  const { supabase, user, ok } = await admin();
  if (!ok || !user) return DENIED;
  const sanction = sanctionMap[label];
  if (!sanction) return { error: "Geçersiz yaptırım türü." };
  if (reason.trim().length < 5) return { error: "Gerekçe en az 5 karakter olmalı." };
  const { error } = await supabase.from("sanctions").insert({
    user_id: userId,
    kind: sanction.kind,
    reason: reason.trim(),
    created_by: user.id,
    expires_at: sanction.days ? new Date(Date.now() + sanction.days * 86400000).toISOString() : null,
  });
  if (error) return { error: "Yaptırım uygulanamadı." };
  refresh();
  return { ok: true };
}

export async function setReportStatus(id: string, status: "reviewing" | "resolved", note?: string): Promise<Result> {
  const { supabase, ok } = await admin();
  if (!ok) return DENIED;
  const { error } = await supabase
    .from("reports")
    .update({
      status,
      ...(status === "resolved" ? { resolution_note: note?.trim() || null, resolved_at: new Date().toISOString() } : {}),
    })
    .eq("id", id);
  if (error) return { error: "Şikayet güncellenemedi." };
  refresh();
  return { ok: true };
}

export async function resolveVerification(id: string, approve: boolean): Promise<Result> {
  const { supabase, ok } = await admin();
  if (!ok) return DENIED;
  const { error } = await supabase
    .from("verification_requests")
    .update({ status: approve ? "approved" : "rejected", resolved_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: "Talep güncellenemedi." };
  refresh();
  return { ok: true };
}

export async function saveCategory(input: { id?: number; name: string; icon: string; sortOrder: number }): Promise<Result> {
  const { supabase, ok } = await admin();
  if (!ok) return DENIED;
  const name = input.name.trim();
  if (name.length < 2) return { error: "Kategori adı en az 2 karakter olmalı." };
  const slug = name
    .toLocaleLowerCase("tr-TR")
    .replace(/[çğıöşü]/g, (c) => ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" })[c] ?? c)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (!input.id && !slug) return { error: "Kategori adında en az bir harf ya da rakam olmalı." };
  const row = { name, icon: input.icon, sort_order: input.sortOrder };
  const { error } = input.id
    ? await supabase.from("categories").update(row).eq("id", input.id)
    : await supabase.from("categories").insert({ ...row, slug });
  if (error) return { error: error.message.includes("duplicate") ? "Bu kategori zaten var." : "Kategori kaydedilemedi." };
  refresh();
  return { ok: true };
}

export async function deleteCategory(id: number): Promise<Result> {
  const { supabase, ok } = await admin();
  if (!ok) return DENIED;
  const { count } = await supabase.from("listings").select("id", { count: "exact", head: true }).eq("category_id", id);
  if ((count ?? 0) > 0) return { error: "Bu kategoride ilanlar var; önce ilanları taşı." };
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return { error: "Kategori silinemedi." };
  refresh();
  return { ok: true };
}

// Editorial "showcase" pick. Featured listings sort first; nothing is sold.
export async function setFeatured(id: string, featured: boolean): Promise<Result> {
  const { supabase, ok } = await admin();
  if (!ok) return DENIED;
  const { data, error } = await supabase.from("listings").update({ featured }).eq("id", id).select("id");
  if (error || !data?.length) return { error: "Vitrin durumu güncellenemedi." };
  refresh();
  return { ok: true };
}

export async function sendAnnouncement(audience: string, title: string, body: string): Promise<Result> {
  const { supabase, ok } = await admin();
  if (!ok) return DENIED;
  const { data, error } = await supabase.rpc("send_announcement", {
    p_audience: audience,
    p_title: title,
    p_body: body,
  });
  if (error) return { error: "Duyuru gönderilemedi." };
  refresh();
  return { ok: true, count: Number(data ?? 0) };
}
