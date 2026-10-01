"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { useUnreadCounts } from "@/lib/liveCounts";
import { cn } from "@/lib/cn";

const ITEMS: { href: string; label: string; icon: IconName; exact?: boolean; badge?: "notifications" }[] = [
  { href: "/hesabim", label: "Özet", icon: "home", exact: true },
  { href: "/hesabim/ilanlar", label: "İlanlarım", icon: "grid" },
  { href: "/mesajlar", label: "Mesajlar", icon: "chat" },
  { href: "/hesabim/favoriler", label: "Favorilerim", icon: "heart" },
  { href: "/hesabim/bildirimler", label: "Bildirimler", icon: "bell", badge: "notifications" },
  { href: "/hesabim/magaza", label: "Mağaza", icon: "store" },
  { href: "/hesabim/dogrulama", label: "Güven ve doğrulama", icon: "shield" },
  { href: "/hesabim/ayarlar", label: "Ayarlar", icon: "settings" },
];

export function AccountNav({ unread }: { unread: { messages: number; notifications: number } }) {
  const { t } = useLocale();
  const pathname = usePathname();
  const counts = useUnreadCounts(unread);
  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <>
      {/* Phones and tablets: a scrollable row of tabs. */}
      <nav aria-label={t("Hesap menüsü")} className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto border-b border-border px-4 pb-3 lg:hidden">
        {ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(item.href, item.exact) ? "page" : undefined}
            className={cn(
              "flex h-9 flex-shrink-0 items-center gap-1.5 rounded-pill px-3 text-[13px] font-medium",
              isActive(item.href, item.exact) ? "bg-brand text-on-brand" : "bg-brand-soft text-muted",
            )}
          >
            {t(item.label)}
            {item.badge && counts.notifications ? <span className="rounded-full bg-accent px-1.5 text-[11px] font-bold text-on-accent">{counts.notifications}</span> : null}
          </Link>
        ))}
      </nav>

      {/* Desktop: a sidebar. */}
      <nav aria-label={t("Hesap menüsü")} className="hidden lg:block">
        <ul className="sticky top-[132px] space-y-0.5">
          {ITEMS.map((item) => {
            const active = isActive(item.href, item.exact);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn("flex h-11 items-center gap-3 rounded-button px-3 text-[14px]", active ? "bg-brand-soft font-semibold" : "text-muted hover:bg-bg hover:text-text")}
                >
                  <Icon name={item.icon} className="h-[18px] w-[18px]" />
                  <span className="flex-1">{t(item.label)}</span>
                  {item.badge && counts.notifications ? <span className="rounded-full bg-accent px-1.5 text-[11px] font-bold text-on-accent">{counts.notifications}</span> : null}
                  {item.href === "/mesajlar" && counts.messages ? <span className="rounded-full bg-accent px-1.5 text-[11px] font-bold text-on-accent">{counts.messages}</span> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
