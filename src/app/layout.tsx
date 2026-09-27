import type { Metadata, Viewport } from "next";
import Link from "next/link";
import Script from "next/script";
import { cookies, headers } from "next/headers";
import { Inter } from "next/font/google";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { OfflineBanner } from "@/components/OfflineBanner";
import { FavoritesProvider } from "@/components/FavoritesProvider";
import { LiveUpdates } from "@/components/LiveUpdates";
import { getCategories, getFavoriteIds, getUnreadCounts, getViewer } from "@/lib/queries";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { REGION_COOKIE } from "@/lib/regions";
import { ADSENSE_CLIENT, adsEnabled, adsenseConfigured } from "@/lib/ads";
import { SITE } from "@/lib/site";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#181b20" },
  ],
};

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


export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [viewer, categories, favoriteIds, unread, cookieStore, requestHeaders] = await Promise.all([
    getViewer(),
    getCategories(),
    getFavoriteIds(),
    getUnreadCounts(),
    cookies(),
    headers(),
  ]);
  // Per-request CSP nonce from src/proxy.ts; Next.js applies it to its own scripts.
  const nonce = requestHeaders.get("x-nonce") ?? undefined;
  const region = cookieStore.get(REGION_COOKIE)?.value ?? null;
  // Explicit theme choice lives in a cookie so the server renders the right
  // class; without one, CSS follows prefers-color-scheme.
  const theme = cookieStore.get("theme")?.value;
  const themeClass = theme === "dark" || theme === "light" ? theme : "";
  const restricted =
    viewer &&
    (viewer.profile.status === "restricted" || viewer.profile.status === "suspended") &&
    (!viewer.profile.statusUntil || new Date(viewer.profile.statusUntil) > new Date());

  return (
    <html lang="tr" className={`${inter.variable} antialiased ${themeClass}`}>
      <body className="flex min-h-screen flex-col bg-surface font-sans text-text">
        <a
          href="#main-content"
          className="fixed left-4 top-[-100px] z-[100] rounded bg-brand px-3 py-2 text-on-brand focus:top-3"
        >
          İçeriğe atla
        </a>
        <OfflineBanner />
        {!isSupabaseConfigured ? (
          <div className="bg-accent-soft px-4 py-2 text-center text-xs text-accent">
            Veritabanı bağlantısı yapılandırılmadı: <code>.env.local</code> içine Supabase anahtarlarını ekle.
          </div>
        ) : null}
        {restricted ? (
          <div className="bg-brand-soft px-4 py-2 text-center text-xs">
            Hesabın kısıtlı. İlan verme ve mesajlaşma geçici olarak kapalı.{" "}
            <Link href="/hesap-kisitlandi" className="font-semibold text-accent">
              Ayrıntılar
            </Link>
          </div>
        ) : null}
        <Header
          viewer={viewer ? { name: viewer.profile.displayName, isAdmin: viewer.profile.role === "admin" } : null}
          categories={categories.map((c) => ({ icon: c.icon, name: c.name, slug: c.slug }))}
          region={region}
          unread={unread}
        />
        <FavoritesProvider key={viewer?.user.id ?? "guest"} initialIds={favoriteIds}>
          <main id="main-content" tabIndex={-1} className="flex-1">
            {children}
          </main>
        </FavoritesProvider>
        <Footer />
        {viewer ? <LiveUpdates key={viewer.user.id} userId={viewer.user.id} /> : null}
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
