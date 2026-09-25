"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fetchOlderMessages, type ChatMessageRow } from "@/lib/chat";
import { firstError, messageSchema, ratingSchema, reportSchema } from "@/lib/validation";
import { rateLimitMessage, reportErrorMessage } from "@/lib/dbErrors";

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
  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const text = parsed.data;
  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: user.id, body: text })
    .select("id, body, created_at, sender_id, read_at")
    .single();
  if (error) {
    return {
      error: error.message.includes("row-level security")
        ? "blocked"
        : (rateLimitMessage(error) ?? "Mesaj gönderilemedi. Bağlantını kontrol edip tekrar dene."),
    };
  }
  return { ok: true, message: data };
}

/** The page of messages just before the oldest one on screen. RLS limits it to participants. */
export async function loadOlderMessages(
  conversationId: string,
  before: { created_at: string; id: string },
): Promise<{ messages?: ChatMessageRow[]; hasMore?: boolean; error?: string }> {
  const { supabase, user } = await session();
  if (!user) return { error: "Oturumun sona erdi. Tekrar giriş yap." };
  try {
    return await fetchOlderMessages(supabase, conversationId, before);
  } catch {
    return { error: "Eski mesajlar yüklenemedi." };
  }
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

/**
 * Confirms the meeting for the signed-in side only. The database stamps the
 * time and fills meeting_confirmed_at once both sides have confirmed.
 */
export async function confirmMeeting(conversationId: string): Promise<Result & { bothConfirmed?: boolean }> {
  const { supabase, user } = await session();
  if (!user) return { error: "Oturum bulunamadı." };
  const { data: conv } = await supabase
    .from("conversations")
    .select("buyer_id, seller_id")
    .eq("id", conversationId)
    .single();
  if (!conv) return { error: "Konuşma bulunamadı." };
  const column = conv.buyer_id === user.id ? "buyer_confirmed_at" : "seller_confirmed_at";
  const { data, error } = await supabase
    .from("conversations")
    .update({ [column]: new Date().toISOString() })
    .eq("id", conversationId)
    .select("meeting_confirmed_at")
    .single();
  if (error) return { error: "Buluşma onaylanamadı." };
  return { ok: true, bothConfirmed: Boolean(data?.meeting_confirmed_at) };
}

export async function rateUser(conversationId: string, rateeId: string, score: number, comment: string): Promise<Result> {
  const { supabase, user } = await session();
  if (!user) return { error: "Oturum bulunamadı." };
  const parsed = ratingSchema.safeParse({ score, comment });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { data: conv } = await supabase.from("conversations").select("listing_id").eq("id", conversationId).single();
  const { error } = await supabase.from("ratings").insert({
    rater_id: user.id,
    ratee_id: rateeId,
    conversation_id: conversationId,
    listing_id: conv?.listing_id ?? null,
    score: parsed.data.score,
    comment: parsed.data.comment,
  });
  if (error) {
    return {
      error: error.message.includes("duplicate")
        ? "Bu buluşma için zaten değerlendirme yaptın."
        : error.message.includes("row-level security")
          ? "Değerlendirme için iki tarafın da buluşmayı onaylaması gerekiyor."
          : "Değerlendirme gönderilemedi.",
    };
  }
  refresh();
  return { ok: true };
}

export async function reportUser(userId: string, reason: string, detail: string): Promise<Result> {
  const { supabase, user } = await session();
  if (!user) return { error: "Oturum bulunamadı." };
  const parsed = reportSchema.safeParse({ reason, detail });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { error } = await supabase
    .from("reports")
    .insert({ reporter_id: user.id, reported_user_id: userId, reason: parsed.data.reason, detail: parsed.data.detail });
  if (error) return { error: reportErrorMessage(error) ?? "Şikayet gönderilemedi." };
  return { ok: true };
}
