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
import { SHELL } from "@/lib/layout";
import { cn } from "@/lib/cn";

export type HeaderViewer = { name: string; avatar: ImageUrls | null; isAdmin: boolean } | null;
export type NavCategory = { id: number; slug: string; name: string; nameEn: string | null; icon: string; children: NavCategory[] };

function CountDot({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "absolute -right-2 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-on-accent ring-2 ring-surface tabular",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function useClickOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", handler);
    };
  }, [open, close]);
  return ref;
}

/**
 * The marketplace search: the strongest control on the page. On desktop it
 * carries a category scope and the region; on phones it is a single field.
 */
export function SearchBox({
  region,
  categories = [],
  className,
  size = "lg",
  autoFocus,
}: {
  region: string | null;
  categories?: NavCategory[];
  className?: string;
  size?: "lg" | "md";
  autoFocus?: boolean;
}) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();
  const onResults = pathname === "/ilanlar" || pathname.startsWith("/kategori/");
  const currentScope = pathname.startsWith("/kategori/") ? pathname.split("/")[2] ?? "" : "";
  const [q, setQ] = useState(onResults ? (params.get("q") ?? "") : "");
  const [scope, setScope] = useState(currentScope);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const next = new URLSearchParams(onResults ? params.toString() : "");
    next.delete("sayfa");
    if (q.trim()) next.set("q", q.trim());
    else next.delete("q");
    if (region && !onResults) next.set("sehir", region);
    const base = scope ? `/kategori/${scope}` : "/ilanlar";
    router.push(`${base}${next.size ? `?${next}` : ""}`);
  }

  const big = size === "lg";
  return (
    <form
      role="search"
      onSubmit={submit}
      className={cn(
        "flex min-w-0 items-center rounded-[14px] border-2 border-brand bg-surface transition focus-within:shadow-[0_0_0_4px_var(--accent-soft)]",
        big ? "h-[52px]" : "h-12",
        className,
      )}
    >
      {categories.length ? (
        <label className="relative hidden h-full flex-shrink-0 items-center border-r border-border xl:flex">
          <span className="sr-only">{t("Kategori")}</span>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="h-full max-w-[190px] cursor-pointer appearance-none truncate rounded-l-[12px] bg-transparent pl-4 pr-9 text-[14px] font-semibold text-text outline-none"
          >
            <option value="">{t("Tüm kategoriler")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {locale === "en" && c.nameEn ? c.nameEn : c.name}
              </option>
            ))}
          </select>
          <Icon name="down" className="pointer-events-none absolute right-3 h-4 w-4 text-muted" />
        </label>
      ) : null}
      <Icon name="search" className={cn("ml-4 h-5 w-5 flex-shrink-0 text-text", categories.length > 0 && "xl:hidden")} />
      <input
        type="search"
        name="q"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus={autoFocus}
        enterKeyHint="search"
        placeholder={t("Ne arıyorsun? Örn. bisiklet, iPhone, koltuk")}
        aria-label={t("İlan ara")}
        className="h-full min-w-0 flex-1 bg-transparent px-3 text-[15px] text-text outline-none placeholder:text-subtle xl:px-4 [&::-webkit-search-cancel-button]:hidden"
      />
      <Link
        href="/konum"
        className="hidden h-full flex-shrink-0 items-center gap-1.5 border-l border-border px-4 text-[13px] font-medium text-text hover:bg-brand-soft md:flex"
      >
        <Icon name="pin" className="h-4 w-4 text-accent" />
        {region ?? t("Tüm Kıbrıs")}
      </Link>
      <button
        type="submit"
        aria-label={t("Ara")}
        className={cn(
          "mr-1 flex flex-shrink-0 items-center justify-center gap-2 rounded-[10px] bg-brand font-semibold text-on-brand transition hover:opacity-90",
          big ? "h-[40px] px-3 sm:px-5" : "h-9 w-9",
        )}
      >
        <Icon name="search" className="h-[18px] w-[18px]" />
        {big ? <span className="hidden text-[14px] sm:inline">{t("Ara")}</span> : null}
      </button>
    </form>
  );
}

function AccountMenu({ viewer, unreadNotifications }: { viewer: NonNullable<HeaderViewer>; unreadNotifications: number }) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(open, () => setOpen(false));
  const router = useRouter();

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
        className="flex h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl px-2.5 text-[11.5px] font-medium hover:bg-brand-soft"
      >
        <span className="relative">
          <Avatar name={viewer.name} src={viewer.avatar} size="xs" />
          <CountDot count={unreadNotifications} />
        </span>
        <span className="max-w-[72px] truncate">{viewer.name.split(" ")[0]}</span>
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 animate-fade-in overflow-hidden rounded-2xl border border-border bg-surface shadow-lg">
          <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
            <Avatar name={viewer.name} src={viewer.avatar} size="md" />
            <div className="min-w-0">
              <p className="truncate font-semibold">{viewer.name}</p>
              <Link href="/hesabim" onClick={() => setOpen(false)} className="text-[13px] text-accent hover:underline">
                {t("Hesabını yönet")}
              </Link>
            </div>
          </div>
          <div className="py-1.5">
            {items.map((item) => (
              <Link
                key={item.href}
                role="menuitem"
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-[14px] hover:bg-brand-soft"
              >
                <Icon name={item.icon} className="h-[18px] w-[18px]" />
                <span className="flex-1">{t(item.label)}</span>
                {item.badge ? <span className="rounded-full bg-accent px-1.5 text-[11px] font-bold text-on-accent">{item.badge}</span> : null}
              </Link>
            ))}
          </div>
          <button role="menuitem" type="button" onClick={signOut} className="flex w-full items-center gap-3 border-t border-border px-4 py-3 text-left text-[14px] text-muted hover:bg-brand-soft hover:text-text">
            <Icon name="logout" className="h-[18px] w-[18px]" />
            {t("Çıkış yap")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Two-pane category menu: top-level list on the left, the chosen branch on the right. */
function CategoryMenu({ categories, onNavigate }: { categories: NavCategory[]; onNavigate: () => void }) {
  const { t, locale } = useLocale();
  const label = (c: NavCategory) => (locale === "en" && c.nameEn ? c.nameEn : c.name);
  const [activeId, setActiveId] = useState(categories[0]?.id);
  const active = categories.find((c) => c.id === activeId) ?? categories[0];
  if (!active) return null;
  return (
    <div className="grid min-h-[380px] grid-cols-[300px_1fr]">
      <ul className="border-r border-border py-3" role="list">
        {categories.map((c) => (
          <li key={c.id}>
            <Link
              href={`/kategori/${c.slug}`}
              onClick={onNavigate}
              onMouseEnter={() => setActiveId(c.id)}
              onFocus={() => setActiveId(c.id)}
              className={cn(
                "flex items-center gap-3 px-5 py-2.5 text-[14px]",
                c.id === active.id ? "bg-brand text-on-brand" : "hover:bg-brand-soft",
              )}
            >
              <Icon name={c.icon as IconName} className="h-[18px] w-[18px]" />
              <span className="flex-1 font-medium">{label(c)}</span>
              <Icon name="chevron" className="h-4 w-4 opacity-60" />
            </Link>
          </li>
        ))}
      </ul>
      <div className="p-7">
        <div className="mb-5 flex items-baseline justify-between gap-4">
          <p className="text-[22px] font-bold tracking-tight">{label(active)}</p>
          <Link href={`/kategori/${active.slug}`} onClick={onNavigate} className="text-[14px] font-semibold text-accent hover:underline">
            {t("Tümünü gör")} →
          </Link>
        </div>
        <ul className="grid grid-cols-2 gap-x-8 gap-y-1 xl:grid-cols-3">
          {active.children.map((s) => (
            <li key={s.id}>
              <Link href={`/kategori/${s.slug}`} onClick={onNavigate} className="group flex items-center gap-3 rounded-lg py-2 text-[14px] hover:text-accent">
                <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full border border-border group-hover:border-accent">
                  <Icon name={(s.icon || active.icon) as IconName} className="h-4 w-4" />
                </span>
                {label(s)}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function HeaderAction({ href, icon, label, badge }: { href: string; icon: IconName; label: string; badge?: number }) {
  return (
    <Link href={href} className="flex h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl px-2.5 text-[11.5px] font-medium hover:bg-brand-soft">
      <span className="relative">
        <Icon name={icon} className="h-[22px] w-[22px]" />
        {badge ? <CountDot count={badge} /> : null}
      </span>
      {label}
    </Link>
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
  const { t } = useLocale();
  const unread = useUnreadCounts(serverUnread);
  const [megaOpen, setMegaOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const focusMode = pathname.startsWith("/mesajlar") || pathname.startsWith("/ilan-ver") || pathname.startsWith("/yonetim");
  const megaRef = useClickOutside(megaOpen, () => setMegaOpen(false));

  // Close panels on navigation.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMegaOpen(false);
    setMenuOpen(false);
  }

  const discovery: { href: string; label: string; icon: IconName }[] = [
    { href: "/ilanlar?vitrin=1", label: "Vitrin", icon: "spark" },
    { href: "/ilanlar?sirala=yeni", label: "Yeni eklenenler", icon: "clock" },
    { href: region ? `/ilanlar?sehir=${encodeURIComponent(region)}` : "/konum", label: region ? `${region} yakını` : "Yakınımdakiler", icon: "pin" },
    { href: "/magazalar", label: "Mağazalar", icon: "store" },
  ];

  return (
    <header className="sticky top-0 z-40 bg-surface">
      {/* Main bar */}
      <div className="border-b border-border">
        <div className={cn(SHELL, "flex h-[60px] items-center gap-3 lg:h-[84px] lg:gap-6")}>
          <Link href="/" className="flex flex-shrink-0 items-center" aria-label={t("Ana sayfa")}>
            <Logo eager className="h-7 lg:h-10" />
          </Link>

          <SearchBox region={region} categories={categories} className="hidden flex-1 lg:flex" />

          <nav aria-label={t("Hesap")} className="ml-auto flex items-center gap-0.5 lg:ml-0">
            <div className="hidden items-center gap-0.5 lg:flex">
              <HeaderAction href="/hesabim/favoriler" icon="heart" label={t("Favoriler")} />
              <HeaderAction href="/mesajlar" icon="chat" label={t("Mesajlar")} badge={unread.messages} />
              {viewer ? (
                <AccountMenu viewer={viewer} unreadNotifications={unread.notifications} />
              ) : (
                <HeaderAction href="/giris" icon="user" label={t("Giriş yap")} />
              )}
              <Link
                href="/ilan-ver"
                className="ml-3 flex h-[52px] items-center gap-2 rounded-[14px] bg-brand px-6 text-[15px] font-semibold text-on-brand transition hover:opacity-90"
              >
                <Icon name="plus" className="h-5 w-5" />
                {t("İlan ver")}
              </Link>
            </div>

            {/* Phones and tablets: notifications + menu; the tab bar carries the rest. */}
            {viewer ? (
              <Link href="/hesabim/bildirimler" className="relative grid h-11 w-11 place-items-center rounded-full hover:bg-brand-soft lg:hidden" aria-label={t("Bildirimler")}>
                <span className="relative">
                  <Icon name="bell" className="h-[22px] w-[22px]" />
                  <CountDot count={unread.notifications} />
                </span>
              </Link>
            ) : (
              <Link href="/giris" className="flex h-10 items-center rounded-full px-3.5 text-[14px] font-semibold lg:hidden">
                {t("Giriş")}
              </Link>
            )}
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
      </div>

      {/* Phones: the search gets its own full-width row. */}
      {focusMode ? null : (
        <div className="border-b border-border px-4 py-2.5 sm:px-6 lg:hidden">
          <SearchBox region={region} size="md" />
        </div>
      )}

      {/* Desktop: categories menu + discovery shortcuts. */}
      <div ref={megaRef} className="relative hidden border-b border-border lg:block">
        <div className={cn(SHELL, "flex h-12 items-center gap-6")}>
          <button
            type="button"
            aria-expanded={megaOpen}
            aria-controls="mega-categories"
            onClick={() => setMegaOpen((v) => !v)}
            className={cn(
              "-ml-3 flex h-9 items-center gap-2 rounded-lg px-3 text-[14px] font-semibold",
              megaOpen ? "bg-brand text-on-brand" : "hover:bg-brand-soft",
            )}
          >
            <Icon name={megaOpen ? "close" : "grid"} className="h-[18px] w-[18px]" />
            {t("Kategoriler")}
          </button>
          <span className="h-5 w-px bg-border" aria-hidden />
          <nav aria-label={t("Keşfet")} className="flex min-w-0 flex-1 items-center gap-6">
            {discovery.map((d) => (
              <Link key={d.href} href={d.href} className="flex flex-shrink-0 items-center gap-2 text-[14px] font-medium text-text hover:text-accent">
                <Icon name={d.icon} className="h-4 w-4" />
                {t(d.label)}
              </Link>
            ))}
          </nav>
          <Link href="/yardim" className="flex-shrink-0 text-[13px] text-muted hover:text-text">
            {t("Yardım & güvenlik")}
          </Link>
          <AppearanceControls />
        </div>
        {megaOpen ? (
          <div id="mega-categories" className="absolute inset-x-0 top-full z-40 border-b border-border bg-surface shadow-lg">
            <div className={SHELL}>
              <CategoryMenu categories={categories} onNavigate={() => setMegaOpen(false)} />
            </div>
          </div>
        ) : null}
      </div>

      <Sheet title="Menü" open={menuOpen} onClose={() => setMenuOpen(false)} side="right">
        <div className="flex flex-col p-2">
          {viewer ? (
            <Link href="/hesabim" className="m-2 flex items-center gap-3 rounded-2xl bg-brand p-4 text-on-brand">
              <Avatar name={viewer.name} src={viewer.avatar} size="md" />
              <span className="min-w-0">
                <span className="block truncate font-semibold">{viewer.name}</span>
                <span className="text-[13px] opacity-75">{t("Hesabını yönet")}</span>
              </span>
            </Link>
          ) : (
            <div className="m-2 flex gap-2">
              <Link href="/giris" className="flex h-12 flex-1 items-center justify-center rounded-xl bg-brand text-[14px] font-semibold text-on-brand">
                {t("Giriş yap")}
              </Link>
              <Link href="/kayit" className="flex h-12 flex-1 items-center justify-center rounded-xl border border-brand text-[14px] font-semibold">
                {t("Üye ol")}
              </Link>
            </div>
          )}
          <p className="px-4 pb-1 pt-4 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">{t("Keşfet")}</p>
          {[...discovery, { href: "/kategori", label: "Tüm kategoriler", icon: "grid" as IconName }].map((item) => (
            <Link key={item.href} href={item.href} className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-[15px] hover:bg-brand-soft">
              <Icon name={item.icon} className="h-5 w-5" />
              <span className="flex-1">{t(item.label)}</span>
              <Icon name="chevron" className="h-4 w-4 text-subtle" />
            </Link>
          ))}
          {viewer ? (
            <>
              <p className="px-4 pb-1 pt-4 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">{t("Hesap")}</p>
              {[
                { href: "/hesabim/ilanlar", label: "İlanlarım", icon: "grid" as IconName },
                { href: "/hesabim/favoriler", label: "Favorilerim", icon: "heart" as IconName },
                { href: "/hesabim/ayarlar", label: "Ayarlar", icon: "settings" as IconName },
                ...(viewer.isAdmin ? [{ href: "/yonetim", label: "Yönetim paneli", icon: "chart" as IconName }] : []),
              ].map((item) => (
                <Link key={item.href} href={item.href} className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-[15px] hover:bg-brand-soft">
                  <Icon name={item.icon} className="h-5 w-5" />
                  <span className="flex-1">{t(item.label)}</span>
                  <Icon name="chevron" className="h-4 w-4 text-subtle" />
                </Link>
              ))}
            </>
          ) : null}
          <Link href="/yardim" className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-[15px] hover:bg-brand-soft">
            <Icon name="shield" className="h-5 w-5" />
            <span className="flex-1">{t("Yardım & güvenlik")}</span>
          </Link>
          <div className="m-2 mt-3 flex items-center justify-between rounded-2xl border border-border p-2 pl-3">
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
      className="m-2 flex min-h-12 items-center gap-3 rounded-xl px-3 text-left text-[15px] text-muted hover:bg-brand-soft"
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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-lg grid-cols-5">
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          const sell = tab.href === "/ilan-ver";
          return (
            <li key={tab.href} className="relative">
              {active ? <span className="absolute inset-x-5 top-0 h-[3px] rounded-b-full bg-brand" aria-hidden /> : null}
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn("flex h-full flex-col items-center justify-center gap-1 text-[11px]", active ? "font-semibold text-text" : "font-medium text-muted")}
              >
                <span className={cn("relative grid place-items-center", sell ? "-mt-5 h-12 w-12 rounded-2xl bg-brand text-on-brand shadow-md ring-4 ring-surface" : "h-6 w-6")}>
                  <Icon name={tab.icon} className={sell ? "h-6 w-6" : "h-[22px] w-[22px]"} strokeWidth={active || sell ? 2.2 : 1.8} />
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
