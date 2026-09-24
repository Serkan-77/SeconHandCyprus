import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountMenu } from "@/components/AccountMenu";
import { getUnreadCounts, getViewer } from "@/lib/queries";

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const [viewer, unread] = await Promise.all([getViewer(), getUnreadCounts()]);
  if (!viewer) redirect("/giris-gerekli?returnTo=/hesabim");

  return (
    <div className="mx-auto max-w-[1328px] px-4 py-6 sm:px-6">
      <nav aria-label="İçerik yolu" className="flex flex-wrap items-center gap-2.5 py-4 text-[11px] text-muted">
        <Link href="/">Ana sayfa</Link>
        <span>/</span>
        <span className="text-text">Hesabım</span>
      </nav>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[235px_minmax(0,1fr)] lg:gap-10">
        <AccountMenu
          profile={{
            displayName: viewer.profile.displayName,
            avatarUrl: viewer.profile.avatarUrl,
            region: viewer.profile.region,
            createdAt: viewer.profile.createdAt,
          }}
          unread={unread}
        />
        <section className="min-w-0">{children}</section>
      </div>
    </div>
  );
}
