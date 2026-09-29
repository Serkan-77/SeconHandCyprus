"use client";
import * as I18n from "@/components/i18n/Localized";


import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import { Logo } from "@/components/Logo";
import { LinkButton } from "@/components/ui/Button";
import { signOut } from "@/lib/actions/auth";
import { useUnreadCounts } from "@/lib/liveCounts";
import { AppearanceControls } from "@/components/AppearanceControls";

export type HeaderViewer = {
  name: string;
  isAdmin: boolean;
} | null;

function CountDot({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <I18n.span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[9px] font-semibold text-surface">
      {count > 9 ? "9+" : count}
    </I18n.span>
  );
}

export function Header({
  viewer,
  categories,
  region,
  unread: serverUnread,
}: {
  viewer: HeaderViewer;
  categories: { icon: IconName; name: string; slug: string }[];
  region: string | null;
  unread: { messages: number; notifications: number };
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const unread = useUnreadCounts(serverUnread);
  const router = useRouter();

  const categoryNav = [
    { icon: "grid" as IconName, label: "Tüm kategoriler", href: "/kategori" },
    ...categories.slice(0, 6).map((c) => ({ icon: c.icon, label: c.name, href: `/kategori/${c.slug}` })),
  ];

  const mobileMenu = [
    { href: "/", label: "Keşfet" },
    { href: "/kategori", label: "Kategoriler" },
    { href: "/magazalar", label: "Mağazalar" },
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
    <I18n.header className="relative z-40 border-b border-border bg-surface">
      <div className="mx-auto flex max-w-[1328px] flex-wrap items-center gap-2 px-4 py-4 sm:gap-4 sm:px-6 sm:py-6">
        <I18n.Link href="/" className="flex flex-shrink-0 items-center">
          <Logo priority className="h-5 min-[375px]:h-7 sm:h-9 lg:h-11" />
        </I18n.Link>

        <form
          onSubmit={onSearchSubmit}
          role="search"
          className="order-4 flex h-12 min-w-0 flex-1 basis-full overflow-hidden rounded-[10px] border border-border bg-bg lg:order-none lg:basis-auto"
        >
          <label className="flex min-w-0 flex-1 items-center gap-2.5 px-3.5 text-muted">
            <Icon name="search" className="h-4 w-4 flex-shrink-0" />
            <I18n.input
              name="q"
              type="search"
              placeholder="Bugün ne arıyorsun?"
              aria-label="İlan ara"
              className="w-full min-w-0 bg-transparent text-[13px] text-text outline-none"
            />
          </label>
          <I18n.Link
            href="/konum"
            className="hidden items-center gap-1.5 whitespace-nowrap border-l border-border px-2.5 text-[11px] sm:flex"
          >
            <Icon name="pin" className="h-4 w-4" />
            {region ?? "Tüm Kıbrıs"}
          </I18n.Link>
          <I18n.button
            type="submit"
            aria-label="Ara"
            className="m-1.5 flex w-9 items-center justify-center rounded-md bg-brand text-on-brand"
          >
            <Icon name="arrow" className="h-4 w-4" />
          </I18n.button>
        </form>

        <I18n.nav aria-label="Hesap bağlantıları" className="hidden gap-3 lg:flex">
          <I18n.Link href="/hesabim/favoriler" className="flex min-w-11 flex-col items-center gap-0.5 p-0.5 text-[10px]">
            <Icon name="heart" className="h-5 w-5" />
            Favoriler
          </I18n.Link>
          <I18n.Link href="/mesajlar" className="flex min-w-11 flex-col items-center gap-0.5 p-0.5 text-[10px]">
            <span className="relative">
              <Icon name="chat" className="h-5 w-5" />
              <CountDot count={unread.messages} />
            </span>
            Mesajlar
          </I18n.Link>
          {viewer ? (
            <I18n.Link href="/hesabim" className="flex min-w-11 flex-col items-center gap-0.5 p-0.5 text-[10px]">
              <span className="relative">
                <Icon name="user" className="h-5 w-5" />
                <CountDot count={unread.notifications} />
              </span>
              <I18n.span className="max-w-[72px] truncate"><I18n.Raw>{viewer.name.split(" ")[0]}</I18n.Raw></I18n.span>
            </I18n.Link>
          ) : (
            <I18n.Link href="/giris" className="flex min-w-11 flex-col items-center gap-0.5 p-0.5 text-[10px]">
              <Icon name="user" className="h-5 w-5" />
              Giriş yap
            </I18n.Link>
          )}
          {viewer?.isAdmin ? (
            <I18n.Link href="/yonetim" className="flex min-w-11 flex-col items-center gap-0.5 p-0.5 text-[10px]">
              <Icon name="chart" className="h-5 w-5" />
              Yönetim
            </I18n.Link>
          ) : null}
        </I18n.nav>

        {/* The wrapper owns visibility: Button's own inline-flex would override `hidden`. */}
        <div className="hidden lg:block">
          <LinkButton
            href="/ilan-ver/fotograflar"
            full={false}
            icon={<Icon name="plus" className="h-4 w-4" />}
            className="whitespace-nowrap"
          >
            İlan ver
          </LinkButton>
        </div>

        <div className="ml-auto lg:ml-0">
          <AppearanceControls />
        </div>
        <I18n.button
          type="button"
          aria-label={menuOpen ? "Menüyü kapat" : "Menüyü aç"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] lg:hidden"
        >
          <Icon name={menuOpen ? "close" : "grid"} className="h-5 w-5" />
          <CountDot count={unread.messages + unread.notifications} />
        </I18n.button>
      </div>

      <div className="border-t border-border">
        <I18n.nav
          aria-label="Kategoriler"
          className="no-scrollbar mx-auto flex h-[52px] max-w-[1280px] items-center gap-8 overflow-x-auto px-4 sm:px-6"
        >
          {categoryNav.map(({ icon, label, href }) => (
            <I18n.Link
              key={label}
              href={href}
              className="flex h-12 flex-shrink-0 items-center gap-2 whitespace-nowrap text-xs first:font-semibold"
            >
              <Icon name={icon} className="h-[17px] w-[17px] text-muted" />
              {label}
            </I18n.Link>
          ))}
          <I18n.Link
            href="/magazalar"
            className="flex h-12 flex-shrink-0 items-center gap-2 whitespace-nowrap text-xs"
          >
            <Icon name="store" className="h-[17px] w-[17px] text-muted" />
            Mağazalar
          </I18n.Link>
          <I18n.Link href="/konum" className="ml-auto flex-shrink-0 whitespace-nowrap text-xs text-accent">
            <I18n.span className="inline-flex items-center gap-1.5">
              <Icon name="pin" className="h-4 w-4" />
              {region ? `${region} yakını` : "Yakınımdakiler"}
            </I18n.span>
          </I18n.Link>
        </I18n.nav>
      </div>

      {menuOpen ? (
        <I18n.nav aria-label="Mobil menü" className="grid gap-1 bg-surface p-4 lg:hidden">
          {mobileMenu.map(({ href, label }) => (
            <I18n.Link
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              className="flex items-center justify-between border-b border-border p-3"
            >
              {label}
              <Icon name="chevron" className="h-4 w-4" />
            </I18n.Link>
          ))}
          {viewer ? (
            <form action={signOut}>
              <I18n.button type="submit" className="flex w-full items-center gap-2 p-3 text-left text-muted">
                <Icon name="logout" className="h-4 w-4" />
                Çıkış yap
              </I18n.button>
            </form>
          ) : null}
        </I18n.nav>
      ) : null}
    </I18n.header>
  );
}
