import { notFound } from "next/navigation";
import { ChatThread } from "@/components/messages/ChatThread";
import { apiServer, apiServerOrNull, getMe } from "@/lib/api/server";
import type { ConversationSummary } from "@/lib/api/types";
import type { ChatMessage } from "@/lib/chat";

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const me = await getMe();
  if (!me) notFound();
  const data = await apiServerOrNull<{ conversation: ConversationSummary }>(`/conversations/${id}`);
  if (!data) notFound();
  const page = await apiServer<{ messages: ChatMessage[]; hasMore: boolean }>(`/conversations/${id}/messages?limit=50`);
  return <ChatThread key={id} initial={data.conversation} initialMessages={page.messages} initialHasMore={page.hasMore} me={me.id} />;
}
