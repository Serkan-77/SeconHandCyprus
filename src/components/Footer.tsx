import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

const columns = [
  {
    title: "Keşfet",
    links: [
      { href: "/ilanlar", label: "Tüm ilanlar" },
      { href: "/kategori", label: "Kategoriler" },
      { href: "/konum", label: "Yakınımdakiler" },
    ],
  },
  {
    title: "Senin alanın",
    links: [
      { href: "/ilan-ver/fotograflar", label: "İlan ver" },
      { href: "/hesabim", label: "Hesabım" },
      { href: "/giris", label: "Giriş yap" },
    ],
  },
  {
    title: "Yanındayız",
    links: [
      { href: "/hakkimizda", label: "Hakkımızda" },
      { href: "/yardim", label: "Yardım & güvenlik" },
      { href: "/destek", label: "Destek" },
      { href: "/kosullar", label: "Kullanım koşulları" },
      { href: "/gizlilik", label: "Gizlilik bildirimi" },
      { href: "/cerez-politikasi", label: "Çerez politikası" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-13 border-t border-border bg-bg px-4 pt-10 sm:px-6">
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1.2fr] lg:gap-12">
        <div className="flex items-center justify-between sm:col-span-2 sm:block lg:col-span-1">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand text-2xl tracking-[-2px] text-on-brand">
              k.
            </span>
            Kıbrıs İkinci El
          </Link>
          <p className="mt-0 text-xs text-muted sm:mt-5 sm:text-lg sm:leading-snug">
            Adadan eşyalara,
            <br className="hidden sm:inline" /> yeni hikâyelere.
          </p>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <h3 className="mb-2.5 text-[13px] font-semibold">{col.title}</h3>
            {col.links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex min-h-8 items-center text-xs font-normal text-muted"
              >
                {link.label}
              </Link>
            ))}
          </div>
        ))}
      </div>
      <div className="mx-auto mt-9 flex max-w-[1280px] flex-wrap items-center gap-3 border-t border-border py-4 text-[10px] text-muted">
        <span>© 2026 Kıbrıs İkinci El</span>
        <span>Türkçe · TL / EUR</span>
        <ThemeToggle className="ml-auto inline-flex min-h-8 items-center gap-2 text-[11px] text-muted" />
      </div>
    </footer>
  );
}
