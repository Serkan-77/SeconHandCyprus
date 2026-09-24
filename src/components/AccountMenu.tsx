"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Icon, type IconName } from "@/components/icons";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";
import { signOut } from "@/lib/actions/auth";

export function AccountMenu({
  profile,
  unread,
}: {
  profile: { displayName: string; avatarUrl: string | null; region: string | null; createdAt: string };
  unread: { messages: number; notifications: number };
}) {
  const pathname = usePathname();
  const items: { href: string; icon: IconName; label: string; count?: number }[] = [
    { href: "/hesabim", icon: "user", label: "Hesabım" },
    { href: "/hesabim/ilanlar", icon: "bag", label: "İlanlarım" },
    { href: "/hesabim/favoriler", icon: "heart", label: "Favorilerim" },
    { href: "/mesajlar", icon: "chat", label: "Mesajlarım", count: unread.messages },
    { href: "/hesabim/bildirimler", icon: "bell", label: "Bildirimler", count: unread.notifications },
    { href: "/hesabim/dogrulama", icon: "shield", label: "Doğrulama" },
    { href: "/hesabim/ayarlar", icon: "settings", label: "Ayarlar" },
  ];

  return (
    <aside className="h-max min-w-0 rounded-xl border border-border bg-surface p-4 sm:p-5">
      <div className="hidden items-center gap-2.5 border-b border-border pb-5 sm:flex">
        <Avatar initials={initials(profile.displayName)} src={profile.avatarUrl} />
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold">{profile.displayName}</h3>
          <span className="text-[10px] text-muted">
            {[profile.region, `${new Date(profile.createdAt).getFullYear()} üyesi`].filter(Boolean).join(" · ")}
          </span>
        </div>
      </div>
      <nav
        aria-label="Hesap menüsü"
        className="flex gap-2 overflow-x-auto py-2 sm:flex-col sm:overflow-visible sm:py-5"
      >
        {items.map((item) => {
          const active = item.href === "/hesabim" ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg border border-border px-3 py-2.5 text-xs sm:border-0 sm:whitespace-normal sm:text-xs",
                active && "bg-bg font-semibold text-accent sm:bg-bg",
              )}
            >
              <Icon name={item.icon} className="h-[18px] w-[18px] flex-shrink-0" />
              {item.label}
              {item.count ? (
                <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-accent-soft px-1 text-[10px] text-accent">
                  {item.count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <form action={signOut} className="hidden sm:block">
        <button type="submit" className="inline-flex items-center gap-2 text-[11px] text-muted hover:text-text">
          <Icon name="logout" className="h-4 w-4" />
          Çıkış yap
        </button>
      </form>
    </aside>
  );
}
