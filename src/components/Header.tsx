"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import { LinkButton } from "@/components/ui/Button";
import { signOut } from "@/lib/actions/auth";

export type HeaderViewer = {
  name: string;
  isAdmin: boolean;
} | null;

function CountDot({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[9px] font-semibold text-surface">
      {count > 9 ? "9+" : count}
    </span>
  );
}

export function Header({
  viewer,
  categories,
  region,
  unread,
}: {
  viewer: HeaderViewer;
  categories: { icon: IconName; name: string; slug: string }[];
  region: string | null;
  unread: { messages: number; notifications: number };
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();

  const categoryNav = [
    { icon: "grid" as IconName, label: "Tüm kategoriler", href: "/kategori" },
    ...categories.slice(0, 6).map((c) => ({ icon: c.icon, label: c.name, href: `/kategori/${c.slug}` })),
  ];

  const mobileMenu = [
    { href: "/", label: "Keşfet" },
    { href: "/kategori", label: "Kategoriler" },
    { href: "/hesabim/favoriler", label: "Favorilerim" },
    { href: "/mesajlar", label: unread.messages ? `Mesajlarım (${unread.messages})` : "Mesajlarım" },
    { href: "/hesabim/bildirimler", label: unread.notifications ? `Bildirimler (${unread.notifications})` : "Bildirimler" },
    { href: "/hesabim", label: "Hesabım" },
    { href: "/ilan-ver/fotograflar", label: "İlan ver" },
    ...(viewer?.isAdmin ? [{ href: "/yonetim", label: "Yönetim paneli" }] : []),
    ...(viewer ? [] : [{ href: "/giris", label: "Giriş yap" }]),
    { href: "/yardim", label: "Yardım" },
  ];

  function onSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = event.currentTarget.querySelector("input");
    const q = input?.value.trim() ?? "";
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (region) params.set("sehir", region);
    const query = params.toString();
    router.push(query ? `/ilanlar?${query}` : "/ilanlar");
  }

  return (
    <header className="relative z-40 border-b border-border bg-surface">
      <div className="mx-auto flex max-w-[1328px] flex-wrap items-center gap-4 px-4 py-4 sm:gap-6 sm:px-6 sm:py-6">
        <Link href="/" className="flex flex-shrink-0 items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand text-2xl tracking-[-2px] text-on-brand">
            k.
          </span>
          <span>
            <span className="block text-[17px] font-bold tracking-[-0.6px]">Kıbrıs İkinci El</span>
            <small className="block text-[7px] tracking-[1.1px] text-muted">
              İYİ EŞYALARA İKİNCİ BİR HİKÂYE.
            </small>
          </span>
        </Link>

        <form
          onSubmit={onSearchSubmit}
          role="search"
          className="order-4 flex h-12 min-w-[200px] flex-1 basis-full overflow-hidden rounded-[10px] border border-border bg-bg sm:order-none sm:basis-auto"
        >
          <label className="flex min-w-0 flex-1 items-center gap-2.5 px-3.5 text-muted">
            <Icon name="search" className="h-4 w-4 flex-shrink-0" />
            <input
              name="q"
              type="search"
              placeholder="Bugün ne arıyorsun?"
              aria-label="İlan ara"
              className="w-full min-w-0 bg-transparent text-[13px] text-text outline-none"
            />
          </label>
          <Link
            href="/konum"
            className="hidden items-center gap-1.5 whitespace-nowrap border-l border-border px-2.5 text-[11px] sm:flex"
          >
            <Icon name="pin" className="h-4 w-4" />
            {region ?? "Tüm Kıbrıs"}
          </Link>
          <button
            type="submit"
            aria-label="Ara"
            className="m-1.5 flex w-9 items-center justify-center rounded-md bg-brand text-on-brand"
          >
            <Icon name="arrow" className="h-4 w-4" />
          </button>
        </form>

        <nav aria-label="Hesap bağlantıları" className="hidden gap-4 sm:flex">
          <Link href="/hesabim/favoriler" className="flex min-w-11 flex-col items-center gap-0.5 p-0.5 text-[10px]">
            <Icon name="heart" className="h-5 w-5" />
            Favoriler
          </Link>
          <Link href="/mesajlar" className="flex min-w-11 flex-col items-center gap-0.5 p-0.5 text-[10px]">
            <span className="relative">
              <Icon name="chat" className="h-5 w-5" />
              <CountDot count={unread.messages} />
            </span>
            Mesajlar
          </Link>
          {viewer ? (
            <Link href="/hesabim" className="flex min-w-11 flex-col items-center gap-0.5 p-0.5 text-[10px]">
              <span className="relative">
                <Icon name="user" className="h-5 w-5" />
                <CountDot count={unread.notifications} />
              </span>
              <span className="max-w-[72px] truncate">{viewer.name.split(" ")[0]}</span>
            </Link>
          ) : (
            <Link href="/giris" className="flex min-w-11 flex-col items-center gap-0.5 p-0.5 text-[10px]">
              <Icon name="user" className="h-5 w-5" />
              Giriş yap
            </Link>
          )}
          {viewer?.isAdmin ? (
            <Link href="/yonetim" className="flex min-w-11 flex-col items-center gap-0.5 p-0.5 text-[10px]">
              <Icon name="chart" className="h-5 w-5" />
              Yönetim
            </Link>
          ) : null}
        </nav>

        {/* The wrapper owns visibility: Button's own inline-flex would override `hidden`. */}
        <div className="hidden sm:block">
          <LinkButton
            href="/ilan-ver/fotograflar"
            full={false}
            icon={<Icon name="plus" className="h-4 w-4" />}
            className="whitespace-nowrap"
          >
            İlan ver
          </LinkButton>
        </div>

        <button
          type="button"
          aria-label={menuOpen ? "Menüyü kapat" : "Menüyü aç"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          className="relative ml-auto flex h-10 w-10 items-center justify-center rounded-[10px] sm:hidden"
        >
          <Icon name={menuOpen ? "close" : "grid"} className="h-5 w-5" />
          <CountDot count={unread.messages + unread.notifications} />
        </button>
      </div>

      <div className="border-t border-border">
        <nav
          aria-label="Kategoriler"
          className="no-scrollbar mx-auto flex h-[52px] max-w-[1280px] items-center gap-8 overflow-x-auto px-4 sm:px-6"
        >
          {categoryNav.map(({ icon, label, href }) => (
            <Link
              key={label}
              href={href}
              className="flex h-12 flex-shrink-0 items-center gap-2 whitespace-nowrap text-xs first:font-semibold"
            >
              <Icon name={icon} className="h-[17px] w-[17px] text-muted" />
              {label}
            </Link>
          ))}
          <Link href="/konum" className="ml-auto flex-shrink-0 whitespace-nowrap text-xs text-accent">
            <span className="inline-flex items-center gap-1.5">
              <Icon name="pin" className="h-4 w-4" />
              {region ? `${region} yakını` : "Yakınımdakiler"}
            </span>
          </Link>
        </nav>
      </div>

      {menuOpen ? (
        <nav aria-label="Mobil menü" className="grid gap-1 bg-surface p-4 sm:hidden">
          {mobileMenu.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              className="flex items-center justify-between border-b border-border p-3"
            >
              {label}
              <Icon name="chevron" className="h-4 w-4" />
            </Link>
          ))}
          {viewer ? (
            <form action={signOut}>
              <button type="submit" className="flex w-full items-center gap-2 p-3 text-left text-muted">
                <Icon name="logout" className="h-4 w-4" />
                Çıkış yap
              </button>
            </form>
          ) : null}
        </nav>
      ) : null}
    </header>
  );
}
