
import * as I18n from "@/components/i18n/Localized";
import { AdminShell } from "@/components/admin/AdminShell";
import { Icon } from "@/components/icons";
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/queries";
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
        <I18n.h1 className="text-2xl font-semibold tracking-tight sm:text-[27px]">Manuel telefon incelemesi</I18n.h1>
        <I18n.p className="mt-1.5 text-xs text-muted">
          {requests?.length ?? 0} kullanıcının inceleme talebi bekliyor. Onay SMS doğrulaması değildir ve profillerde
          rozet olarak gösterilmez.
        </I18n.p>
      </div>

      {!requests || requests.length === 0 ? (
        <I18n.div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted">
          <Icon name="check" className="h-8 w-8 text-accent" />
          Bekleyen inceleme talebi yok.
        </I18n.div>
      ) : (
        <I18n.div className="overflow-hidden rounded-xl border border-border bg-surface">
          {requests.map((v) => {
            const user = one(v.user) as { id: string; display_name: string } | null;
            return (
              <div key={v.id} className="flex flex-wrap items-center gap-4 border-b border-border p-5 last:border-0">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                  <Icon name={v.kind === "phone" ? "phone" : "mail"} className="h-[18px] w-[18px]" />
                </span>
                <I18n.div className="min-w-0 flex-1">
                  {user ? (
                    <I18n.Link href={`/yonetim/kullanicilar/${user.id}`} className="text-sm font-semibold hover:text-accent">
                      <I18n.Raw>{user.display_name}</I18n.Raw>
                    </I18n.Link>
                  ) : (
                    <I18n.b className="text-sm">Silinmiş kullanıcı</I18n.b>
                  )}
                  <I18n.p className="mt-0.5 text-xs text-muted">
                    {v.kind === "phone" ? "Telefon incelemesi" : "E-posta incelemesi"} · {v.detail}
                  </I18n.p>
                  <I18n.span className="text-[10px] text-muted"><I18n.Formatted kind="formatDate" args={[v.created_at]} /></I18n.span>
                </I18n.div>
                <VerificationActions id={v.id} />
              </div>
            );
          })}
        </I18n.div>
      )}
    </>
  );
}
