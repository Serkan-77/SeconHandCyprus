import { AnnouncementComposer } from "@/components/admin/AnnouncementComposer";
import { AdminCard } from "@/components/admin/AdminKit";
import { apiServer } from "@/lib/api/server";
import { getI18n } from "@/lib/i18n/server";

export const metadata = { title: "Duyurular" };

type Row = { id: string; audience: string; title: string; body: string; recipients: number; createdAt: string };

export default async function AdminAnnouncements() {
  const [{ t, f }, { items }] = await Promise.all([getI18n(), apiServer<{ items: Row[] }>("/admin/announcements")]);
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">{t("Duyurular")}</h1>
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <AnnouncementComposer />
        <AdminCard title="Gönderilenler">
          {items.length ? (
            <ul className="divide-y divide-border">
              {items.map((a) => (
                <li key={a.id} className="py-3">
                  <p className="font-medium" translate="no">{a.title}</p>
                  <p className="line-clamp-2 text-[13px] text-muted" translate="no">{a.body}</p>
                  <p className="text-[12px] text-subtle">
                    {t(a.audience)} · {t(`${a.recipients} kişi`)} · {f("formatDate", a.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[14px] text-muted">{t("Henüz duyuru gönderilmedi.")}</p>
          )}
        </AdminCard>
      </div>
    </>
  );
}
