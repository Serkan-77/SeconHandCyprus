"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
  const { error } = await supabase.from("listings").update({ status: "active", reject_reason: null }).eq("id", id);
  if (error) return { error: "İlan onaylanamadı." };
  refresh();
  return { ok: true };
}

export async function rejectListing(id: string, reason: string, note: string): Promise<Result> {
  const { supabase, ok } = await admin();
  if (!ok) return DENIED;
  const text = note.trim() ? `${reason}. ${note.trim()}` : reason;
  const { error } = await supabase.from("listings").update({ status: "rejected", reject_reason: text }).eq("id", id);
  if (error) return { error: "İlan reddedilemedi." };
  refresh();
  return { ok: true };
}

export async function adminUpdateListing(
  id: string,
  fields: { title: string; categoryId: number; price: string; description: string },
): Promise<Result> {
  const { supabase, ok } = await admin();
  if (!ok) return DENIED;
  const { error } = await supabase
    .from("listings")
    .update({
      title: fields.title.trim(),
      category_id: fields.categoryId,
      price: Number(fields.price),
      description: fields.description.trim(),
    })
    .eq("id", id);
  if (error) return { error: "Değişiklikler kaydedilemedi." };
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
  const { error } = await supabase.from("listings").update({ featured }).eq("id", id);
  if (error) return { error: "Vitrin durumu güncellenemedi." };
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
