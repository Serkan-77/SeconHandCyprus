import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { Inter } from "next/font/google";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { OfflineBanner } from "@/components/OfflineBanner";
import { FavoritesProvider } from "@/components/FavoritesProvider";
import { getCategories, getFavoriteIds, getUnreadCounts, getViewer } from "@/lib/queries";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { REGION_COOKIE } from "@/lib/regions";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Kıbrıs İkinci El — İyi eşyalara ikinci bir hikâye",
    template: "%s · Kıbrıs İkinci El",
  },
  description:
    "Kıbrıs'ta ikinci el mobilya, elektronik, giyim ve daha fazlası. Adadan insanlarla doğrudan iletişim, ücretsiz ilan.",
  applicationName: "Kıbrıs İkinci El",
  openGraph: {
    type: "website",
    locale: "tr_TR",
    siteName: "Kıbrıs İkinci El",
    images: [{ url: "/images/demo-chair.jpg", width: 1200, height: 800, alt: "Kıbrıs İkinci El" }],
  },
  twitter: { card: "summary_large_image" },
};


export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [viewer, categories, favoriteIds, unread, cookieStore] = await Promise.all([
    getViewer(),
    getCategories(),
    getFavoriteIds(),
    getUnreadCounts(),
    cookies(),
  ]);
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
      </body>
    </html>
  );
}
