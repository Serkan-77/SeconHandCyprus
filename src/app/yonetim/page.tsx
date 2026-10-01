import Link from "next/link";
import { AdminCard } from "@/components/admin/AdminKit";
import { apiServer } from "@/lib/api/server";
import { getI18n } from "@/lib/i18n/server";

type Dashboard = {
  metrics: Record<string, number>;
  daily: { day: string; count: number }[];
  reports: { id: string; reason: string; status: string; createdAt: string; listingTitle: string | null; reportedName: string | null }[];
  realtimeConnections: number;
};

export const metadata = { title: "Genel bakış" };

export default async function AdminDashboard() {
  const [{ t, f }, d] = await Promise.all([getI18n(), apiServer<Dashboard>("/admin/dashboard")]);
  const m = d.metrics;
  const cards = [
    { label: "Toplam kullanıcı", value: m.users, sub: `+${m.newUsers} son 30 gün`, href: "/yonetim/kullanicilar" },
    { label: "Yayındaki ilan", value: m.active, sub: `+${m.activeThisWeek} bu hafta`, href: "/ilanlar" },
    { label: "Bekleyen inceleme", value: m.pending, sub: "Moderasyon kuyruğu", href: "/yonetim/ilanlar" },
    { label: "Açık şikayet", value: m.openReports, sub: "Çözülmemiş", href: "/yonetim/sikayetler" },
    { label: "Bugün verilen ilan", value: m.today, sub: "Tüm durumlar", href: "/yonetim/ilanlar?durum=hepsi" },
    { label: "Son 24 saatte mesaj", value: m.messages24h, sub: `${d.realtimeConnections} canlı bağlantı`, href: "/yonetim" },
  ];
  const max = Math.max(4, ...d.daily.map((x) => x.count));

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">{t("Genel bakış")}</h1>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="rounded-card border border-border p-4 transition hover:border-border-strong hover:shadow-sm">
            <p className="text-[13px] text-muted">{t(c.label)}</p>
            <p className="mt-1 text-2xl font-bold tabular">{f("formatNumber", c.value ?? 0)}</p>
            <p className="mt-0.5 text-[12px] text-subtle">{t(c.sub)}</p>
          </Link>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <AdminCard title="Son 30 günde verilen ilanlar">
          <div className="flex h-44 items-end gap-[3px]" role="img" aria-label={t(`Son 30 günde ${d.daily.reduce((a, b) => a + b.count, 0)} ilan`)}>
            {d.daily.map((x) => (
              <div key={x.day} className="group relative flex-1">
                <div className="rounded-t-[3px] bg-accent/80 transition group-hover:bg-accent" style={{ height: `${Math.max(2, (x.count / max) * 160)}px` }} />
                <span className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-brand px-1.5 py-0.5 text-[11px] text-on-brand group-hover:block">
                  {x.day.slice(5)} · {x.count}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-subtle">
            <span>{d.daily[0]?.day.slice(5)}</span>
            <span>{d.daily.at(-1)?.day.slice(5)}</span>
          </div>
        </AdminCard>
        <AdminCard title="Son şikayetler" action={<Link href="/yonetim/sikayetler" className="text-[13px] font-semibold text-accent">{t("Tümü")}</Link>}>
          {d.reports.length ? (
            <ul className="divide-y divide-border">
              {d.reports.map((r) => (
                <li key={r.id}>
                  <Link href={`/yonetim/sikayetler/${r.id}`} className="block py-2.5 hover:bg-bg">
                    <p className="text-[14px] font-medium">{t(r.reason)}</p>
                    <p className="truncate text-[12px] text-muted" translate="no">
                      {r.listingTitle ?? r.reportedName ?? t("Silinmiş içerik")} · {f("timeAgo", r.createdAt)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[14px] text-muted">{t("Açık şikayet yok.")}</p>
          )}
        </AdminCard>
      </div>
    </>
  );
}
