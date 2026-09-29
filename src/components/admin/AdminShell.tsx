
import * as I18n from "@/components/i18n/Localized";
import type { ReactNode } from "react";
import { Icon } from "@/components/icons";
import { Logo } from "@/components/Logo";
import { signOut } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/queries";
import { AdminNav } from "./AdminNav";

export async function AdminShell({ children }: { children: ReactNode }) {
  const viewer = await requireAdmin();
  const supabase = await createClient();
  const [{ count: pendingListings }, { count: pendingReports }, { count: pendingVerifications }, { count: openTickets }] =
    await Promise.all([
      supabase.from("listings").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("reports").select("id", { count: "exact", head: true }).neq("status", "resolved"),
      supabase.from("verification_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
    ]);

  return (
    <div className="mx-auto my-6 max-w-[1440px] overflow-hidden rounded-xl border border-border px-0 sm:px-6">
      <div className="flex min-h-[820px] flex-col sm:flex-row">
        <aside className="flex flex-shrink-0 flex-col gap-5 bg-[#111318] p-4 text-white sm:w-[236px] sm:gap-6 sm:p-7">
          <div className="hidden sm:block">
            <Logo tone="dark" className="h-auto w-full" />
          </div>
          <I18n.span className="hidden text-[9px] tracking-[1.5px] text-white/60 sm:block">YÖNETİM</I18n.span>
          <AdminNav
            counts={{
              "/yonetim/ilanlar": pendingListings ?? 0,
              "/yonetim/sikayetler": pendingReports ?? 0,
              "/yonetim/dogrulama": pendingVerifications ?? 0,
              "/yonetim/destek": openTickets ?? 0,
            }}
          />
          <form action={signOut} className="mt-auto hidden sm:block">
            <I18n.button type="submit" className="flex items-center gap-2.5 text-[11px] text-white/70 hover:text-white">
              <Icon name="logout" className="h-4 w-4" />
              Çıkış yap
            </I18n.button>
          </form>
        </aside>

        <div className="min-w-0 flex-1 overflow-auto bg-bg">
          <div className="flex h-[76px] items-center justify-between gap-3 border-b border-border bg-surface px-5 text-xs sm:px-8">
            <I18n.span className="font-medium">Yönetim paneli</I18n.span>
            <I18n.span className="truncate text-muted">{viewer.user.email}</I18n.span>
          </div>
          <I18n.div className="flex flex-col gap-6 p-5 sm:p-8">{children}</I18n.div>
        </div>
      </div>
    </div>
  );
}
