"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";
import { cn } from "@/lib/cn";

const nav: { href: string; icon: IconName; label: string }[] = [
  { href: "/yonetim", icon: "chart", label: "Genel bakış" },
  { href: "/yonetim/ilanlar", icon: "bag", label: "İlan moderasyonu" },
  { href: "/yonetim/kullanicilar", icon: "users", label: "Kullanıcılar" },
  { href: "/yonetim/sikayetler", icon: "flag", label: "Şikayetler" },
  { href: "/yonetim/dogrulama", icon: "shield", label: "Telefon incelemesi" },
  { href: "/yonetim/destek", icon: "mail", label: "Destek talepleri" },
  { href: "/yonetim/kategoriler", icon: "grid", label: "Kategoriler" },
  { href: "/yonetim/duyurular", icon: "bell", label: "Duyurular" },
];

export function AdminNav({ counts }: { counts: Record<string, number> }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1.5 overflow-x-auto sm:flex-col sm:overflow-visible" aria-label="Yönetim menüsü">
      {nav.map((item) => {
        const active = item.href === "/yonetim" ? pathname === item.href : pathname.startsWith(item.href);
        const count = counts[item.href] ?? 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-shrink-0 items-center gap-3 whitespace-nowrap rounded-lg px-2.5 py-3 text-xs",
              active && "bg-white/20",
            )}
          >
            <Icon name={item.icon} className="h-[18px] w-[18px] flex-shrink-0" />
            {item.label}
            {count ? (
              <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-white px-1 text-[10px] font-semibold text-[#111318]">
                {count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
