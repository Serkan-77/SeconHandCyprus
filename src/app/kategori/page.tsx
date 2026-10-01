import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Icon, type IconName } from "@/components/icons";
import { getTaxonomy } from "@/lib/api/server";
import { searchPublic } from "@/lib/api/listings";
import { buildTree, categoryLabel, chainOf } from "@/lib/taxonomy";
import { getI18n } from "@/lib/i18n/server";
import { SHELL } from "@/lib/layout";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Kategoriler",
  description: "Kıbrıs'ta ikinci el ilanları kategorilere göre keşfet: elektronik, ev & mobilya, giyim, bebek, spor ve daha fazlası.",
  alternates: { canonical: "/kategori" },
};

export default async function CategoriesPage() {
  const [{ t, f, locale }, taxonomy, all] = await Promise.all([getI18n(), getTaxonomy(), searchPublic({ pageSize: 1, facets: 1 }, 120)]);
  const counts = new Map<number, number>();
  for (const { categoryId, count } of all.facets) {
    for (const c of chainOf(taxonomy.categories, categoryId)) counts.set(c.id, (counts.get(c.id) ?? 0) + count);
  }
  const tree = buildTree(taxonomy.categories.filter((c) => c.isActive));

  return (
    <div className="pb-16">
      <div className="zone-band">
      <div className={cn(SHELL, "pb-6 pt-4 sm:pt-6")}>
        <Breadcrumbs items={[t("Kategoriler")]} />
        <div className="mt-2 flex flex-wrap items-baseline gap-x-4">
          <h1 className="text-[30px] font-bold leading-tight tracking-[-0.025em] sm:text-[40px]">{t("Kategoriler")}</h1>
          <p className="text-[15px] text-muted">
            <span className="font-semibold text-text tabular">{f("formatNumber", all.total)}</span> {t("ilan yayında")}
          </p>
        </div>
      </div>

      </div>

      {/* Jump bar */}
      <nav aria-label={t("Bölümler")} className="sticky top-[130px] z-20 border-b border-border bg-surface/95 backdrop-blur lg:top-[134px]">
        <ul className={cn(SHELL, "no-scrollbar flex h-14 items-center gap-2 overflow-x-auto")}>
          {tree.map((c) => (
            <li key={c.id} className="flex-shrink-0">
              <a href={`#${c.slug}`} className="flex h-10 items-center gap-2 rounded-full border border-border-strong px-4 text-[14px] font-medium hover:border-brand">
                <Icon name={c.icon as IconName} className="h-4 w-4" />
                {categoryLabel(c, locale)}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className={SHELL}>
        {tree.map((c) => (
          <section key={c.id} id={c.slug} className="grid scroll-mt-[200px] gap-5 border-b border-border py-9 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-10">
            <div>
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand text-on-brand">
                <Icon name={c.icon as IconName} className="h-7 w-7" />
              </span>
              <h2 className="mt-4 text-[24px] font-bold tracking-[-0.02em]">{categoryLabel(c, locale)}</h2>
              <p className="mt-0.5 text-[14px] text-muted">{t(`${f("formatNumber", counts.get(c.id) ?? 0)} ilan`)}</p>
              <Link href={`/kategori/${c.slug}`} className="mt-4 inline-block border-b-2 border-brand pb-0.5 text-[14px] font-semibold hover:border-accent hover:text-accent">
                {t("Tümünü gör")}
              </Link>
            </div>
            {c.children.length ? (
              <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {c.children.map((s) => {
                  const n = counts.get(s.id) ?? 0;
                  return (
                    <li key={s.id}>
                      <Link href={`/kategori/${s.slug}`} className="flex h-[88px] flex-col justify-between rounded-2xl border border-border p-3.5 transition hover:border-brand">
                        <span className="flex items-center justify-between">
                          <Icon name={(s.icon || c.icon) as IconName} className="h-5 w-5" />
                          <span className={cn("text-[12.5px] tabular", n ? "font-semibold" : "text-subtle")}>{n}</span>
                        </span>
                        <span className="line-clamp-2 text-[14px] font-semibold leading-tight">{categoryLabel(s, locale)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </section>
        ))}
      </div>
    </div>
  );
}
