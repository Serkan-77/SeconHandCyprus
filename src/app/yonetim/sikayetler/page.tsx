import Link from "next/link";
import { apiServer } from "@/lib/api/server";
import { getI18n } from "@/lib/i18n/server";
import { cn } from "@/lib/cn";

export const metadata = { title: "Şikayetler" };

type Row = {
  id: string;
  reason: string;
  detail: string | null;
  status: string;
  createdAt: string;
  listingId: string | null;
  reportedUserId: string | null;
  listingTitle: string | null;
  reportedName: string | null;
  reporterName: string | null;
  targetSnapshot: { listing?: { title: string }; user?: { display_name: string } } | null;
};

export default async function AdminReports({ searchParams }: { searchParams: Promise<{ durum?: string }> }) {
  const [{ durum }, { t, f }] = await Promise.all([searchParams, getI18n()]);
  const status = durum ?? "";
  const { reports } = await apiServer<{ reports: Row[] }>(`/admin/reports${status ? `?status=${status}` : ""}`);
  const tabs = [
    ["", "Açık"],
    ["pending", "Yeni"],
    ["reviewing", "İnceleniyor"],
    ["resolved", "Çözüldü"],
  ] as const;
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">{t("Şikayetler")}</h1>
      <div className="flex flex-wrap gap-1.5">
        {tabs.map(([k, label]) => (
          <Link key={k} href={k ? `/yonetim/sikayetler?durum=${k}` : "/yonetim/sikayetler"} className={cn("flex h-9 items-center rounded-pill px-3.5 text-[13px] font-medium", status === k ? "bg-brand text-on-brand" : "bg-brand-soft text-muted")}>
            {t(label)}
          </Link>
        ))}
      </div>
      {reports.length ? (
        <ul className="divide-y divide-border overflow-hidden rounded-card border border-border">
          {reports.map((r) => {
            const target = r.listingTitle ?? r.reportedName ?? r.targetSnapshot?.listing?.title ?? r.targetSnapshot?.user?.display_name ?? t("Silinmiş içerik");
            return (
              <li key={r.id}>
                <Link href={`/yonetim/sikayetler/${r.id}`} className="flex flex-col gap-0.5 p-4 hover:bg-bg sm:flex-row sm:items-center sm:gap-4">
                  <span className="w-28 flex-shrink-0 text-[12px] font-semibold uppercase text-muted">{t(r.listingId || r.targetSnapshot?.listing ? "İlan" : "Kullanıcı")}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{t(r.reason)}</span>
                    <span className="block truncate text-[13px] text-muted" translate="no">
                      {target}
                    </span>
                  </span>
                  <span className="text-[13px] text-muted">
                    {r.reporterName ?? "—"} · {f("timeAgo", r.createdAt)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-card border border-dashed border-border-strong p-10 text-center text-[14px] text-muted">{t("Bu listede şikayet yok.")}</p>
      )}
    </>
  );
}
