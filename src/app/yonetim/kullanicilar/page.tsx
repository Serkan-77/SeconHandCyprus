
import * as I18n from "@/components/i18n/Localized";
import { AdminShell } from "@/components/admin/AdminShell";
import { Badge } from "@/components/ui/Badge";
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/queries";
import { accountStatus } from "@/lib/adminLabels";

export const metadata = { title: "Yönetim · Kullanıcılar", robots: { index: false } };


export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  return (
    <AdminShell>
      <Users q={q} />
    </AdminShell>
  );
}

async function Users({ q }: { q?: string }) {
  const supabase = await createClient();
  let query = supabase
    .from("profiles")
    .select("id, display_name, role, status, created_at, private:profile_private(email)", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(200);
  if (q) query = query.ilike("display_name", `%${q.replace(/[%,]/g, " ")}%`);
  const { data: users, count } = await query;
  const ids = (users ?? []).map((u) => u.id);
  const { data: statRows } = ids.length
    ? await supabase.from("seller_stats").select("seller_id, active_listings, sold_listings").in("seller_id", ids)
    : { data: [] };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <I18n.h1 className="text-2xl font-semibold tracking-tight sm:text-[27px]">Kullanıcı yönetimi</I18n.h1>
          <I18n.p className="mt-1.5 text-xs text-muted">{count ?? 0} kayıtlı kullanıcı.</I18n.p>
        </div>
        <form className="flex gap-2">
          <I18n.input
            name="q"
            defaultValue={q}
            placeholder="İsimle ara"
            aria-label="Kullanıcı ara"
            className="min-h-10 rounded-button border border-border bg-surface px-3 text-xs"
          />
          <I18n.button className="min-h-10 rounded-button bg-brand px-3 text-xs text-on-brand">Ara</I18n.button>
        </form>
      </div>

      <div className="overflow-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[680px] text-left text-xs">
          <thead>
            <tr className="bg-bg text-[10px] text-muted">
              <I18n.th className="p-3 font-medium">Kullanıcı</I18n.th>
              <I18n.th className="p-3 font-medium">E-posta</I18n.th>
              <I18n.th className="p-3 font-medium">Aktif / satılan</I18n.th>
              <I18n.th className="p-3 font-medium">Üyelik</I18n.th>
              <I18n.th className="p-3 font-medium">Durum</I18n.th>
              <th className="p-3 font-medium" />
            </tr>
          </thead>
          <I18n.tbody>
            {(users ?? []).map((user) => {
              const email = (one(user.private) as { email: string | null } | null)?.email;
              const stats = (statRows ?? []).find((r) => r.seller_id === user.id);
              const status = accountStatus[user.status] ?? accountStatus.active;
              return (
                <tr key={user.id} className="border-b border-border last:border-0">
                  <I18n.td className="p-3 font-medium">
                    <I18n.Raw>{user.display_name}</I18n.Raw>
                    {user.role === "admin" ? <I18n.span className="ml-1.5 text-[10px] text-accent">yönetici</I18n.span> : null}
                  </I18n.td>
                  <I18n.td className="p-3 text-muted">{email ?? "—"}</I18n.td>
                  <I18n.td className="p-3">
                    {stats?.active_listings ?? 0} / {stats?.sold_listings ?? 0}
                  </I18n.td>
                  <I18n.td className="p-3 text-muted"><I18n.Formatted kind="formatDate" args={[user.created_at]} /></I18n.td>
                  <td className="p-3">
                    <Badge kind={status.kind}>{status.label}</Badge>
                  </td>
                  <td className="p-3">
                    <I18n.Link href={`/yonetim/kullanicilar/${user.id}`} className="text-[11px] font-medium text-accent">
                      Detay
                    </I18n.Link>
                  </td>
                </tr>
              );
            })}
          </I18n.tbody>
        </table>
      </div>
    </>
  );
}
