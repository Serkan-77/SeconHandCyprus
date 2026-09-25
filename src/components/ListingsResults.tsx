import Link from "next/link";
import { Fragment } from "react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Icon } from "@/components/icons";
import { LinkButton } from "@/components/ui/Button";
import { ListingCard } from "@/components/ListingCard";
import { AdSlot } from "@/components/AdSlot";
import { JsonLd } from "@/components/JsonLd";
import { ResultsFilters, SortSelect } from "@/components/ResultsFilters";
import { getCategories, searchListings, type Category, type ListingFilters } from "@/lib/queries";
import { regionNames } from "@/lib/regions";
import { absoluteUrl } from "@/lib/site";
import { cn } from "@/lib/cn";

export type ResultsParams = {
  q?: string;
  kategori?: string;
  sehir?: string;
  min?: string;
  max?: string;
  birim?: string;
  durum?: string | string[];
  tarih?: string;
  pazarlik?: string;
  sirala?: string;
  sayfa?: string;
};

export const PAGE_SIZE = 12;

/** Category pages live at /kategori/<slug>; everything else at /ilanlar. */
export function resultsHref(params: ResultsParams, drop: (key: string, value: string) => boolean = () => false, extra?: Record<string, string>) {
  const sp = new URLSearchParams();
  let category: string | undefined;
  Object.entries(params).forEach(([k, v]) => {
    if (v == null || k === "sayfa") return;
    ([] as string[]).concat(v).forEach((value) => {
      if (drop(k, value)) return;
      if (k === "kategori") category = value;
      else sp.append(k, value);
    });
  });
  Object.entries(extra ?? {}).forEach(([k, v]) => sp.set(k, v));
  const base = category ? `/kategori/${category}` : "/ilanlar";
  const query = sp.toString();
  return query ? `${base}?${query}` : base;
}

/** True when only indexable dimensions (category, city, page) are set. */
export function isIndexable(params: ResultsParams) {
  return Object.entries(params).every(([k, v]) => v == null || v === "" || ["kategori", "sehir", "sayfa"].includes(k));
}

export async function ListingsResults({ params: input, category }: { params: ResultsParams; category?: Category }) {
  const params: ResultsParams = { ...input, kategori: category?.slug };
  const categories = await getCategories();
  const conditions = ([] as string[]).concat(params.durum ?? []);
  const page = Math.max(1, Number(params.sayfa) || 1);

  const filters: ListingFilters = {
    q: params.q?.trim() || undefined,
    category: category?.slug,
    city: params.sehir && regionNames.includes(params.sehir) ? params.sehir : undefined,
    min: params.min ? Number(params.min) : undefined,
    max: params.max ? Number(params.max) : undefined,
    currency: params.birim === "TL" || params.birim === "€" ? params.birim : undefined,
    conditions,
    since: params.tarih === "1" || params.tarih === "7" || params.tarih === "30" ? params.tarih : undefined,
    negotiable: params.pazarlik === "1",
    sort: params.sirala === "artan" || params.sirala === "azalan" ? params.sirala : "yeni",
    page,
    pageSize: PAGE_SIZE,
  };
  const { items, total } = await searchListings(filters);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const title = filters.q
    ? `"${filters.q}" için sonuçlar`
    : category
      ? `${category.name} ilanları`
      : "Yeni evini arayan eşyalar";

  const pageHref = (p: number) => resultsHref(params, () => false, p > 1 ? { sayfa: String(p) } : undefined);

  const chips = [
    category && { label: category.name, key: "kategori" },
    filters.city && { label: filters.city, key: "sehir" },
    filters.q && { label: `"${filters.q}"`, key: "q" },
    filters.min != null && { label: `En az ${filters.min}`, key: "min" },
    filters.max != null && { label: `En çok ${filters.max}`, key: "max" },
    filters.currency && { label: filters.currency, key: "birim" },
    filters.since && { label: `Son ${filters.since} gün`, key: "tarih" },
    filters.negotiable && { label: "Pazarlığa açık", key: "pazarlik" },
    ...conditions.map((c) => ({ label: c, key: `durum:${c}` })),
  ].filter(Boolean) as { label: string; key: string }[];

  const withoutHref = (key: string) => resultsHref(params, (k, v) => k === key || `${k}:${v}` === key);

  const pages = Array.from({ length: pageCount }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === pageCount || Math.abs(p - page) <= 1,
  );

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: title,
    numberOfItems: total,
    itemListElement: items.map((l, i) => ({
      "@type": "ListItem",
      position: (page - 1) * PAGE_SIZE + i + 1,
      url: absoluteUrl(`/ilan/${l.slug}`),
      name: l.title,
    })),
  };

  return (
    <div className="mx-auto max-w-[1328px] px-4 pb-16 sm:px-6">
      <JsonLd data={itemList} />
      <Breadcrumbs items={category ? [{ label: "Kategoriler", href: "/kategori" }, category.name] : ["İlanlar"]} />
      <div className="mb-7 flex flex-wrap items-center justify-between gap-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[32px]">{title}</h1>
          <p className="mt-2 text-[13px] text-muted">
            {total} ilan bulundu{filters.city ? ` · ${filters.city}` : ""}.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[244px_minmax(0,1fr)] lg:gap-9">
        <ResultsFilters
          categories={categories.map((c) => ({ slug: c.slug, name: c.name }))}
          regions={regionNames}
          values={{
            kategori: category?.slug ?? "",
            sehir: filters.city ?? "",
            min: params.min ?? "",
            max: params.max ?? "",
            birim: filters.currency ?? "",
            durum: conditions,
            tarih: filters.since ?? "",
            pazarlik: filters.negotiable ?? false,
            q: filters.q ?? "",
            sirala: params.sirala ?? "",
          }}
          activeCount={chips.length}
        />

        <section className="min-w-0">
          <div className="mb-6 flex min-h-12 flex-wrap items-center justify-between gap-4">
            <div className="hidden flex-wrap gap-2 lg:flex">
              {chips.map((chip) => (
                <span
                  key={chip.key}
                  className="flex items-center gap-2 rounded-md border border-border py-1 pl-3 pr-1 text-[10px]"
                >
                  {chip.label}
                  <Link
                    href={withoutHref(chip.key)}
                    aria-label={`${chip.label} filtresini kaldır`}
                    className="grid h-[26px] w-[22px] place-items-center text-lg"
                  >
                    ×
                  </Link>
                </span>
              ))}
            </div>
            <SortSelect value={params.sirala ?? ""} />
          </div>

          {items.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5">
                {items.map((listing, i) => (
                  <Fragment key={listing.id}>
                    <ListingCard listing={listing} priority={i < 3} />
                    {/* One in-feed unit after the second row, only when results continue below it. */}
                    {i === 5 && items.length > 6 ? <AdSlot placement="results" className="col-span-full" /> : null}
                  </Fragment>
                ))}
              </div>

              {pageCount > 1 ? (
                <nav aria-label="Sonuç sayfaları" className="mt-10 flex flex-wrap items-center justify-center gap-2">
                  <Link
                    aria-label="Önceki sayfa"
                    aria-disabled={page === 1}
                    href={pageHref(Math.max(1, page - 1))}
                    className={cn(
                      "grid h-10 w-10 place-items-center rounded-md border border-border text-xs",
                      page === 1 && "pointer-events-none opacity-30",
                    )}
                  >
                    <Icon name="back" className="h-4 w-4" />
                  </Link>
                  {pages.map((p, i) => (
                    <span key={p} className="flex items-center gap-2">
                      {i > 0 && p - pages[i - 1] > 1 ? <span className="px-1 text-xs text-muted">…</span> : null}
                      <Link
                        href={pageHref(p)}
                        aria-current={p === page ? "page" : undefined}
                        className={cn(
                          "grid h-10 w-10 place-items-center rounded-md border text-xs",
                          p === page ? "border-brand bg-brand text-on-brand" : "border-border",
                        )}
                      >
                        {p}
                      </Link>
                    </span>
                  ))}
                  <Link
                    aria-label="Sonraki sayfa"
                    aria-disabled={page === pageCount}
                    href={pageHref(Math.min(pageCount, page + 1))}
                    className={cn(
                      "grid h-10 w-10 place-items-center rounded-md border border-border text-xs",
                      page === pageCount && "pointer-events-none opacity-30",
                    )}
                  >
                    <Icon name="chevron" className="h-4 w-4" />
                  </Link>
                </nav>
              ) : null}
            </>
          ) : (
            <div className="flex flex-col items-center gap-4 py-20 text-center">
              <span className="flex h-[100px] w-[100px] -rotate-6 items-center justify-center rounded-[35px] bg-brand-soft text-brand">
                <Icon name="search" className="h-11 w-11 rotate-6" />
              </span>
              <h2 className="text-xl font-semibold">Sonuç bulunamadı.</h2>
              <p className="max-w-xs text-sm text-muted">Farklı bir arama terimi dene ya da filtreleri değiştir.</p>
              <LinkButton href="/ilanlar" full={false} variant="secondary" className="min-w-[200px]">
                Tüm ilanları gör
              </LinkButton>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
