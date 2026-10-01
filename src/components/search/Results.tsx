import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { ListingGrid } from "@/components/ListingCard";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { AdSlot } from "@/components/AdSlot";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { FiltersButton, RegionSelect, SortSelect } from "@/components/search/Filters";
import { apiServer, getTaxonomy } from "@/lib/api/server";
import type { Category, SearchResult } from "@/lib/api/types";
import { attributesFor, categoryLabel, chainOf, childrenOf } from "@/lib/taxonomy";
import { resultsHref, toApiQuery, type WebParams } from "@/lib/search";
import { getI18n } from "@/lib/i18n/server";
import { SHELL } from "@/lib/layout";
import { cn } from "@/lib/cn";
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

  // One-tap filters: real, link-based toggles.
  const toggles: { key: string; value: string; label: string; icon: IconName }[] = [
    { key: "vitrin", value: "1", label: "Vitrin", icon: "spark" },
    { key: "tarih", value: "1", label: "Son 24 saat", icon: "clock" },
    { key: "pazarlik", value: "1", label: "Pazarlığa açık", icon: "handshake" },
    { key: "magaza", value: "1", label: "Mağazalar", icon: "store" },
  ];
  const activeCount = pills.filter((p) => !p.label.startsWith("“")).length;

  return (
    <div className="pb-16">
      {/* Title band (grey) */}
      <div className="zone-band pb-6">
      <div className={cn(SHELL, "pt-4 sm:pt-6")}>
        <Breadcrumbs items={crumbs} />
        <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="text-[28px] font-bold leading-tight tracking-[-0.025em] sm:text-[38px]">{heading}</h1>
          <p className="text-[15px] text-muted" aria-live="polite">
            {result.total < 0 ? t("İlanlar şu anda yüklenemedi.") : (
              <>
                <span className="font-semibold text-text tabular">{f("formatNumber", result.total)}</span> {t("ilan")}
              </>
            )}
          </p>
        </div>
        {parent && category ? (
          <Link href={`/kategori/${parent.slug}`} className="mt-1 inline-block text-[14px] text-muted hover:text-text">
            ← {categoryLabel(parent, locale)}
          </Link>
        ) : null}
      </div>

      {/* Subcategories as visual tiles */}
      {subs.length ? (
        <nav aria-label={t("Alt kategoriler")} className={cn(SHELL, "mt-5")}>
          <ul className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 sm:-mx-6 sm:px-6 xl:mx-0 xl:px-0">
            {subs.map((c) => {
              const n = counts.get(c.id) ?? 0;
              return (
                <li key={c.id} className="flex-shrink-0">
                  <Link
                    href={resultsHref(`/kategori/${c.slug}`, params)}
                    className="flex h-[76px] w-[168px] flex-col justify-between rounded-2xl border border-border bg-surface p-3 transition hover:border-brand"
                  >
                    <span className="flex items-center justify-between">
                      <Icon name={c.icon as IconName} className="h-5 w-5" />
                      <span className={cn("text-[12px] tabular", n ? "font-semibold text-text" : "text-subtle")}>{n}</span>
                    </span>
                    <span className="truncate text-[13.5px] font-semibold">{categoryLabel(c, locale)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}

      </div>

      {/* Sticky toolbar: all filters, quick toggles, region, sort */}
      <div className="sticky top-[calc(var(--header-h)-1px)] z-30 border-y border-border bg-surface">
        <div className={cn(SHELL, "no-scrollbar flex h-16 items-center gap-2 overflow-x-auto")}>
          <FiltersButton {...filterProps} activeCount={activeCount} className="lg:hidden" />
          <FiltersButton {...filterProps} activeCount={activeCount} side="left" className="hidden lg:flex" />
          <span className="mx-1 h-6 w-px flex-shrink-0 bg-border" aria-hidden />
          {toggles.map((tg) => {
            const on = params[tg.key] === tg.value;
            return (
              <Link
                key={tg.key}
                href={resultsHref(base, params, { [tg.key]: on ? undefined : tg.value })}
                aria-pressed={on}
                className={cn(
                  "flex h-10 flex-shrink-0 items-center gap-2 rounded-full border px-4 text-[14px] font-medium transition",
                  on ? "border-brand bg-brand text-on-brand" : "border-border-strong hover:border-brand",
                )}
              >
                <Icon name={tg.icon} className="h-4 w-4" />
                {t(tg.label)}
              </Link>
            );
          })}
          <RegionSelect base={base} params={params} regions={taxonomy.regions} />
          <div className="ml-auto pl-2">
            <SortSelect base={base} params={params} />
          </div>
        </div>
      </div>

      <section aria-label={t("Sonuçlar")} className={cn(SHELL, "mt-6")}>
        {pills.length ? (
          <div className="mb-5 flex flex-wrap items-center gap-2">
            {pills.map((p) => (
              <Link
                key={p.href + p.label}
                href={p.href}
                className="flex h-8 items-center gap-1.5 rounded-full bg-brand-soft pl-3 pr-2 text-[13px] font-medium hover:bg-border"
                aria-label={t(`Filtreyi kaldır: ${p.label}`)}
              >
                <span translate="no">{p.label}</span>
                <Icon name="close" className="h-3.5 w-3.5" />
              </Link>
            ))}
            {pills.length > 1 ? (
              <Link href={q ? `${base}?q=${encodeURIComponent(q)}` : base} className="ml-1 text-[13px] font-semibold underline underline-offset-4 hover:text-accent">
                {t("Tümünü temizle")}
              </Link>
            ) : null}
          </div>
        ) : null}

        {result.items.length ? (
          <>
            <ListingGrid items={result.items} priorityCount={6} />
            <Pagination
              page={page}
              pages={pages}
              href={(p) => resultsHref(base, params, { sayfa: p === 1 ? undefined : String(p) })}
              className="mt-12"
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
                  <LinkButton href={base} variant="secondary">
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
  );
}
