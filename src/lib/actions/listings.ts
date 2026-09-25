"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { error?: string; ok?: boolean };
/** review: an approved listing's content changed, so it went back to moderation (P1-01). */
type EditResult = Result & { review?: boolean };

// RLS turns an update the user may not make (e.g. while their account is
// restricted) into "0 rows" rather than an error; report it as one.
const NOT_EDITABLE = "Bu ilanı şu anda düzenleyemezsin. Hesabın kısıtlı olabilir.";

async function listingStatus(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
  const { data } = await supabase.from("listings").select("status").eq("id", id).maybeSingle();
  return (data?.status as string | undefined) ?? null;
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

function dbError(message: string) {
  if (message.includes("row-level security")) return "Bu işlem için yetkin yok ya da hesabın kısıtlı.";
  if (message.includes("yetkin yok")) return "Bu durum değişikliğine yetkin yok.";
  return "İşlem tamamlanamadı. Lütfen tekrar dene.";
}

export type ListingInput = {
  title: string;
  categorySlug: string;
  condition: string;
  description: string;
  price: string;
  currency: "TL" | "€";
  city: string;
  district?: string;
  negotiable: boolean;
  photos: string[];
};

function validate(input: ListingInput) {
  if (input.photos.length === 0) return "En az 1 fotoğraf ekle.";
  if (input.title.trim().length < 3) return "Başlık en az 3 karakter olmalı.";
  const price = Number(input.price);
  if (!input.price || Number.isNaN(price) || price < 0) return "Geçerli bir fiyat gir.";
  if (!input.city) return "Bölge seç.";
  return null;
}

export async function createListing(input: ListingInput): Promise<Result & { id?: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Devam etmek için giriş yap." };
  const invalid = validate(input);
  if (invalid) return { error: invalid };

  const { data: category } = await supabase.from("categories").select("id").eq("slug", input.categorySlug).single();
  if (!category) return { error: "Kategori seç." };

  const { data: listing, error } = await supabase
    .from("listings")
    .insert({
      seller_id: user.id,
      category_id: category.id,
      title: input.title.trim(),
      description: input.description.trim(),
      price: Number(input.price),
      currency: input.currency,
      city: input.city,
      district: input.district?.trim() || null,
      condition: input.condition,
      negotiable: input.negotiable,
      status: "pending",
    })
    .select("id")
    .single();
  if (error || !listing) return { error: dbError(error?.message ?? "") };

  const { error: imageError } = await supabase
    .from("listing_images")
    .insert(input.photos.map((path, position) => ({ listing_id: listing.id, path, position })));
  if (imageError) return { error: dbError(imageError.message) };

  return { ok: true, id: listing.id };
}

export async function updateListing(
  id: string,
  fields: { title: string; price: string; city: string; district?: string; description: string; negotiable?: boolean },
): Promise<EditResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Devam etmek için giriş yap." };
  if (fields.title.trim().length < 3) return { error: "Başlık en az 3 karakter olmalı." };
  const before = await listingStatus(supabase, id);
  const { data, error } = await supabase
    .from("listings")
    .update({
      title: fields.title.trim(),
      price: Number(fields.price),
      city: fields.city,
      district: fields.district?.trim() || null,
      description: fields.description.trim(),
      ...(fields.negotiable === undefined ? {} : { negotiable: fields.negotiable }),
    })
    .eq("id", id)
    .select("status");
  if (error) return { error: dbError(error.message) };
  if (!data?.length) return { error: NOT_EDITABLE };
  refresh();
  return { ok: true, review: before === "active" && data[0].status === "pending" };
}

export async function setListingStatus(id: string, status: "pending" | "sold" | "removed" | "draft"): Promise<Result> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Devam etmek için giriş yap." };
  const { data, error } = await supabase.from("listings").update({ status }).eq("id", id).select("id");
  if (error) return { error: dbError(error.message) };
  if (!data?.length) return { error: NOT_EDITABLE };
  refresh();
  return { ok: true };
}

export async function deleteListing(id: string) {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Devam etmek için giriş yap." };
  const { data: images } = await supabase.from("listing_images").select("path").eq("listing_id", id);
  const { error } = await supabase.from("listings").delete().eq("id", id);
  if (error) return { error: dbError(error.message) };
  const paths = (images ?? []).map((i) => i.path).filter((p) => !p.startsWith("http"));
  if (paths.length) await supabase.storage.from("listing-images").remove(paths);
  redirect("/hesabim/ilanlar");
}

export async function addListingImages(listingId: string, paths: string[]): Promise<EditResult> {
  const { supabase } = await requireUser();
  const before = await listingStatus(supabase, listingId);
  const { data: last } = await supabase
    .from("listing_images")
    .select("position")
    .eq("listing_id", listingId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const start = (last?.position ?? -1) + 1;
  const { error } = await supabase
    .from("listing_images")
    .insert(paths.map((path, i) => ({ listing_id: listingId, path, position: start + i })));
  if (error) return { error: dbError(error.message) };
  refresh();
  return { ok: true, review: before === "active" && (await listingStatus(supabase, listingId)) === "pending" };
}

export async function removeListingImage(imageId: string): Promise<EditResult> {
  const { supabase } = await requireUser();
  const { data: image } = await supabase.from("listing_images").select("path, listing_id").eq("id", imageId).single();
  if (!image) return { error: "Fotoğraf bulunamadı." };
  const { count } = await supabase
    .from("listing_images")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", image.listing_id);
  if ((count ?? 0) <= 1) return { error: "İlanda en az bir fotoğraf kalmalı." };
  const before = await listingStatus(supabase, image.listing_id);
  const { data: removed, error } = await supabase.from("listing_images").delete().eq("id", imageId).select("id");
  if (error) return { error: dbError(error.message) };
  if (!removed?.length) return { error: NOT_EDITABLE };
  if (!image.path.startsWith("http")) await supabase.storage.from("listing-images").remove([image.path]);
  refresh();
  return { ok: true, review: before === "active" && (await listingStatus(supabase, image.listing_id)) === "pending" };
}

export async function toggleFavorite(listingId: string): Promise<{ favorite?: boolean; error?: "auth" | string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "auth" };
  const { data: existing } = await supabase
    .from("favorites")
    .select("listing_id")
    .eq("user_id", user.id)
    .eq("listing_id", listingId)
    .maybeSingle();
  if (existing) {
    await supabase.from("favorites").delete().eq("user_id", user.id).eq("listing_id", listingId);
    return { favorite: false };
  }
  const { error } = await supabase.from("favorites").insert({ user_id: user.id, listing_id: listingId });
  if (error) return { error: dbError(error.message) };
  return { favorite: true };
}

export async function reportListing(listingId: string, reason: string, detail: string): Promise<Result> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Şikayet göndermek için giriş yap." };
  const { error } = await supabase
    .from("reports")
    .insert({ reporter_id: user.id, listing_id: listingId, reason, detail: detail.trim() || null });
  if (error) return { error: dbError(error.message) };
  return { ok: true };
}

export async function startConversation(listingId: string) {
  const { supabase, user } = await requireUser();
  if (!user) redirect(`/giris-gerekli?returnTo=${encodeURIComponent("/mesajlar")}`);

  const { data: listing } = await supabase.from("listings").select("seller_id, slug").eq("id", listingId).single();
  if (!listing) redirect("/ilanlar");
  if (listing.seller_id === user.id) redirect("/mesajlar");

  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("listing_id", listingId)
    .eq("buyer_id", user.id)
    .maybeSingle();
  if (existing) redirect(`/mesajlar?c=${existing.id}`);

  const { data: created, error } = await supabase
    .from("conversations")
    .insert({ listing_id: listingId, buyer_id: user.id, seller_id: listing.seller_id })
    .select("id")
    .single();
  if (error || !created) redirect("/hesap-kisitlandi");
  redirect(`/mesajlar?c=${created.id}`);
}

export async function getListingWhatsapp(listingId: string): Promise<{ phone?: string; error?: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "auth" };
  const { data } = await supabase.rpc("get_listing_whatsapp", { p_listing: listingId });
  if (!data) return { error: "Satıcı WhatsApp iletişimini açmamış. Uygulama içinden mesaj gönderebilirsin." };
  return { phone: String(data) };
}
