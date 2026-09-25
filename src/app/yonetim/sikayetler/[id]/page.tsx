import Link from "next/link";
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
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[27px]">Şikayet inceleme</h1>
          <Badge kind={s.kind}>{s.label}</Badge>
        </div>
        <LinkButton href="/yonetim/sikayetler" variant="outline" full={false} className="min-h-10 text-xs">
          Kuyruğa dön
        </LinkButton>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold">{report.reason}</h2>
          <p className="mt-2 text-xs text-muted">
            Hedef:{" "}
            {listing ? (
              <Link href={`/yonetim/ilanlar/${listing.id}`} className="text-accent">
                İlan · {listing.title}
              </Link>
            ) : reported ? (
              <Link href={`/yonetim/kullanicilar/${reported.id}`} className="text-accent">
                Kullanıcı · {reported.display_name}
              </Link>
            ) : (
              snapshotLabel(snapshot)
            )}
          </p>
          <p className="mt-1 text-xs text-muted">
            Bildiren:{" "}
            {reporter ? (
              <Link href={`/yonetim/kullanicilar/${reporter.id}`} className="text-accent">
                {reporter.display_name}
              </Link>
            ) : (
              "Silinmiş kullanıcı"
            )}{" "}
            · {formatDate(report.created_at)}
          </p>
          <p className="mt-4 whitespace-pre-line text-[13px] leading-relaxed">
            {report.detail || <span className="text-muted">Bildiren kullanıcı ek açıklama bırakmadı.</span>}
          </p>
          {snapListing ? (
            <div className="mt-4 rounded-lg border border-border p-3 text-xs">
              <p className="font-semibold">
                Şikayet anındaki ilan{listing ? "" : " (ilan silinmiş)"}
                {snapshot?.captured_at ? ` · ${formatDate(snapshot.captured_at)}` : ""}
              </p>
              <p className="mt-1">
                {snapListing.title}
                {snapListing.ref_no ? ` · #${snapListing.ref_no}` : ""}
                {snapListing.price != null ? ` · ${snapListing.price} ${snapListing.currency ?? ""}` : ""}
                {snapListing.city ? ` · ${snapListing.city}` : ""}
              </p>
              <p className="mt-1 text-muted">
                Satıcı:{" "}
                {snapListing.seller_id ? (
                  <Link href={`/yonetim/kullanicilar/${snapListing.seller_id}`} className="text-accent">
                    {snapListing.seller_name ?? "—"}
                  </Link>
                ) : (
                  (snapListing.seller_name ?? "—")
                )}
                {snapListing.images?.length ? ` · ${snapListing.images.length} fotoğraf` : ""}
              </p>
              {snapListing.description ? (
                <p className="mt-2 whitespace-pre-line text-muted">{snapListing.description}</p>
              ) : null}
            </div>
          ) : null}
          {report.resolution_note ? (
            <p className="mt-4 rounded-lg bg-brand-soft p-3 text-xs">
              <b>Moderasyon notu:</b> {report.resolution_note}
              {report.resolved_at ? ` · ${formatDate(report.resolved_at)}` : ""}
            </p>
          ) : null}
        </div>
        {report.status !== "resolved" ? <ResolveReportForm id={report.id} status={report.status} /> : null}
      </div>
    </>
  );
}
