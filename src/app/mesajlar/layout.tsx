import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MessagesShell } from "@/components/messages/ConversationList";
import { apiServer, getMe } from "@/lib/api/server";
import type { ConversationSummary } from "@/lib/api/types";

export const metadata: Metadata = { title: "Mesajlar", robots: { index: false } };

export default async function MessagesLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  if (!me) redirect("/giris?returnTo=/mesajlar");
  const { conversations } = await apiServer<{ conversations: ConversationSummary[] }>("/conversations").catch(() => ({ conversations: [] }));
  return (
    <MessagesShell initial={conversations} me={me.id}>
      {children}
    </MessagesShell>
  );
}
