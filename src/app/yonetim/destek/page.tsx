
import * as I18n from "@/components/i18n/Localized";
import { AdminShell } from "@/components/admin/AdminShell";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/icons";
import { createClient } from "@/lib/supabase/server";

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
        <I18n.h1 className="text-2xl font-semibold tracking-tight sm:text-[27px]">Destek talepleri</I18n.h1>
        <I18n.p className="mt-1.5 text-xs text-muted">Destek formundan gelen talepler. Yanıtlar e-posta ile verilir.</I18n.p>
      </div>
      {!tickets || tickets.length === 0 ? (
        <I18n.div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted">
          <Icon name="mail" className="h-8 w-8" />
          Henüz destek talebi yok.
        </I18n.div>
      ) : (
        <I18n.div className="overflow-hidden rounded-xl border border-border bg-surface">
          {tickets.map((t) => (
            <article key={t.id} className="flex flex-col gap-2 border-b border-border p-5 last:border-0">
              <div className="flex flex-wrap items-center gap-2">
                <I18n.b className="text-sm">{t.topic}</I18n.b>
                <Badge kind={t.status === "open" ? "accent" : "neutral"}>{t.status === "open" ? "Açık" : "Kapalı"}</Badge>
                <I18n.span className="ml-auto text-[10px] text-muted"><I18n.Formatted kind="timeAgo" args={[t.created_at]} /></I18n.span>
              </div>
              <I18n.a href={`mailto:${t.email}?subject=${encodeURIComponent(`Destek talebin: ${t.topic}`)}`} className="text-xs text-accent">
                {t.email}
              </I18n.a>
              <I18n.p className="whitespace-pre-line text-[13px] text-muted">{t.message}</I18n.p>
            </article>
          ))}
        </I18n.div>
      )}
    </>
  );
}
