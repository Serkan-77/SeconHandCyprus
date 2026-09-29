
import * as I18n from "@/components/i18n/Localized";
import { AdminShell } from "@/components/admin/AdminShell";
import { createClient } from "@/lib/supabase/server";
import { AnnouncementComposer } from "./AnnouncementComposer";

export const metadata = { title: "Yönetim · Duyurular", robots: { index: false } };

export default async function AdminAnnouncementsPage() {
  return (
    <AdminShell>
      <Announcements />
    </AdminShell>
  );
}

async function Announcements() {
  const supabase = await createClient();
  const { data: history } = await supabase
    .from("announcements")
    .select("id, audience, title, body, recipients, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="grid grid-cols-1 gap-8 xl:grid-cols-[520px_1fr]">
      <AnnouncementComposer />
      <I18n.section>
        <I18n.h2 className="mb-3 text-base font-semibold">Gönderilmiş duyurular</I18n.h2>
        {history && history.length ? (
          <I18n.div className="overflow-hidden rounded-xl border border-border bg-surface">
            {history.map((a) => (
              <article key={a.id} className="border-b border-border p-4 last:border-0">
                <I18n.span className="text-[10px] text-muted">
                  {a.audience} · {a.recipients} kişi · <I18n.Formatted kind="formatDate" args={[a.created_at]} />
                </I18n.span>
                <I18n.h3 className="mt-1 text-sm font-semibold">{a.title}</I18n.h3>
                <I18n.p className="mt-1 text-xs text-muted">{a.body}</I18n.p>
              </article>
            ))}
          </I18n.div>
        ) : (
          <I18n.p className="rounded-xl border border-dashed border-border py-10 text-center text-xs text-muted">
            Henüz duyuru gönderilmedi.
          </I18n.p>
        )}
      </I18n.section>
    </div>
  );
}
