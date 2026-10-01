import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Suspense } from "react";
import { cookies, headers } from "next/headers";
import { Inter } from "next/font/google";
import { Header, MobileTabBar } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { OfflineBanner } from "@/components/OfflineBanner";
import { FavoritesProvider } from "@/components/FavoritesProvider";
import { RealtimeProvider } from "@/components/realtime/Realtime";
import { ToastProvider } from "@/components/ui/Toast";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { getFavoriteIds, getMe, getTaxonomy, getUnread } from "@/lib/api/server";
import { buildTree } from "@/lib/taxonomy";
import { REGION_COOKIE } from "@/lib/regions";
import { ADSENSE_CLIENT, adsEnabled, adsenseConfigured } from "@/lib/ads";
import { SITE } from "@/lib/site";
import { getI18n } from "@/lib/i18n/server";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export async function generateViewport(): Promise<Viewport> {
  const dark = (await cookies()).get("theme")?.value === "dark";
  return {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    // Browser chrome matches the theme actually shown (light unless chosen).
    themeColor: dark ? "#0b0d10" : "#ffffff",
  };
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: ["Kıbrıs ikinci el", "KKTC ikinci el", "Girne ikinci el", "Lefkoşa ikinci el", "ikinci el eşya", "satılık", "ilan"],
  openGraph: { type: "website", locale: SITE.locale, siteName: SITE.name },
  twitter: { card: "summary_large_image" },
  formatDetection: { telephone: false },
  // Lets AdSense verify site ownership during review.
  ...(adsenseConfigured ? { other: { "google-adsense-account": ADSENSE_CLIENT } } : {}),
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [me, taxonomy, favoriteIds, unread, cookieStore, requestHeaders, { locale, t }] = await Promise.all([
    getMe(),
    getTaxonomy(),
    getFavoriteIds(),
    getUnread(),
    cookies(),
    headers(),
    getI18n(),
  ]);
  // Per-request CSP nonce from src/proxy.ts; Next.js applies it to its own scripts.
  const nonce = requestHeaders.get("x-nonce") ?? undefined;
  const region = cookieStore.get(REGION_COOKIE)?.value ?? null;
  // Light by default, for every visitor, whatever the OS prefers. Dark only
  // when chosen; the choice lives in a cookie so the server renders the right
  // class and the first paint is already correct (no flash).
  const themeClass = cookieStore.get("theme")?.value === "dark" ? "dark" : "light";
  const restricted =
    me && (me.status === "restricted" || me.status === "suspended") && (!me.statusUntil || new Date(me.statusUntil) > new Date());
  const tree = buildTree(taxonomy.categories).map(function strip(c): import("@/components/Header").NavCategory {
    return { id: c.id, slug: c.slug, name: c.name, nameEn: c.nameEn, icon: c.icon, children: c.children.map(strip) };
  });

  return (
    <html lang={locale} className={`${inter.variable} antialiased ${themeClass}`}>
      <body className="flex min-h-dvh flex-col bg-surface font-sans text-text">
        <LocaleProvider initialLocale={locale}>
          <ToastProvider>
            <RealtimeProvider userId={me?.id ?? null}>
              <a
                href="#main-content"
                className="fixed left-4 top-[-100px] z-[100] rounded-button bg-brand px-4 py-2.5 text-sm font-semibold text-on-brand focus:top-3"
              >
                {t("İçeriğe atla")}
              </a>
              <OfflineBanner />
              {restricted ? (
                <div className="bg-warning-soft px-4 py-2 text-center text-[13px] text-text">
                  {t("Hesabın kısıtlı. İlan verme ve mesajlaşma geçici olarak kapalı.")}{" "}
                  <a href="/hesap-kisitlandi" className="font-semibold underline underline-offset-2">
                    {t("Ayrıntılar")}
                  </a>
                </div>
              ) : null}
              <Suspense>
                <Header
                  viewer={me ? { name: me.accountType === "store" && me.store.name ? me.store.name : me.displayName, avatar: me.avatar, isAdmin: me.role === "admin" } : null}
                  categories={tree}
                  region={region}
                  unread={unread}
                />
              </Suspense>
              <FavoritesProvider userKey={me?.id ?? "guest"} initialIds={favoriteIds}>
                <main id="main-content" tabIndex={-1} className="pb-safe flex-1 outline-none">
                  {children}
                </main>
              </FavoritesProvider>
              <Footer />
              <MobileTabBar signedIn={Boolean(me)} unread={unread} />
            </RealtimeProvider>
          </ToastProvider>
        </LocaleProvider>
        {adsEnabled ? (
          <Script
            id="adsense"
            async
            strategy="afterInteractive"
            crossOrigin="anonymous"
            nonce={nonce}
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
          />
        ) : null}
      </body>
    </html>
  );
}
