
import * as I18n from "@/components/i18n/Localized";
import { AdminShell } from "@/components/admin/AdminShell";
import { Badge } from "@/components/ui/Badge";
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/queries";
import { reportStatus } from "@/lib/adminLabels";
import { cn } from "@/lib/cn";
import { snapshotLabel, type ReportSnapshot } from "@/lib/reportSnapshot";

export const metadata = { title: "Yönetim · Şikayetler", robots: { index: false } };

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<{ durum?: string }> }) {
  const { durum } = await searchParams;
  return (
    <AdminShell>
      <Reports showResolved={durum === "cozulen"} />
    </AdminShell>
  );
}

async function Reports({ showResolved }: { showResolved: boolean }) {
  const supabase = await createClient();
  let query = supabase
    .from("reports")
    .select(
      "id, reason, status, created_at, target_snapshot, listing:listings(title), reported:profiles!reports_reported_user_id_fkey(display_name), reporter:profiles!reports_reporter_id_fkey(display_name)",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  query = showResolved ? query.eq("status", "resolved") : query.neq("status", "resolved");
  const { data: reports } = await query;

  return (
    <>
      <div>
        <I18n.h1 className="text-2xl font-semibold tracking-tight sm:text-[27px]">Şikayet kuyruğu</I18n.h1>
        <I18n.p className="mt-1.5 text-xs text-muted">
          {reports?.length ?? 0} {showResolved ? "çözülmüş" : "açık"} şikayet.
        </I18n.p>
      </div>
      <I18n.div className="flex gap-0 border-b border-border">
        {[
          { href: "/yonetim/sikayetler", label: "Açık", active: !showResolved },
          { href: "/yonetim/sikayetler?durum=cozulen", label: "Çözülen", active: showResolved },
        ].map((t) => (
          <I18n.Link
            key={t.href}
            href={t.href}
            className={cn(
              "border-b-2 px-3 py-3 text-xs",
              t.active ? "border-brand font-semibold text-brand" : "border-transparent text-muted",
            )}
          >
            {t.label}
          </I18n.Link>
        ))}
      </I18n.div>

      {!reports || reports.length === 0 ? (
        <I18n.div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted">
          {showResolved ? "Henüz çözülmüş şikayet yok." : "Kuyrukta bekleyen şikayet yok."}
        </I18n.div>
      ) : (
        <div className="overflow-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead>
              <tr className="bg-bg text-[10px] text-muted">
                <I18n.th className="p-3 font-medium">Tür</I18n.th>
                <I18n.th className="p-3 font-medium">Hedef</I18n.th>
                <I18n.th className="p-3 font-medium">Bildiren</I18n.th>
                <I18n.th className="p-3 font-medium">Tarih</I18n.th>
                <I18n.th className="p-3 font-medium">Durum</I18n.th>
                <th className="p-3 font-medium" />
              </tr>
            </thead>
            <I18n.tbody>
              {reports.map((r) => {
                const listing = one(r.listing) as { title: string } | null;
                const reported = one(r.reported) as { display_name: string } | null;
                const reporter = one(r.reporter) as { display_name: string } | null;
                const s = reportStatus[r.status];
                return (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <I18n.td className="p-3 font-medium">{r.reason}</I18n.td>
                    <I18n.td className="max-w-[220px] truncate p-3 text-muted">
                      {listing
                        ? listing.title
                        : reported
                          ? `Kullanıcı: ${reported.display_name}`
                          : snapshotLabel(r.target_snapshot as ReportSnapshot | null)}
                    </I18n.td>
                    <I18n.td className="p-3 text-muted">{reporter?.display_name ? <I18n.Raw>{reporter?.display_name}</I18n.Raw> : "Silinmiş kullanıcı"}</I18n.td>
                    <I18n.td className="p-3 text-muted"><I18n.Formatted kind="formatDate" args={[r.created_at]} /></I18n.td>
                    <td className="p-3">
                      <Badge kind={s.kind}>{s.label}</Badge>
                    </td>
                    <td className="p-3">
                      <I18n.Link href={`/yonetim/sikayetler/${r.id}`} className="text-[11px] font-medium text-accent">
                        İncele
                      </I18n.Link>
                    </td>
                  </tr>
                );
              })}
            </I18n.tbody>
          </table>
        </div>
      )}
    </>
  );
}
