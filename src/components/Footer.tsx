
import * as I18n from "@/components/i18n/Localized";
import { Logo } from "@/components/Logo";
import { SITE } from "@/lib/site";

const columns = [
  {
    title: "Keşfet",
    links: [
      { href: "/ilanlar", label: "Tüm ilanlar" },
      { href: "/kategori", label: "Kategoriler" },
      { href: "/magazalar", label: "Mağazalar" },
      { href: "/konum", label: "Yakınımdakiler" },
    ],
  },
  {
    title: "Senin alanın",
    links: [
      { href: "/ilan-ver/fotograflar", label: "İlan ver" },
      { href: "/one-cikar", label: "İlanını öne çıkar" },
      { href: "/hesabim/magaza", label: "Mağaza aç" },
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
      <I18n.div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1.2fr] lg:gap-12">
        <div className="flex items-center justify-between sm:col-span-2 sm:block lg:col-span-1">
          <I18n.Link href="/" className="flex items-center">
            <Logo className="h-8 sm:h-10" />
          </I18n.Link>
          <I18n.p className="mt-0 text-xs text-muted sm:mt-5 sm:text-lg sm:leading-snug">
            Adadan eşyalara,
            <br className="hidden sm:inline" /> yeni hikâyelere.
          </I18n.p>
        </div>
        {columns.map((col) => (
          <I18n.div key={col.title}>
            <I18n.h3 className="mb-2.5 text-[13px] font-semibold">{col.title}</I18n.h3>
            {col.links.map((link) => (
              <I18n.Link
                key={link.href}
                href={link.href}
                className="flex min-h-8 items-center text-xs font-normal text-muted"
              >
                {link.label}
              </I18n.Link>
            ))}
          </I18n.div>
        ))}
      </I18n.div>
      <div className="mx-auto mt-9 flex max-w-[1280px] flex-wrap items-center gap-3 border-t border-border py-4 text-[10px] text-muted">
        <I18n.span>© 2026 {SITE.name}</I18n.span>
        <I18n.span>TL / EUR</I18n.span>
      </div>
    </footer>
  );
}
