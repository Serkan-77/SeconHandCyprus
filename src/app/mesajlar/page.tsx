import { redirect } from "next/navigation";
import { ChatView, type ChatConversation, type ChatMessage } from "@/components/ChatView";
import { createClient } from "@/lib/supabase/server";
import { publicImageUrl } from "@/lib/supabase/env";
import { getViewer, one } from "@/lib/queries";
import { meetingFor } from "@/lib/meeting";

export const metadata = { title: "Mesajlar" };

type ProfileRow = { id: string; display_name: string; avatar_url: string | null };

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/giris-gerekli?returnTo=/mesajlar");
  const me = viewer.user.id;
  const { c } = await searchParams;
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("conversations")
    .select(
      `id, listing_id, buyer_id, seller_id, buyer_confirmed_at, seller_confirmed_at, last_message_at,
       listing:listings(title, slug, status, images:listing_images(path, position)),
       buyer:profiles!conversations_buyer_id_fkey(id, display_name, avatar_url),
       seller:profiles!conversations_seller_id_fkey(id, display_name, avatar_url)`,
    )
    .or(`buyer_id.eq.${me},seller_id.eq.${me}`)
    .order("last_message_at", { ascending: false });

  const ids = (rows ?? []).map((r) => r.id);
  const [{ data: latest }, { data: unreadRows }, { data: myBlocks }] = await Promise.all([
    ids.length
      ? supabase
          .from("messages")
          .select("conversation_id, body, sender_id, created_at")
          .in("conversation_id", ids)
          .order("created_at", { ascending: false })
          .limit(500)
      : Promise.resolve({ data: [] as { conversation_id: string; body: string; sender_id: string; created_at: string }[] }),
    ids.length
      ? supabase.from("messages").select("conversation_id").in("conversation_id", ids).neq("sender_id", me).is("read_at", null)
      : Promise.resolve({ data: [] as { conversation_id: string }[] }),
    supabase.from("blocks").select("blocked_id").eq("blocker_id", me),
  ]);

  const blockedIds = new Set((myBlocks ?? []).map((b) => b.blocked_id));

  const conversations: ChatConversation[] = (rows ?? []).map((r) => {
    const listing = one(r.listing) as { title: string; slug: string; status: string; images: { path: string; position: number }[] } | null;
    const other = one(r.buyer_id === me ? r.seller : r.buyer) as ProfileRow | null;
    const last = (latest ?? []).find((m) => m.conversation_id === r.id);
    const cover = [...(listing?.images ?? [])].sort((a, b) => a.position - b.position)[0];
    return {
      id: r.id,
      role: r.buyer_id === me ? "buyer" : "seller",
      other: {
        id: other?.id ?? "",
        name: other?.display_name ?? "Silinmiş kullanıcı",
        avatarUrl: other?.avatar_url ? publicImageUrl(other.avatar_url, "avatars") : null,
      },
      listing: {
        title: listing?.title ?? "Kaldırılmış ilan",
        slug: listing?.status === "active" ? listing.slug : null,
        image: publicImageUrl(cover?.path),
      },
      lastMessage: last?.body ?? "Henüz mesaj yok — ilk mesajı sen gönder.",
      lastAt: last?.created_at ?? r.last_message_at,
      unread: (unreadRows ?? []).filter((m) => m.conversation_id === r.id).length,
      blockedByMe: other ? blockedIds.has(other.id) : false,
      meeting: meetingFor(r, me),
    };
  });

  const active = conversations.find((conv) => conv.id === c) ?? null;
  let messages: ChatMessage[] = [];
  let hasRated = false;
  if (active) {
    const [{ data: msgs }, { data: rating }] = await Promise.all([
      supabase
        .from("messages")
        .select("id, body, sender_id, created_at, read_at")
        .eq("conversation_id", active.id)
        .order("created_at", { ascending: true })
        .limit(500),
      supabase.from("ratings").select("id").eq("conversation_id", active.id).eq("rater_id", me).maybeSingle(),
    ]);
    messages = (msgs ?? []) as ChatMessage[];
    hasRated = Boolean(rating);
  }

  return (
    <ChatView
      key={active?.id ?? "none"}
      me={me}
      conversations={conversations}
      activeId={active?.id ?? null}
      initialMessages={messages}
      hasRated={hasRated}
    />
  );
}
