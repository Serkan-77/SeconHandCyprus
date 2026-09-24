import { AdminShell } from "@/components/admin/AdminShell";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/icons";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/format";

export const metadata = { title: "Yönetim · Destek", robots: { index: false } };

export default async function AdminSupportPage() {
  return (
    <AdminShell>
      <Tickets />
    </AdminShell>
  );
}

async function Tickets() {
  const supabase = await createClient();
  const { data: tickets } = await supabase
    .from("support_tickets")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[27px]">Destek talepleri</h1>
        <p className="mt-1.5 text-xs text-muted">Destek formundan gelen talepler. Yanıtlar e-posta ile verilir.</p>
      </div>
      {!tickets || tickets.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted">
          <Icon name="mail" className="h-8 w-8" />
          Henüz destek talebi yok.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          {tickets.map((t) => (
            <article key={t.id} className="flex flex-col gap-2 border-b border-border p-5 last:border-0">
              <div className="flex flex-wrap items-center gap-2">
                <b className="text-sm">{t.topic}</b>
                <Badge kind={t.status === "open" ? "accent" : "neutral"}>{t.status === "open" ? "Açık" : "Kapalı"}</Badge>
                <span className="ml-auto text-[10px] text-muted">{timeAgo(t.created_at)}</span>
              </div>
              <a href={`mailto:${t.email}?subject=${encodeURIComponent(`Destek talebin: ${t.topic}`)}`} className="text-xs text-accent">
                {t.email}
              </a>
              <p className="whitespace-pre-line text-[13px] text-muted">{t.message}</p>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
