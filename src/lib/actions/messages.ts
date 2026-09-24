"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { error?: string; ok?: boolean };

async function session() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function sendMessage(
  conversationId: string,
  body: string,
): Promise<Result & { message?: { id: string; body: string; created_at: string; sender_id: string; read_at: string | null } }> {
  const { supabase, user } = await session();
  if (!user) return { error: "Oturumun sona erdi. Tekrar giriş yap." };
  const text = body.trim();
  if (!text) return { error: "Boş mesaj gönderilemez." };
  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: user.id, body: text.slice(0, 2000) })
    .select("id, body, created_at, sender_id, read_at")
    .single();
  if (error) {
    return {
      error: error.message.includes("row-level security")
        ? "blocked"
        : "Mesaj gönderilemedi. Bağlantını kontrol edip tekrar dene.",
    };
  }
  return { ok: true, message: data };
}

export async function markConversationRead(conversationId: string) {
  const { supabase, user } = await session();
  if (!user) return;
  await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .neq("sender_id", user.id)
    .is("read_at", null);
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("link", `/mesajlar?c=${conversationId}`)
    .is("read_at", null);
}

export async function blockUser(userId: string): Promise<Result> {
  const { supabase, user } = await session();
  if (!user) return { error: "Oturum bulunamadı." };
  const { error } = await supabase.from("blocks").insert({ blocker_id: user.id, blocked_id: userId });
  if (error && !error.message.includes("duplicate")) return { error: "Engelleme başarısız oldu." };
  refresh();
  return { ok: true };
}

export async function unblockUser(userId: string): Promise<Result> {
  const { supabase, user } = await session();
  if (!user) return { error: "Oturum bulunamadı." };
  await supabase.from("blocks").delete().eq("blocker_id", user.id).eq("blocked_id", userId);
  refresh();
  return { ok: true };
}

export async function confirmMeeting(conversationId: string): Promise<Result> {
  const { supabase, user } = await session();
  if (!user) return { error: "Oturum bulunamadı." };
  const { error } = await supabase
    .from("conversations")
    .update({ meeting_confirmed_at: new Date().toISOString() })
    .eq("id", conversationId);
  if (error) return { error: "Buluşma onaylanamadı." };
  return { ok: true };
}

export async function rateUser(conversationId: string, rateeId: string, score: number, comment: string): Promise<Result> {
  const { supabase, user } = await session();
  if (!user) return { error: "Oturum bulunamadı." };
  const { data: conv } = await supabase.from("conversations").select("listing_id").eq("id", conversationId).single();
  const { error } = await supabase.from("ratings").insert({
    rater_id: user.id,
    ratee_id: rateeId,
    conversation_id: conversationId,
    listing_id: conv?.listing_id ?? null,
    score: Math.min(5, Math.max(1, Math.round(score))),
    comment: comment.trim() || null,
  });
  if (error) {
    return {
      error: error.message.includes("duplicate")
        ? "Bu buluşma için zaten değerlendirme yaptın."
        : "Değerlendirme gönderilemedi.",
    };
  }
  refresh();
  return { ok: true };
}

export async function reportUser(userId: string, reason: string, detail: string): Promise<Result> {
  const { supabase, user } = await session();
  if (!user) return { error: "Oturum bulunamadı." };
  const { error } = await supabase
    .from("reports")
    .insert({ reporter_id: user.id, reported_user_id: userId, reason, detail: detail.trim() || null });
  if (error) return { error: "Şikayet gönderilemedi." };
  return { ok: true };
}
