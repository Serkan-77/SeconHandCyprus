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

  // One row of section tabs for every screen size (scrolls on phones).
  return (
    <nav aria-label={t("Hesap menüsü")} className="no-scrollbar -mx-4 flex gap-6 overflow-x-auto px-4 sm:-mx-6 sm:px-6 xl:mx-0 xl:px-0">
      {ITEMS.map((item) => {
        const active = isActive(item.href, item.exact);
        const badge = item.badge ? counts.notifications : item.href === "/mesajlar" ? counts.messages : 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px flex h-12 flex-shrink-0 items-center gap-2 border-b-2 text-[14px]",
              active ? "border-brand font-semibold text-text" : "border-transparent font-medium text-muted hover:text-text",
            )}
          >
            <Icon name={item.icon} className="h-[18px] w-[18px]" />
            {t(item.label)}
            {badge ? <span className="rounded-full bg-accent px-1.5 text-[11px] font-bold text-on-accent tabular">{badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
