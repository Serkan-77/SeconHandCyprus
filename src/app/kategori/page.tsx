import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Icon, type IconName } from "@/components/icons";
import { getTaxonomy } from "@/lib/api/server";
import { searchPublic } from "@/lib/api/listings";
import { buildTree, categoryLabel, chainOf } from "@/lib/taxonomy";
import { getI18n } from "@/lib/i18n/server";

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
    <div className="mx-auto max-w-[1320px] px-4 pb-16 pt-4 sm:px-6 sm:pt-6">
      <Breadcrumbs items={[t("Kategoriler")]} />
      <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-[28px]">{t("Kategoriler")}</h1>
      <p className="mt-1 text-[14px] text-muted">{t("Aradığın eşyaya en kısa yoldan ulaş.")}</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tree.map((c) => (
          <section key={c.id} className="rounded-card border border-border p-5">
            <Link href={`/kategori/${c.slug}`} className="group flex items-center gap-3">
              <span className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-full bg-brand-soft transition group-hover:bg-accent-soft group-hover:text-accent">
                <Icon name={c.icon as IconName} className="h-6 w-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-semibold group-hover:text-accent">{categoryLabel(c, locale)}</span>
                <span className="text-[13px] text-muted">{t(`${f("formatNumber", counts.get(c.id) ?? 0)} ilan`)}</span>
              </span>
              <Icon name="chevron" className="h-4 w-4 text-subtle" />
            </Link>
            {c.children.length ? (
              <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-border pt-3">
                {c.children.map((s) => (
                  <li key={s.id}>
                    <Link href={`/kategori/${s.slug}`} className="flex min-h-9 items-center justify-between gap-2 text-[13px] text-muted hover:text-text">
                      <span className="truncate">{categoryLabel(s, locale)}</span>
                      {counts.get(s.id) ? <span className="text-[12px] text-subtle tabular">{counts.get(s.id)}</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>
    </div>
  );
}
