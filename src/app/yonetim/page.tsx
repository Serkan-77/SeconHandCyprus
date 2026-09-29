
import * as I18n from "@/components/i18n/Localized";
import { AdminShell } from "@/components/admin/AdminShell";
import { Icon } from "@/components/icons";
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/queries";
import { formatNumber } from "@/lib/format";

export const metadata = { title: "Yönetim · Genel bakış", robots: { index: false } };

const DAY = 86400000;

export default async function AdminDashboardPage() {
  return (
    <AdminShell>
      <Dashboard />
    </AdminShell>
  );
}

async function loadDashboard() {
  const supabase = await createClient();
  const now = Date.now();
  const startOfToday = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
  const monthAgo = new Date(now - 30 * DAY).toISOString();
  const weekAgo = new Date(now - 7 * DAY).toISOString();

  const [
    { count: users },
    { count: newUsers },
    { count: active },
    { count: activeThisWeek },
    { count: today },
    { count: pending },
    { data: recent },
    { data: reports },
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", monthAgo),
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("status", "active").gte("created_at", weekAgo),
    supabase.from("listings").select("id", { count: "exact", head: true }).gte("created_at", startOfToday),
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("listings").select("created_at").gte("created_at", monthAgo).limit(5000),
    supabase
      .from("reports")
      .select("id, reason, created_at, status, listing:listings(title), reported:profiles!reports_reported_user_id_fkey(display_name)")
      .neq("status", "resolved")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const metrics = [
    { label: "Toplam kullanıcı", value: formatNumber(users ?? 0), delta: `+${newUsers ?? 0} son 30 gün`, href: "/yonetim/kullanicilar" },
    { label: "Aktif ilan", value: formatNumber(active ?? 0), delta: `+${activeThisWeek ?? 0} bu hafta`, href: "/ilanlar" },
    { label: "Bugünkü yeni ilan", value: formatNumber(today ?? 0), delta: "Tüm durumlar", href: "/yonetim/ilanlar?durum=hepsi" },
    { label: "Bekleyen inceleme", value: formatNumber(pending ?? 0), delta: "Moderasyon kuyruğunda", href: "/yonetim/ilanlar" },
  ];

  // Listings created per day over the last 30 days.
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now - (29 - i) * DAY);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const counts = days.map((d) => {
    const next = d.getTime() + DAY;
    return (recent ?? []).filter((r) => {
      const t = new Date(r.created_at).getTime();
      return t >= d.getTime() && t < next;
    }).length;
  });
  const max = Math.max(4, ...counts);
  const W = 400;
  const H = 170;
  const points = counts.map((c, i) => `${(i / 29) * W},${H - 8 - (c / max) * (H - 24)}`);
  const total = counts.reduce((a, b) => a + b, 0);
  return { metrics, days, points, total, reports, W, H };
}

async function Dashboard() {
  const { metrics, days, points, total, reports, W, H } = await loadDashboard();

  return (
    <>
      <div>
        <I18n.h1 className="text-2xl font-semibold tracking-tight sm:text-[27px]">Genel bakış</I18n.h1>
        <I18n.p className="mt-1.5 text-xs text-muted">Platformun bugünkü durumu.</I18n.p>
      </div>

      <I18n.div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {metrics.map((m) => (
          <I18n.Link key={m.label} href={m.href} className="rounded-[14px] border border-border bg-surface p-5">
            <I18n.span className="text-[11px] text-muted">{m.label}</I18n.span>
            <I18n.strong className="my-3 block text-[27px] tracking-tight">{m.value}</I18n.strong>
            <I18n.small className="text-[10px] text-accent">{m.delta}</I18n.small>
          </I18n.Link>
        ))}
      </I18n.div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-[14px] border border-border bg-surface p-5">
          <div className="flex items-baseline justify-between gap-3">
            <I18n.h2 className="text-sm font-semibold">Son 30 gün yeni ilan</I18n.h2>
            <I18n.span className="text-[11px] text-muted">Toplam {total}</I18n.span>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="mt-5 h-[170px] w-full" role="img" aria-label={`Son 30 günde ${total} yeni ilan`}>
            {[0, 0.25, 0.5, 0.75, 1].map((f) => (
              <line key={f} x1="0" y1={8 + f * (H - 24)} x2={W} y2={8 + f * (H - 24)} stroke="var(--border)" strokeWidth={1} />
            ))}
            <polyline points={`0,${H - 8} ${points.join(" ")} ${W},${H - 8}`} fill="var(--accent-soft)" stroke="none" />
            <polyline points={points.join(" ")} fill="none" stroke="var(--brand)" strokeWidth={2.5} strokeLinejoin="round" />
          </svg>
          <div className="mt-2 flex justify-between text-[10px] text-muted">
            <I18n.span><I18n.Formatted kind="formatDate" args={[days[0]]} /></I18n.span>
            <I18n.span>Bugün</I18n.span>
          </div>
        </div>
        <I18n.div className="rounded-[14px] border border-border bg-surface p-5">
          <div className="mb-3 flex items-center justify-between">
            <I18n.h2 className="text-sm font-semibold">Bekleyen şikayetler</I18n.h2>
            <I18n.Link href="/yonetim/sikayetler" className="text-[11px] font-medium text-accent">
              Tümü
            </I18n.Link>
          </div>
          {reports && reports.length ? (
            <I18n.div className="flex flex-col gap-3">
              {reports.map((r) => {
                const listing = one(r.listing) as { title: string } | null;
                const reported = one(r.reported) as { display_name: string } | null;
                return (
                  <I18n.Link key={r.id} href={`/yonetim/sikayetler/${r.id}`} className="flex items-start gap-2.5 text-xs">
                    <Icon name="flag" className="h-4 w-4 flex-shrink-0 text-accent" />
                    <div className="min-w-0">
                      <I18n.b>{r.reason}</I18n.b>
                      <I18n.p className="truncate text-[11px] text-muted">
                        {listing ? listing.title : `Kullanıcı: ${reported?.display_name ?? "—"}`} · <I18n.Formatted kind="timeAgo" args={[r.created_at]} />
                      </I18n.p>
                    </div>
                  </I18n.Link>
                );
              })}
            </I18n.div>
          ) : (
            <I18n.p className="py-6 text-center text-xs text-muted">Bekleyen şikayet yok.</I18n.p>
          )}
        </I18n.div>
      </div>
    </>
  );
}
