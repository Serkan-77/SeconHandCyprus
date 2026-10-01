"use client";

import { useMemo, useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { Category } from "@/lib/api/types";
import { categoryLabel, chainOf, childrenOf } from "@/lib/taxonomy";
import { cn } from "@/lib/cn";

const fold = (s: string) =>
  s
    .toLocaleLowerCase("tr-TR")
    .replace(/[çğıöşü]/g, (c) => ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" })[c] ?? c);

/** Pick a category: search by name, or drill down from the top level to a leaf. */
export function CategoryPicker({
  categories,
  value,
  onSelect,
}: {
  categories: Category[];
  value: number | null;
  onSelect: (id: number) => void;
}) {
  const { t, locale } = useLocale();
  const active = useMemo(() => categories.filter((c) => c.isActive), [categories]);
  const [parent, setParent] = useState<number | null>(() => {
    if (!value) return null;
    const chain = chainOf(active, value);
    return chain.length > 1 ? chain[chain.length - 2].id : null;
  });
  const [query, setQuery] = useState("");
  const label = (c: Category) => categoryLabel(c, locale);

  const results = useMemo(() => {
    const q = fold(query.trim());
    if (q.length < 2) return [];
    return active
      .filter((c) => !childrenOf(active, c.id).length)
      .map((c) => ({ c, path: chainOf(active, c.id) }))
      .filter(({ path }) => path.some((p) => fold(p.name).includes(q) || fold(p.nameEn ?? "").includes(q)))
      .slice(0, 12);
  }, [active, query]);

  const level = childrenOf(active, parent);
  const trail = parent ? chainOf(active, parent) : [];

  function choose(c: Category) {
    if (childrenOf(active, c.id).length) {
      setParent(c.id);
      setQuery("");
    } else onSelect(c.id);
  }

  return (
    <div>
      <div className="relative">
        <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("Kategori ara: örn. telefon, koltuk, bisiklet")}
          aria-label={t("Kategori ara")}
          className="h-12 w-full rounded-field border border-border-strong bg-surface pl-11 pr-4 text-[15px] focus:border-accent focus:outline-none"
        />
      </div>

      {query.trim().length >= 2 ? (
        <ul className="mt-3 overflow-hidden rounded-card border border-border" aria-label={t("Arama sonuçları")}>
          {results.length ? (
            results.map(({ c, path }) => (
              <li key={c.id} className="border-b border-border last:border-b-0">
                <button type="button" onClick={() => onSelect(c.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-brand-soft">
                  <Icon name={(path[0]?.icon ?? "grid") as IconName} className="h-5 w-5 flex-shrink-0 text-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{label(c)}</span>
                    <span className="block truncate text-[12px] text-muted">{path.slice(0, -1).map(label).join(" › ")}</span>
                  </span>
                  <Icon name="chevron" className="h-4 w-4 text-subtle" />
                </button>
              </li>
            ))
          ) : (
            <li className="px-4 py-6 text-center text-[14px] text-muted">{t("Eşleşen kategori yok. Aşağıdan göz at.")}</li>
          )}
        </ul>
      ) : null}

      <div className={cn("mt-5", query.trim().length >= 2 && "hidden")}>
        {parent ? (
          <nav aria-label={t("Kategori yolu")} className="mb-3 flex flex-wrap items-center gap-1 text-[14px]">
            <button type="button" onClick={() => setParent(null)} className="font-medium text-accent hover:underline">
              {t("Tüm kategoriler")}
            </button>
            {trail.map((c, i) => (
              <span key={c.id} className="flex items-center gap-1">
                <Icon name="chevron" className="h-3.5 w-3.5 text-subtle" />
                {i < trail.length - 1 ? (
                  <button type="button" onClick={() => setParent(c.id)} className="font-medium text-accent hover:underline">
                    {label(c)}
                  </button>
                ) : (
                  <span className="font-semibold">{label(c)}</span>
                )}
              </span>
            ))}
          </nav>
        ) : null}
        <ul className={cn("grid gap-2", parent ? "sm:grid-cols-2" : "grid-cols-2 sm:grid-cols-3")}>
          {level.map((c) => {
            const hasChildren = childrenOf(active, c.id).length > 0;
            const selected = value === c.id;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => choose(c)}
                  aria-pressed={selected}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-card border px-3.5 text-left transition",
                    parent ? "min-h-14" : "min-h-16",
                    selected ? "border-accent bg-accent-soft" : "border-border hover:border-border-strong hover:bg-brand-soft",
                  )}
                >
                  {!parent ? (
                    <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-brand-soft">
                      <Icon name={c.icon as IconName} className="h-5 w-5" />
                    </span>
                  ) : null}
                  <span className="min-w-0 flex-1 text-[14px] font-medium leading-snug">{label(c)}</span>
                  {hasChildren ? <Icon name="chevron" className="h-4 w-4 flex-shrink-0 text-subtle" /> : selected ? <Icon name="check" className="h-5 w-5 text-accent" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
