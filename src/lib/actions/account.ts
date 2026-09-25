"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { REGION_COOKIE, regionNames } from "@/lib/regions";
import { safeInternalPath } from "@/lib/safeRedirect";
import { firstError, phoneSchema, profileSchema, supportSchema } from "@/lib/validation";
import { accountDeletionMessage, rateLimitMessage } from "@/lib/dbErrors";

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
  const parsed = profileSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    region: String(formData.get("region") ?? ""),
    ...(formData.has("bio") ? { bio: String(formData.get("bio") ?? "") } : {}),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const avatar = formData.get("avatar");
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.name,
      region: parsed.data.region,
      ...(parsed.data.bio !== undefined ? { bio: parsed.data.bio } : {}),
      ...(typeof avatar === "string" && avatar ? { avatar_url: avatar } : {}),
    })
    .eq("id", user.id);
  if (error) return { error: "Profil kaydedilemedi." };
  refresh();
  // Same-origin paths only (P1-03).
  if (formData.has("next")) redirect(safeInternalPath(formData.get("next")));
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
  const raw = String(formData.get("phone") ?? "");
  let phone = "";
  if (raw.trim()) {
    const parsed = phoneSchema.safeParse(raw);
    if (!parsed.success) return { error: firstError(parsed.error) };
    phone = parsed.data;
  }
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
  const parsedPhone = phoneSchema.safeParse(String(formData.get("phone") ?? ""));
  if (!parsedPhone.success) return { error: firstError(parsedPhone.error) };
  const phone = parsedPhone.data;
  const { data: pending } = await supabase
    .from("verification_requests")
    .select("id")
    .eq("user_id", user.id)
    .eq("kind", "phone")
    .eq("status", "pending")
    .maybeSingle();
  if (pending) return { error: "Zaten incelemede olan bir talebin var." };
  const { error } = await supabase.from("verification_requests").insert({ user_id: user.id, kind: "phone", detail: phone });
  if (error) return { error: rateLimitMessage(error) ?? "Talep gönderilemedi." };
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
  if (error) return { error: accountDeletionMessage(error) ?? "Hesap silinemedi. Destek ekibiyle iletişime geç." };
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
  // Honeypot: a hidden field people never fill in; bots that fill every field
  // get a normal-looking answer and nothing is stored (P1-07).
  if (String(formData.get("website") ?? "").trim()) return { ok: true };
  const { supabase, user } = await session();
  const parsed = supportSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    topic: String(formData.get("topic") ?? "Diğer"),
    message: String(formData.get("message") ?? ""),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { error } = await supabase.from("support_tickets").insert({
    user_id: user?.id ?? null,
    email: parsed.data.email,
    topic: parsed.data.topic,
    message: parsed.data.message,
  });
  if (error) return { error: rateLimitMessage(error) ?? "Talep gönderilemedi. Lütfen tekrar dene." };
  return { ok: true };
}
