"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";
import { Logo } from "@/components/Logo";
import { Avatar } from "@/components/ui/Avatar";
import { Sheet } from "@/components/ui/Sheet";
import { AppearanceControls } from "@/components/AppearanceControls";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { useUnreadCounts } from "@/lib/liveCounts";
import { api } from "@/lib/api/client";
import type { ImageUrls } from "@/lib/api/types";
import { cn } from "@/lib/cn";

export type HeaderViewer = { name: string; avatar: ImageUrls | null; isAdmin: boolean } | null;
export type NavCategory = { id: number; slug: string; name: string; nameEn: string | null; icon: string; children: NavCategory[] };

function CountDot({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "absolute -right-1.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-on-accent ring-2 ring-surface tabular",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function SearchBox({ region, className, autoFocus }: { region: string | null; className?: string; autoFocus?: boolean }) {
  const { t } = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();
  const onResults = pathname === "/ilanlar";
  const [q, setQ] = useState(onResults ? (params.get("q") ?? "") : "");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const next = new URLSearchParams(onResults ? params.toString() : "");
    next.delete("page");
    if (q.trim()) next.set("q", q.trim());
    else next.delete("q");
    if (region && !onResults) next.set("sehir", region);
    router.push(`/ilanlar${next.size ? `?${next}` : ""}`);
  }

  return (
    <form role="search" onSubmit={submit} className={cn("flex h-11 min-w-0 items-center rounded-full border border-border-strong bg-surface pl-4 pr-1.5 transition focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--accent-soft)]", className)}>
      <Icon name="search" className="h-[18px] w-[18px] flex-shrink-0 text-muted" />
      <input
        type="search"
        name="q"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus={autoFocus}
        enterKeyHint="search"
        placeholder={t("Ne arıyorsun? Örn. bisiklet, iPhone, koltuk")}
        aria-label={t("İlan ara")}
        className="h-full min-w-0 flex-1 bg-transparent px-3 text-[15px] text-text outline-none placeholder:text-subtle [&::-webkit-search-cancel-button]:hidden"
      />
      <Link
        href="/konum"
        className="hidden h-8 flex-shrink-0 items-center gap-1 rounded-full px-2.5 text-[12px] font-medium text-muted hover:bg-brand-soft hover:text-text md:flex"
      >
        <Icon name="pin" className="h-3.5 w-3.5" />
        {region ?? t("Tüm Kıbrıs")}
      </Link>
      <button type="submit" aria-label={t("Ara")} className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-brand text-on-brand">
        <Icon name="arrow" className="h-4 w-4" />
      </button>
    </form>
  );
}

function AccountMenu({ viewer, unreadNotifications }: { viewer: NonNullable<HeaderViewer>; unreadNotifications: number }) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  async function signOut() {
    await api.post("/auth/logout").catch(() => {});
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  const items: { href: string; label: string; icon: IconName; badge?: number }[] = [
    { href: "/hesabim", label: "Hesabım", icon: "user" },
    { href: "/hesabim/ilanlar", label: "İlanlarım", icon: "grid" },
    { href: "/hesabim/favoriler", label: "Favorilerim", icon: "heart" },
    { href: "/hesabim/bildirimler", label: "Bildirimler", icon: "bell", badge: unreadNotifications },
    { href: "/hesabim/ayarlar", label: "Ayarlar", icon: "settings" },
    ...(viewer.isAdmin ? [{ href: "/yonetim", label: "Yönetim paneli", icon: "chart" as IconName }] : []),
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-11 items-center gap-2 rounded-full pl-1 pr-2.5 hover:bg-brand-soft"
      >
        <span className="relative">
          <Avatar name={viewer.name} src={viewer.avatar} size="sm" />
          <CountDot count={unreadNotifications} />
        </span>
        <span className="max-w-[96px] truncate text-[13px] font-medium">{viewer.name.split(" ")[0]}</span>
        <Icon name="down" className="h-3.5 w-3.5 text-muted" />
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-[calc(100%+6px)] z-50 w-60 animate-fade-in overflow-hidden rounded-card border border-border bg-surface py-1.5 shadow-lg">
          {items.map((item) => (
            <Link
              key={item.href}
              role="menuitem"
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-[14px] hover:bg-brand-soft"
            >
              <Icon name={item.icon} className="h-[18px] w-[18px] text-muted" />
              <span className="flex-1">{t(item.label)}</span>
              {item.badge ? <span className="rounded-full bg-accent px-1.5 text-[11px] font-bold text-on-accent">{item.badge}</span> : null}
            </Link>
          ))}
          <div className="my-1.5 border-t border-border" />
          <button role="menuitem" type="button" onClick={signOut} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[14px] text-muted hover:bg-brand-soft hover:text-text">
            <Icon name="logout" className="h-[18px] w-[18px]" />
            {t("Çıkış yap")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function CategoriesPanel({ categories, onNavigate }: { categories: NavCategory[]; onNavigate: () => void }) {
  const { t, locale } = useLocale();
  const label = (c: NavCategory) => (locale === "en" && c.nameEn ? c.nameEn : c.name);
  return (
    <div className="grid gap-x-8 gap-y-6 p-6 sm:grid-cols-2 lg:grid-cols-5">
      {categories.map((c) => (
        <div key={c.id} className="min-w-0">
          <Link href={`/kategori/${c.slug}`} onClick={onNavigate} className="mb-2 flex items-center gap-2 text-[14px] font-semibold hover:text-accent">
            <Icon name={c.icon as IconName} className="h-[18px] w-[18px] text-muted" />
            {label(c)}
          </Link>
          <ul className="space-y-0.5">
            {c.children.slice(0, 7).map((s) => (
              <li key={s.id}>
                <Link href={`/kategori/${s.slug}`} onClick={onNavigate} className="block truncate py-1 text-[13px] text-muted hover:text-text">
                  {label(s)}
                </Link>
              </li>
            ))}
            {c.children.length > 7 ? (
              <li>
                <Link href={`/kategori/${c.slug}`} onClick={onNavigate} className="block py-1 text-[13px] font-medium text-accent">
                  {t("Tümünü gör")}
                </Link>
              </li>
            ) : null}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function Header({
  viewer,
  categories,
  region,
  unread: serverUnread,
}: {
  viewer: HeaderViewer;
  categories: NavCategory[];
  region: string | null;
  unread: { messages: number; notifications: number };
}) {
  const { t, locale } = useLocale();
  const unread = useUnreadCounts(serverUnread);
  const [megaOpen, setMegaOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const hideSearchOnMobile = pathname.startsWith("/mesajlar") || pathname.startsWith("/ilan-ver") || pathname.startsWith("/yonetim");
  const label = (c: NavCategory) => (locale === "en" && c.nameEn ? c.nameEn : c.name);

  // Close panels on navigation.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMegaOpen(false);
    setMenuOpen(false);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
      <div className="mx-auto flex h-14 max-w-[1320px] items-center gap-3 px-4 sm:h-16 sm:px-6 lg:gap-6">
        <Link href="/" className="flex flex-shrink-0 items-center" aria-label={t("Ana sayfa")}>
          <Logo priority className="h-7 sm:h-9" />
        </Link>

        <SearchBox region={region} className="hidden flex-1 lg:flex lg:max-w-[640px]" />

        <nav aria-label={t("Hesap")} className="ml-auto flex items-center gap-1">
          <div className="hidden lg:block">
            <AppearanceControls />
          </div>
          <Link href="/hesabim/favoriler" className="relative hidden h-11 w-11 place-items-center rounded-full hover:bg-brand-soft lg:grid" aria-label={t("Favorilerim")} title={t("Favorilerim")}>
            <Icon name="heart" className="h-[21px] w-[21px]" />
          </Link>
          <Link href="/mesajlar" className="relative hidden h-11 w-11 place-items-center rounded-full hover:bg-brand-soft lg:grid" aria-label={t("Mesajlar")} title={t("Mesajlar")}>
            <span className="relative">
              <Icon name="chat" className="h-[21px] w-[21px]" />
              <CountDot count={unread.messages} />
            </span>
          </Link>
          {viewer ? (
            <div className="hidden lg:block">
              <AccountMenu viewer={viewer} unreadNotifications={unread.notifications} />
            </div>
          ) : (
            <Link href="/giris" className="hidden h-10 items-center rounded-button px-4 text-[14px] font-semibold hover:bg-brand-soft lg:flex">
              {t("Giriş yap")}
            </Link>
          )}
          <Link
            href="/ilan-ver"
            className="hidden h-10 items-center gap-1.5 rounded-button bg-accent px-4 text-[14px] font-semibold text-on-accent transition hover:bg-accent-hover lg:flex"
          >
            <Icon name="plus" className="h-4 w-4" />
            {t("İlan ver")}
          </Link>

          {/* Phones and tablets: notifications + menu; the tab bar carries the rest. */}
          {viewer ? (
            <Link href="/hesabim/bildirimler" className="relative grid h-11 w-11 place-items-center rounded-full hover:bg-brand-soft lg:hidden" aria-label={t("Bildirimler")}>
              <span className="relative">
                <Icon name="bell" className="h-[21px] w-[21px]" />
                <CountDot count={unread.notifications} />
              </span>
            </Link>
          ) : null}
          <button
            type="button"
            aria-label={t("Menüyü aç")}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
            className="grid h-11 w-11 place-items-center rounded-full hover:bg-brand-soft lg:hidden"
          >
            <Icon name="more" className="h-6 w-6" />
          </button>
        </nav>
      </div>

      {hideSearchOnMobile ? null : (
        <div className="px-4 pb-3 sm:px-6 lg:hidden">
          <SearchBox region={region} />
        </div>
      )}

      <div className="hidden border-t border-border lg:block">
        <nav aria-label={t("Kategoriler")} className="mx-auto flex h-11 max-w-[1320px] items-center gap-1 px-6">
          <button
            type="button"
            aria-expanded={megaOpen}
            aria-controls="mega-categories"
            onClick={() => setMegaOpen((v) => !v)}
            className={cn("mr-2 flex h-9 items-center gap-2 rounded-button px-3 text-[13px] font-semibold", megaOpen ? "bg-brand text-on-brand" : "hover:bg-brand-soft")}
          >
            <Icon name="grid" className="h-4 w-4" />
            {t("Tüm kategoriler")}
            <Icon name={megaOpen ? "up" : "down"} className="h-3.5 w-3.5" />
          </button>
          <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            {categories.map((c) => (
              <Link key={c.id} href={`/kategori/${c.slug}`} className="flex h-9 flex-shrink-0 items-center whitespace-nowrap rounded-button px-3 text-[13px] text-muted hover:bg-brand-soft hover:text-text">
                {label(c)}
              </Link>
            ))}
          </div>
          <Link href="/magazalar" className="flex h-9 flex-shrink-0 items-center gap-1.5 rounded-button px-3 text-[13px] text-muted hover:bg-brand-soft hover:text-text">
            <Icon name="store" className="h-4 w-4" />
            {t("Mağazalar")}
          </Link>
        </nav>
        {megaOpen ? (
          <div id="mega-categories" className="absolute inset-x-0 top-full z-40 border-b border-border bg-surface shadow-lg">
            <div className="mx-auto max-w-[1320px]">
              <CategoriesPanel categories={categories} onNavigate={() => setMegaOpen(false)} />
            </div>
          </div>
        ) : null}
      </div>

      <Sheet title="Menü" open={menuOpen} onClose={() => setMenuOpen(false)} side="right">
        <div className="flex flex-col p-2">
          {viewer ? (
            <Link href="/hesabim" className="m-2 flex items-center gap-3 rounded-card bg-brand-soft p-3">
              <Avatar name={viewer.name} src={viewer.avatar} size="md" />
              <span className="min-w-0">
                <span className="block truncate font-semibold">{viewer.name}</span>
                <span className="text-[13px] text-muted">{t("Hesabını yönet")}</span>
              </span>
            </Link>
          ) : (
            <div className="m-2 flex gap-2">
              <Link href="/giris" className="flex h-11 flex-1 items-center justify-center rounded-button bg-brand text-[14px] font-semibold text-on-brand">
                {t("Giriş yap")}
              </Link>
              <Link href="/kayit" className="flex h-11 flex-1 items-center justify-center rounded-button border border-border-strong text-[14px] font-semibold">
                {t("Üye ol")}
              </Link>
            </div>
          )}
          {[
            { href: "/ilanlar", label: "Tüm ilanlar", icon: "search" as IconName },
            { href: "/kategori", label: "Kategoriler", icon: "grid" as IconName },
            { href: "/magazalar", label: "Mağazalar", icon: "store" as IconName },
            { href: "/konum", label: region ? `${region} yakını` : "Yakınımdakiler", icon: "pin" as IconName },
            ...(viewer
              ? [
                  { href: "/hesabim/ilanlar", label: "İlanlarım", icon: "grid" as IconName },
                  { href: "/hesabim/favoriler", label: "Favorilerim", icon: "heart" as IconName },
                  { href: "/hesabim/ayarlar", label: "Ayarlar", icon: "settings" as IconName },
                ]
              : []),
            ...(viewer?.isAdmin ? [{ href: "/yonetim", label: "Yönetim paneli", icon: "chart" as IconName }] : []),
            { href: "/yardim", label: "Yardım & güvenlik", icon: "shield" as IconName },
          ].map((item) => (
            <Link key={item.href} href={item.href} className="flex min-h-12 items-center gap-3 rounded-button px-3 text-[15px] hover:bg-brand-soft">
              <Icon name={item.icon} className="h-5 w-5 text-muted" />
              <span className="flex-1">{t(item.label)}</span>
              <Icon name="chevron" className="h-4 w-4 text-subtle" />
            </Link>
          ))}
          <div className="m-2 mt-3 flex items-center justify-between rounded-card border border-border p-2 pl-3">
            <span className="text-[13px] text-muted">{t("Dil ve görünüm")}</span>
            <AppearanceControls />
          </div>
          {viewer ? <SignOutRow /> : null}
        </div>
      </Sheet>
    </header>
  );
}

function SignOutRow() {
  const { t } = useLocale();
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await api.post("/auth/logout").catch(() => {});
        router.push("/");
        router.refresh();
      }}
      className="m-2 flex min-h-12 items-center gap-3 rounded-button px-3 text-left text-[15px] text-muted hover:bg-brand-soft"
    >
      <Icon name="logout" className="h-5 w-5" />
      {t("Çıkış yap")}
    </button>
  );
}

/** Bottom tab bar for phones and tablets. */
export function MobileTabBar({ signedIn, unread: serverUnread }: { signedIn: boolean; unread: { messages: number; notifications: number } }) {
  const { t } = useLocale();
  const pathname = usePathname();
  const unread = useUnreadCounts(serverUnread);
  // The chat thread and the listing form use the full height.
  if (/^\/mesajlar\/.+/.test(pathname) || pathname.startsWith("/ilan/") || pathname.startsWith("/ilan-ver") || pathname.startsWith("/yonetim")) return null;
  const tabs: { href: string; label: string; icon: IconName; match: (p: string) => boolean; badge?: number }[] = [
    { href: "/", label: "Keşfet", icon: "home", match: (p) => p === "/" },
    { href: "/kategori", label: "Kategoriler", icon: "grid", match: (p) => p.startsWith("/kategori") || p.startsWith("/ilanlar") },
    { href: "/ilan-ver", label: "İlan ver", icon: "plus", match: () => false },
    { href: "/mesajlar", label: "Mesajlar", icon: "chat", match: (p) => p.startsWith("/mesajlar"), badge: unread.messages },
    { href: signedIn ? "/hesabim" : "/giris", label: signedIn ? "Hesabım" : "Giriş", icon: "user", match: (p) => p.startsWith("/hesabim") || p === "/giris" },
  ];
  return (
    <nav
      aria-label={t("Ana gezinme")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-lg grid-cols-5">
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          const sell = tab.href === "/ilan-ver";
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn("flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium", active ? "text-text" : "text-muted")}
              >
                <span className={cn("relative grid place-items-center", sell ? "h-9 w-12 rounded-full bg-accent text-on-accent" : "h-6 w-6")}>
                  <Icon name={tab.icon} className={sell ? "h-5 w-5" : "h-[22px] w-[22px]"} strokeWidth={active ? 2.2 : 1.8} />
                  {tab.badge ? <CountDot count={tab.badge} className="-right-2.5 -top-1" /> : null}
                </span>
                {t(tab.label)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
