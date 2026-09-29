
import * as I18n from "@/components/i18n/Localized";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { LinkButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/queries";
import { formatDate } from "@/lib/format";
import { reportStatus } from "@/lib/adminLabels";
import { snapshotLabel, type ReportSnapshot } from "@/lib/reportSnapshot";
import { ResolveReportForm } from "./ResolveReportForm";

export const metadata = { title: "Yönetim · Şikayet", robots: { index: false } };

export default async function AdminReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AdminShell>
      <ReportDetail id={id} />
    </AdminShell>
  );
}

async function ReportDetail({ id }: { id: string }) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: report } = await supabase
    .from("reports")
    .select(
      "*, listing:listings(id, title, status), reported:profiles!reports_reported_user_id_fkey(id, display_name), reporter:profiles!reports_reporter_id_fkey(id, display_name)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!report) notFound();

  const listing = one(report.listing) as { id: string; title: string; status: string } | null;
  const reported = one(report.reported) as { id: string; display_name: string } | null;
  const reporter = one(report.reporter) as { id: string; display_name: string } | null;
  const snapshot = report.target_snapshot as ReportSnapshot | null;
  const snapListing = snapshot?.listing;
  const s = reportStatus[report.status];

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <I18n.h1 className="text-2xl font-semibold tracking-tight sm:text-[27px]">Şikayet inceleme</I18n.h1>
          <Badge kind={s.kind}>{s.label}</Badge>
        </div>
        <LinkButton href="/yonetim/sikayetler" variant="outline" full={false} className="min-h-10 text-xs">
          Kuyruğa dön
        </LinkButton>
      </div>

      <I18n.div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]">
        <I18n.div className="rounded-xl border border-border bg-surface p-5">
          <I18n.h2 className="text-sm font-semibold">{report.reason}</I18n.h2>
          <I18n.p className="mt-2 text-xs text-muted">
            Hedef:{" "}
            {listing ? (
              <I18n.Link href={`/yonetim/ilanlar/${listing.id}`} className="text-accent">
                İlan · <I18n.Raw>{listing.title}</I18n.Raw>
              </I18n.Link>
            ) : reported ? (
              <I18n.Link href={`/yonetim/kullanicilar/${reported.id}`} className="text-accent">
                Kullanıcı · <I18n.Raw>{reported.display_name}</I18n.Raw>
              </I18n.Link>
            ) : (
              snapshotLabel(snapshot)
            )}
          </I18n.p>
          <I18n.p className="mt-1 text-xs text-muted">
            Bildiren:{" "}
            {reporter ? (
              <I18n.Link href={`/yonetim/kullanicilar/${reporter.id}`} className="text-accent">
                <I18n.Raw>{reporter.display_name}</I18n.Raw>
              </I18n.Link>
            ) : (
              "Silinmiş kullanıcı"
            )}{" "}
            · <I18n.Formatted kind="formatDate" args={[report.created_at]} />
          </I18n.p>
          <I18n.p className="mt-4 whitespace-pre-line text-[13px] leading-relaxed">
            {report.detail || <I18n.span className="text-muted">Bildiren kullanıcı ek açıklama bırakmadı.</I18n.span>}
          </I18n.p>
          {snapListing ? (
            <I18n.div className="mt-4 rounded-lg border border-border p-3 text-xs">
              <I18n.p className="font-semibold">
                Şikayet anındaki ilan{listing ? "" : " (ilan silinmiş)"}
                {snapshot?.captured_at ? ` · ${formatDate(snapshot.captured_at)}` : ""}
              </I18n.p>
              <I18n.p className="mt-1">
                {snapListing.title}
                {snapListing.ref_no ? ` · #${snapListing.ref_no}` : ""}
                {snapListing.price != null ? ` · ${snapListing.price} ${snapListing.currency ?? ""}` : ""}
                {snapListing.city ? ` · ${snapListing.city}` : ""}
              </I18n.p>
              <I18n.p className="mt-1 text-muted">
                Satıcı:{" "}
                {snapListing.seller_id ? (
                  <I18n.Link href={`/yonetim/kullanicilar/${snapListing.seller_id}`} className="text-accent">
                    {snapListing.seller_name ?? "—"}
                  </I18n.Link>
                ) : (
                  (snapListing.seller_name ?? "—")
                )}
                {snapListing.images?.length ? ` · ${snapListing.images.length} fotoğraf` : ""}
              </I18n.p>
              {snapListing.description ? (
                <I18n.p className="mt-2 whitespace-pre-line text-muted">{snapListing.description}</I18n.p>
              ) : null}
            </I18n.div>
          ) : null}
          {report.resolution_note ? (
            <I18n.p className="mt-4 rounded-lg bg-brand-soft p-3 text-xs">
              <I18n.b>Moderasyon notu:</I18n.b> {report.resolution_note}
              {report.resolved_at ? ` · ${formatDate(report.resolved_at)}` : ""}
            </I18n.p>
          ) : null}
        </I18n.div>
        {report.status !== "resolved" ? <ResolveReportForm id={report.id} status={report.status} /> : null}
      </I18n.div>
    </>
  );
}
