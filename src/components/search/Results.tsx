import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { ListingGrid } from "@/components/ListingCard";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { AdSlot } from "@/components/AdSlot";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { FiltersButton, FiltersSidebar, SortSelect } from "@/components/search/Filters";
import { apiServer, getTaxonomy } from "@/lib/api/server";
import type { Category, SearchResult } from "@/lib/api/types";
import { attributesFor, categoryLabel, chainOf, childrenOf } from "@/lib/taxonomy";
import { resultsHref, toApiQuery, type WebParams } from "@/lib/search";
import { getI18n } from "@/lib/i18n/server";
import { formatAttributeValue } from "@shared/attributes";

const PAGE_SIZE = 24;

async function search(params: WebParams, slug?: string): Promise<SearchResult> {
  try {
    return await apiServer<SearchResult>(`/listings?${toApiQuery(params, slug, PAGE_SIZE)}`, { anonymous: true, revalidate: 15 });
  } catch {
    return { items: [], total: -1, page: 1, pageSize: PAGE_SIZE, facets: [] };
  }
}

export async function Results({ params, category }: { params: WebParams; category?: Category }) {
  const [{ t, locale, f }, taxonomy, result] = await Promise.all([getI18n(), getTaxonomy(), search(params, category?.slug)]);
  const base = category ? `/kategori/${category.slug}` : "/ilanlar";
  const chain = category ? chainOf(taxonomy.categories, category.id) : [];
  const parent = chain.length > 1 ? chain[chain.length - 2] : null;
  const counts = new Map<number, number>();
  // Facets are per exact category; roll them up the tree so parents show totals.
  for (const { categoryId, count } of result.facets) {
    for (const c of chainOf(taxonomy.categories, categoryId)) counts.set(c.id, (counts.get(c.id) ?? 0) + count);
  }
  const subs = childrenOf(taxonomy.categories, category?.id ?? null).filter((c) => c.isActive);
  const filterable = category ? attributesFor(taxonomy.categories, taxonomy.attributes, category.id).filter((a) => a.filterable) : [];
  const page = Math.max(1, Number(params.sayfa) || 1);
  const pages = Math.max(1, Math.ceil(Math.max(0, result.total) / PAGE_SIZE));
  const q = typeof params.q === "string" ? params.q : "";
  const heading = q
    ? t(`"${q}" için sonuçlar`)
    : category
      ? categoryLabel(category, locale)
      : t("Tüm ilanlar");

  // Active filters as removable pills.
  const pills: { label: string; href: string }[] = [];
  const add = (key: string, label: string, value?: string) => {
    const current = String(params[key] ?? "");
    const next = value ? current.split(",").filter((v) => v !== value).join(",") : undefined;
    pills.push({ label, href: resultsHref(base, params, { [key]: next || undefined }) });
  };
  if (q) add("q", `“${q}”`);
  for (const c of String(params.sehir ?? "").split(",").filter(Boolean)) add("sehir", c, c);
  for (const c of String(params.durum ?? "").split(",").filter(Boolean)) add("durum", t(c), c);
  if (params.min || params.max) {
    pills.push({
      label: `${params.min ?? "0"} – ${params.max ?? "∞"} ${params.birim ?? ""}`.trim(),
      href: resultsHref(base, params, { min: undefined, max: undefined }),
    });
  }
  if (params.tarih) add("tarih", t(params.tarih === "1" ? "Son 24 saat" : `Son ${params.tarih} gün`));
  if (params.pazarlik) add("pazarlik", t("Pazarlığa açık"));
  if (params.magaza) add("magaza", t("Mağazalar"));
  if (params.vitrin) add("vitrin", t("Vitrin"));
  for (const a of filterable) {
    const key = `a.${a.key}`;
    const raw = params[key];
    if (raw) {
      for (const v of String(raw).split(",")) add(key, `${locale === "en" && a.labelEn ? a.labelEn : a.label}: ${formatAttributeValue(a, a.type === "boolean" ? true : v, locale) ?? v}`, v);
    }
    const min = params[`${key}.min`];
    const max = params[`${key}.max`];
    if (min || max) {
      pills.push({
        label: `${locale === "en" && a.labelEn ? a.labelEn : a.label}: ${min ?? "…"}–${max ?? "…"}${a.unit ? ` ${a.unit}` : ""}`,
        href: resultsHref(base, params, { [`${key}.min`]: undefined, [`${key}.max`]: undefined }),
      });
    }
  }

  const filterProps = {
    base,
    params,
    categorySlug: category?.slug,
    parent: parent ? { slug: parent.slug, name: parent.name, nameEn: parent.nameEn } : null,
    subcategories: subs.map((c) => ({ slug: c.slug, name: c.name, nameEn: c.nameEn, count: counts.get(c.id) })),
    attributes: filterable,
    regions: taxonomy.regions,
  };

  const crumbs = category
    ? [{ href: "/ilanlar", label: t("Tüm ilanlar") }, ...chain.map((c) => ({ href: `/kategori/${c.slug}`, label: categoryLabel(c, locale) }))]
    : [{ href: "/ilanlar", label: t("Tüm ilanlar") }];

  return (
    <div className="mx-auto max-w-[1320px] px-4 pb-16 pt-4 sm:px-6 sm:pt-6">
      <Breadcrumbs items={crumbs} />
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">{heading}</h1>
          <p className="mt-1 text-[14px] text-muted" aria-live="polite">
            {result.total < 0 ? t("İlanlar şu anda yüklenemedi.") : t(`${f("formatNumber", result.total)} ilan`)}
          </p>
        </div>
      </div>

      {subs.length ? (
        <nav aria-label={t("Alt kategoriler")} className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
          {subs.map((c) => (
            <Link
              key={c.id}
              href={resultsHref(`/kategori/${c.slug}`, params)}
              className="flex h-10 flex-shrink-0 items-center gap-2 rounded-pill border border-border bg-surface pl-2 pr-3.5 text-[13px] font-medium hover:border-border-strong hover:bg-brand-soft"
            >
              <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-soft">
                <Icon name={c.icon as IconName} className="h-4 w-4" />
              </span>
              {categoryLabel(c, locale)}
              {counts.get(c.id) ? <span className="text-[12px] text-subtle tabular">{counts.get(c.id)}</span> : null}
            </Link>
          ))}
        </nav>
      ) : null}

      <div className="mt-5 grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside className="hidden lg:block" aria-label={t("Filtreler")}>
          <div className="sticky top-[132px] max-h-[calc(100dvh-150px)] overflow-y-auto pr-2">
            <FiltersSidebar {...filterProps} />
          </div>
        </aside>

        <section aria-label={t("Sonuçlar")} className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="lg:hidden">
              <FiltersButton {...filterProps} activeCount={pills.filter((p) => !p.label.startsWith("“")).length} />
            </div>
            {pills.map((p) => (
              <Link
                key={p.href + p.label}
                href={p.href}
                className="hidden h-8 items-center gap-1.5 rounded-pill bg-brand-soft pl-3 pr-2 text-[13px] font-medium hover:bg-border sm:flex"
                aria-label={t(`Filtreyi kaldır: ${p.label}`)}
              >
                <span translate="no">{p.label}</span>
                <Icon name="close" className="h-3.5 w-3.5" />
              </Link>
            ))}
            {pills.length > 1 ? (
              <Link href={q ? `${base}?q=${encodeURIComponent(q)}` : base} className="hidden text-[13px] font-semibold text-accent hover:underline sm:inline">
                {t("Tümünü temizle")}
              </Link>
            ) : null}
            <div className="ml-auto">
              <SortSelect base={base} params={params} />
            </div>
          </div>

          {result.items.length ? (
            <>
              <ListingGrid items={result.items} priorityCount={4} className="lg:grid-cols-3 xl:grid-cols-4" />
              <Pagination
                page={page}
                pages={pages}
                href={(p) => resultsHref(base, params, { sayfa: p === 1 ? undefined : String(p) })}
                className="mt-10"
              />
              <AdSlot placement="results" className="mt-10" />
            </>
          ) : result.total < 0 ? (
            <EmptyState icon="refresh" tone="error" title={t("İlanlar yüklenemedi")}>
              {t("Bağlantıda bir sorun oldu. Sayfayı yenileyip tekrar dene.")}
            </EmptyState>
          ) : (
            <EmptyState
              icon="search"
              title={t("Bu aramaya uyan ilan yok")}
              action={
                <>
                  {pills.length ? (
                    <LinkButton href={base} variant="outline">
                      {t("Filtreleri temizle")}
                    </LinkButton>
                  ) : null}
                  <LinkButton href="/ilan-ver">{t("Sen ilan ver")}</LinkButton>
                </>
              }
            >
              {t("Filtreleri azaltmayı ya da farklı kelimelerle aramayı dene.")}
            </EmptyState>
          )}
        </section>
      </div>
    </div>
  );
}
