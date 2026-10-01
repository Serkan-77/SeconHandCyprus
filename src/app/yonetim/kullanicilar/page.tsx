import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Pagination } from "@/components/ui/Pagination";
import { apiServer } from "@/lib/api/server";
import type { ImageUrls } from "@/lib/api/types";
import { getI18n } from "@/lib/i18n/server";
import { cn } from "@/lib/cn";

export const metadata = { title: "Kullanıcılar" };

type Row = {
  id: string;
  displayName: string;
  avatar: ImageUrls | null;
  region: string | null;
  role: string;
  status: string;
  statusUntil: string | null;
  createdAt: string;
  accountType: string;
  storeName: string | null;
  storeVerified: boolean;
  email: string;
  emailVerifiedAt: string | null;
  lastSignInAt: string | null;
  activeListings: number;
  soldListings: number;
};

const STATUS_TONE: Record<string, string> = { active: "text-success", warned: "text-warning", restricted: "text-danger", suspended: "text-danger" };

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string; filtre?: string; sayfa?: string }> }) {
  const [{ q, filtre, sayfa }, { t, f }] = await Promise.all([searchParams, getI18n()]);
  const page = Math.max(1, Number(sayfa) || 1);
  const qs = new URLSearchParams({ page: String(page), pageSize: "30", ...(q ? { q } : {}), ...(filtre ? { filter: filtre } : {}) });
  const { users } = await apiServer<{ users: Row[] }>(`/admin/users?${qs}`);
  const filters = [
    ["", "Tümü"],
    ["sanctioned", "Yaptırımlı"],
    ["stores", "Mağazalar"],
    ["admins", "Yöneticiler"],
  ] as const;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{t("Kullanıcılar")}</h1>
        <form className="flex h-10 items-center rounded-full border border-border-strong pl-3 pr-1" role="search">
          {filtre ? <input type="hidden" name="filtre" value={filtre} /> : null}
          <input name="q" defaultValue={q} placeholder={t("Ad, e-posta ya da mağaza")} aria-label={t("Kullanıcı ara")} className="h-full w-64 bg-transparent px-2 text-[14px] outline-none" />
        </form>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {filters.map(([key, label]) => (
          <Link
            key={key}
            href={`/yonetim/kullanicilar${key || q ? `?${new URLSearchParams({ ...(key ? { filtre: key } : {}), ...(q ? { q } : {}) })}` : ""}`}
            className={cn("flex h-9 items-center rounded-pill px-3.5 text-[13px] font-medium", (filtre ?? "") === key ? "bg-brand text-on-brand" : "bg-brand-soft text-muted")}
          >
            {t(label)}
          </Link>
        ))}
      </div>
      <div className="overflow-x-auto rounded-card border border-border">
        <table className="w-full min-w-[720px] text-left text-[14px]">
          <thead className="bg-bg text-[12px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">{t("Kullanıcı")}</th>
              <th className="px-4 py-3 font-semibold">{t("Durum")}</th>
              <th className="px-4 py-3 font-semibold">{t("İlan")}</th>
              <th className="px-4 py-3 font-semibold">{t("Üyelik")}</th>
              <th className="px-4 py-3 font-semibold">{t("Son giriş")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-bg">
                <td className="px-4 py-3">
                  <Link href={`/yonetim/kullanicilar/${u.id}`} className="flex items-center gap-3">
                    <Avatar name={u.displayName} src={u.avatar} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium" translate="no">
                        {u.accountType === "store" && u.storeName ? u.storeName : u.displayName}
                        {u.role === "admin" ? <span className="ml-1.5 rounded bg-accent-soft px-1 text-[11px] font-semibold text-accent">admin</span> : null}
                      </span>
                      <span className="block truncate text-[12px] text-muted" translate="no">
                        {u.email}
                        {u.emailVerifiedAt ? "" : ` · ${t("doğrulanmadı")}`}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className={cn("px-4 py-3 font-medium", STATUS_TONE[u.status])}>{t(u.status)}</td>
                <td className="px-4 py-3 tabular">
                  {u.activeListings} / {u.soldListings}
                </td>
                <td className="px-4 py-3 text-muted">{f("formatDate", u.createdAt)}</td>
                <td className="px-4 py-3 text-muted">{u.lastSignInAt ? f("timeAgo", u.lastSignInAt) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        page={page}
        pages={users.length === 30 ? page + 1 : page}
        href={(p) => `/yonetim/kullanicilar?${new URLSearchParams({ ...(q ? { q } : {}), ...(filtre ? { filtre } : {}), ...(p > 1 ? { sayfa: String(p) } : {}) })}`}
      />
    </>
  );
}
