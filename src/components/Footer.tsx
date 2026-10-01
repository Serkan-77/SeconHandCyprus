import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Icon } from "@/components/icons";
import { SITE } from "@/lib/site";
import { SHELL } from "@/lib/layout";
import { cn } from "@/lib/cn";
import { getI18n } from "@/lib/i18n/server";

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
    title: "Satış yap",
    links: [
      { href: "/ilan-ver", label: "İlan ver" },
      { href: "/hesabim/ilanlar", label: "İlanlarım" },
      { href: "/hesabim/magaza", label: "Mağaza aç" },
      { href: "/one-cikar", label: "İlanını öne çıkar" },
    ],
  },
  {
    title: "Yardım",
    links: [
      { href: "/yardim", label: "Yardım & güvenlik" },
      { href: "/destek", label: "Destek" },
      { href: "/hakkimizda", label: "Hakkımızda" },
    ],
  },
  {
    title: "Yasal",
    links: [
      { href: "/kosullar", label: "Kullanım koşulları" },
      { href: "/gizlilik", label: "Gizlilik bildirimi" },
      { href: "/cerez-politikasi", label: "Çerez politikası" },
    ],
  },
];

export async function Footer() {
  const { t } = await getI18n();
  // One compact dark band: brand line + the link groups side by side, then the legal line.
  return (
    <footer data-site-footer className="dark hidden bg-bg text-text lg:block">
      <div className={cn(SHELL, "flex gap-16 py-10")}>
        <div className="w-[300px] flex-shrink-0">
          <Link href="/" className="inline-flex items-center" aria-label={t("Ana sayfa")}>
            <Logo className="h-8" />
          </Link>
          <p className="mt-3 text-[13px] leading-relaxed text-muted">{t("Kıbrıs'ın ikinci el pazarı. Ücretsiz ilan ver, satıcıyla doğrudan konuş, güvenle buluş.")}</p>
          <Link href="/yardim" className="mt-4 inline-flex items-center gap-2 text-[13px] font-medium text-text hover:underline">
            <Icon name="shield" className="h-4 w-4" />
            {t("Ödemeyi ürünü görmeden yapma.")}
          </Link>
        </div>
        <div className="grid flex-1 grid-cols-4 gap-8">
          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="mb-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">{t(col.title)}</h3>
              <ul className="space-y-0.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="flex min-h-7 items-center text-[13.5px] text-text/85 hover:text-text">
                      {t(link.label)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-border">
        <div className={cn(SHELL, "flex h-12 items-center justify-between text-[12px] text-muted")}>
          <span>
            © {new Date().getFullYear()} {SITE.name}
          </span>
          <span>{t("Fiyatlar TL ve € olarak, satıcının belirttiği şekliyle gösterilir.")}</span>
        </div>
      </div>
    </footer>
  );
}
