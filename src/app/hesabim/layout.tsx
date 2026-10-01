import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AccountNav } from "@/components/account/AccountNav";
import { getMe, getUnread } from "@/lib/api/server";

export const metadata: Metadata = { robots: { index: false } };

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const [me, unread] = await Promise.all([getMe(), getUnread()]);
  if (!me) redirect("/giris?returnTo=/hesabim");
  return (
    <div className="mx-auto max-w-[1320px] px-4 pb-16 pt-4 sm:px-6 sm:pt-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-10">
        <AccountNav unread={unread} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
