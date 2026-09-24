"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { REGION_COOKIE, regionNames } from "@/lib/regions";

type Result = { error?: string; ok?: boolean };

async function session() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function updateProfile(_: Result | undefined, formData: FormData): Promise<Result> {
  const { supabase, user } = await session();
  if (!user) return { error: "Oturum bulunamadı." };
  const displayName = String(formData.get("name") ?? "").trim();
  if (displayName.length < 2) return { error: "Görünen ad en az 2 karakter olmalı." };
  const avatar = formData.get("avatar");
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      region: String(formData.get("region") ?? "") || null,
      ...(formData.has("bio") ? { bio: String(formData.get("bio") ?? "").trim() || null } : {}),
      ...(typeof avatar === "string" && avatar ? { avatar_url: avatar } : {}),
    })
    .eq("id", user.id);
  if (error) return { error: "Profil kaydedilemedi." };
  const next = String(formData.get("next") ?? "");
  refresh();
  if (next.startsWith("/")) redirect(next);
  return { ok: true };
}

export async function updateSettings(patch: Record<string, unknown>): Promise<Result> {
  const { supabase, user } = await session();
  if (!user) return { error: "Oturum bulunamadı." };
  const { data } = await supabase.from("profiles").select("settings").eq("id", user.id).single();
  const { error } = await supabase
    .from("profiles")
    .update({ settings: { ...(data?.settings ?? {}), ...patch } })
    .eq("id", user.id);
  if (error) return { error: "Ayar kaydedilemedi." };
  return { ok: true };
}

export async function updateContact(_: Result | undefined, formData: FormData): Promise<Result> {
  const { supabase, user } = await session();
  if (!user) return { error: "Oturum bulunamadı." };
  const phone = String(formData.get("phone") ?? "").replace(/\s/g, "");
  if (phone && !/^\+?\d{10,15}$/.test(phone)) return { error: "Geçerli bir telefon numarası gir." };
  const { error } = await supabase
    .from("profile_private")
    .update({ phone: phone || null, whatsapp_enabled: formData.get("whatsapp") === "on" && Boolean(phone) })
    .eq("id", user.id);
  if (error) return { error: "İletişim bilgileri kaydedilemedi." };
  refresh();
  return { ok: true };
}

export async function requestPhoneVerification(_: Result | undefined, formData: FormData): Promise<Result> {
  const { supabase, user } = await session();
  if (!user) return { error: "Oturum bulunamadı." };
  const phone = String(formData.get("phone") ?? "").replace(/\s/g, "");
  if (!/^\+?\d{10,15}$/.test(phone)) return { error: "Geçerli bir telefon numarası gir." };
  const { data: pending } = await supabase
    .from("verification_requests")
    .select("id")
    .eq("user_id", user.id)
    .eq("kind", "phone")
    .eq("status", "pending")
    .maybeSingle();
  if (pending) return { error: "Zaten incelemede olan bir talebin var." };
  const { error } = await supabase.from("verification_requests").insert({ user_id: user.id, kind: "phone", detail: phone });
  if (error) return { error: "Talep gönderilemedi." };
  refresh();
  return { ok: true };
}

export async function markAllNotificationsRead() {
  const { supabase, user } = await session();
  if (!user) return;
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);
  refresh();
}

export async function deleteNotification(id: string) {
  const { supabase } = await session();
  await supabase.from("notifications").delete().eq("id", id);
  refresh();
}

export async function deleteAccount(): Promise<Result> {
  const { supabase, user } = await session();
  if (!user) return { error: "Oturum bulunamadı." };
  const { error } = await supabase.rpc("delete_my_account");
  if (error) return { error: "Hesap silinemedi. Destek ekibiyle iletişime geç." };
  await supabase.auth.signOut();
  redirect("/");
}

export async function setRegion(region: string) {
  const store = await cookies();
  if (regionNames.includes(region)) {
    store.set(REGION_COOKIE, region, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  } else {
    store.delete(REGION_COOKIE);
  }
  refresh();
}

export async function createSupportTicket(_: Result | undefined, formData: FormData): Promise<Result> {
  const { supabase, user } = await session();
  const email = String(formData.get("email") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  if (!email.includes("@")) return { error: "Geçerli bir e-posta adresi gir." };
  if (message.length < 10) return { error: "Mesajın en az 10 karakter olmalı." };
  const { error } = await supabase.from("support_tickets").insert({
    user_id: user?.id ?? null,
    email,
    topic: String(formData.get("topic") ?? "Diğer"),
    message,
  });
  if (error) return { error: "Talep gönderilemedi. Lütfen tekrar dene." };
  return { ok: true };
}
