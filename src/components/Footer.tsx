import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Icon } from "@/components/icons";
import { SITE } from "@/lib/site";
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
  return (
    <footer className="mt-16 hidden border-t border-border bg-bg px-4 pt-12 sm:px-6 lg:block">
      <div className="mx-auto grid max-w-[1320px] grid-cols-[1.6fr_repeat(4,1fr)] gap-10">
        <div>
          <Link href="/" className="inline-flex items-center" aria-label={t("Ana sayfa")}>
            <Logo className="h-9" />
          </Link>
          <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-muted">{t("Kıbrıs'ın ikinci el pazarı. Ücretsiz ilan ver, satıcıyla doğrudan konuş, güvenle buluş.")}</p>
          <p className="mt-4 flex items-center gap-2 text-[13px] text-muted">
            <Icon name="shield" className="h-4 w-4" />
            {t("Ödemeyi ürünü görmeden yapma.")}{" "}
            <Link href="/yardim" className="font-medium text-accent hover:underline">
              {t("Güvenlik ipuçları")}
            </Link>
          </p>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <h3 className="mb-3 text-[13px] font-semibold">{t(col.title)}</h3>
            <ul className="space-y-1">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="flex min-h-8 items-center text-[13px] text-muted hover:text-text">
                    {t(link.label)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-10 flex max-w-[1320px] flex-wrap items-center justify-between gap-3 border-t border-border py-5 text-[12px] text-muted">
        <span>
          © {new Date().getFullYear()} {SITE.name}
        </span>
        <span>{t("Fiyatlar TL ve € olarak, satıcının belirttiği şekliyle gösterilir.")}</span>
      </div>
    </footer>
  );
}
