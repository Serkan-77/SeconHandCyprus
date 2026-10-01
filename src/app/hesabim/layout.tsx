import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AccountNav } from "@/components/account/AccountNav";
import { Icon } from "@/components/icons";
import { Avatar } from "@/components/ui/Avatar";
import { LinkButton } from "@/components/ui/Button";
import { Stars } from "@/components/ui/Stars";
import { getMe, getUnread } from "@/lib/api/server";
import { getI18n } from "@/lib/i18n/server";
import { SHELL } from "@/lib/layout";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { robots: { index: false } };

/** Account area: a profile band with the section tabs under it, then the page at full width. */
export default async function AccountLayout({ children }: { children: ReactNode }) {
  const [me, unread, { t, f }] = await Promise.all([getMe(), getUnread(), getI18n()]);
  if (!me) redirect("/giris?returnTo=/hesabim");
  const name = me.accountType === "store" && me.store.name ? me.store.name : me.displayName;
  return (
    <div className="pb-16">
      <div className="zone-band border-b border-border">
        <div className={cn(SHELL, "flex flex-wrap items-center gap-x-5 gap-y-4 pt-6 sm:pt-8")}>
          <Avatar name={name} src={me.avatar} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 truncate text-[24px] font-bold leading-tight tracking-[-0.02em] sm:text-[30px]" translate="no">
              <span className="truncate">{name}</span>
              {me.accountType === "store" && me.store.verified ? <Icon name="verified" className="h-6 w-6 flex-shrink-0 text-accent" /> : null}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[14px] text-muted">
              <span>{f("memberSince", me.createdAt)}</span>
              {me.region ? <span>{me.region}</span> : null}
              {me.rating.count ? (
                <span className="flex items-center gap-1.5 text-text">
                  <Stars value={me.rating.avg} />
                  <span className="font-semibold tabular">{f("decimal", me.rating.avg)}</span>
                  <span className="text-muted">({me.rating.count})</span>
                </span>
              ) : null}
            </p>
          </div>
          <div className="flex w-full gap-2 sm:w-auto [&>*]:flex-1 sm:[&>*]:flex-none">
            <LinkButton href={`/satici/${me.id}`} variant="secondary" size="sm">
              {t("Profilimi gör")}
            </LinkButton>
            <LinkButton href="/ilan-ver" size="sm" icon={<Icon name="plus" className="h-4 w-4" />}>
              {t("İlan ver")}
            </LinkButton>
          </div>
        </div>
        <div className={cn(SHELL, "mt-4")}>
          <AccountNav unread={unread} />
        </div>
      </div>
      <div className={cn(SHELL, "pt-6 sm:pt-8")}>{children}</div>
    </div>
  );
}
