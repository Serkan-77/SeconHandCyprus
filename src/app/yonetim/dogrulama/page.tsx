import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { Icon } from "@/components/icons";
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/queries";
import { formatDate } from "@/lib/format";
import { VerificationActions } from "./VerificationActions";

export const metadata = { title: "Yönetim · Telefon incelemesi", robots: { index: false } };

export default async function AdminVerificationPage() {
  return (
    <AdminShell>
      <Verifications />
    </AdminShell>
  );
}

async function Verifications() {
  const supabase = await createClient();
  const { data: requests } = await supabase
    .from("verification_requests")
    .select("id, kind, detail, created_at, user:profiles!verification_requests_user_id_fkey(id, display_name)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[27px]">Manuel telefon incelemesi</h1>
        <p className="mt-1.5 text-xs text-muted">
          {requests?.length ?? 0} kullanıcının inceleme talebi bekliyor. Onay SMS doğrulaması değildir ve profillerde
          rozet olarak gösterilmez.
        </p>
      </div>

      {!requests || requests.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted">
          <Icon name="check" className="h-8 w-8 text-accent" />
          Bekleyen inceleme talebi yok.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          {requests.map((v) => {
            const user = one(v.user) as { id: string; display_name: string } | null;
            return (
              <div key={v.id} className="flex flex-wrap items-center gap-4 border-b border-border p-5 last:border-0">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                  <Icon name={v.kind === "phone" ? "phone" : "mail"} className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  {user ? (
                    <Link href={`/yonetim/kullanicilar/${user.id}`} className="text-sm font-semibold hover:text-accent">
                      {user.display_name}
                    </Link>
                  ) : (
                    <b className="text-sm">Silinmiş kullanıcı</b>
                  )}
                  <p className="mt-0.5 text-xs text-muted">
                    {v.kind === "phone" ? "Telefon incelemesi" : "E-posta incelemesi"} · {v.detail}
                  </p>
                  <span className="text-[10px] text-muted">{formatDate(v.created_at)}</span>
                </div>
                <VerificationActions id={v.id} />
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
