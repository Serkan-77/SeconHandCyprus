import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminKit";
import { apiServer, getMe } from "@/lib/api/server";
import { getI18n } from "@/lib/i18n/server";

export const metadata: Metadata = { title: { default: "Yönetim", template: "%s · Yönetim" }, robots: { index: false, follow: false } };

// Every admin page renders inside this layout, so the check happens once
// here; the API checks admin rights again on every request.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const me = await getMe();
  if (!me) redirect("/giris?returnTo=/yonetim");
  const { t } = await getI18n();
  if (me.role !== "admin") {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-xl font-bold">{t("Bu alan yalnızca yöneticiler içindir")}</h1>
        <p className="mt-2 text-[14px] text-muted">{t("Hesabının yönetici yetkisi yok.")}</p>
      </div>
    );
  }
  const dash = await apiServer<{ metrics: Record<string, number> }>("/admin/dashboard").catch(() => ({ metrics: {} as Record<string, number> }));
  const counts = {
    pending: dash.metrics.pending ?? 0,
    openReports: dash.metrics.openReports ?? 0,
    pendingVerifications: dash.metrics.pendingVerifications ?? 0,
    openTickets: dash.metrics.openTickets ?? 0,
  };
  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-16 pt-4 sm:px-6 sm:pt-6">
      <div className="grid gap-6 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside>
          <p className="mb-3 hidden text-[12px] font-bold uppercase tracking-wider text-subtle lg:block">{t("Yönetim")}</p>
          <div className="lg:sticky lg:top-[132px]">
            <AdminNav counts={counts} />
          </div>
        </aside>
        <div className="flex min-w-0 flex-col gap-6">{children}</div>
      </div>
    </div>
  );
}
