import * as I18n from "@/components/i18n/Localized";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/cn";

/** Numbered pages with previous/next; real links, so crawlers and back/forward work. */
export function Pagination({
  page,
  pages,
  href,
  className,
}: {
  page: number;
  pages: number;
  href: (page: number) => string;
  className?: string;
}) {
  if (pages <= 1) return null;
  const around = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  const list = [...around].sort((a, b) => a - b);
  const items: (number | "gap")[] = [];
  list.forEach((p, i) => {
    if (i > 0 && p - list[i - 1] > 1) items.push("gap");
    items.push(p);
  });
  const cell = "grid h-10 min-w-10 place-items-center rounded-button px-3 text-sm font-medium tabular";
  return (
    <I18n.nav aria-label="Sayfalar" className={cn("flex items-center justify-center gap-1", className)}>
      {page > 1 ? (
        <I18n.Link href={href(page - 1)} rel="prev" aria-label="Önceki sayfa" className={cn(cell, "hover:bg-brand-soft")}>
          <Icon name="back" className="h-4 w-4" />
        </I18n.Link>
      ) : null}
      {items.map((p, i) =>
        p === "gap" ? (
          <span key={`g${i}`} className="px-1 text-subtle" aria-hidden>
            …
          </span>
        ) : (
          <I18n.Link
            key={p}
            href={href(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(cell, p === page ? "bg-brand text-on-brand" : "hover:bg-brand-soft")}
          >
            {String(p)}
          </I18n.Link>
        ),
      )}
      {page < pages ? (
        <I18n.Link href={href(page + 1)} rel="next" aria-label="Sonraki sayfa" className={cn(cell, "hover:bg-brand-soft")}>
          <Icon name="chevron" className="h-4 w-4" />
        </I18n.Link>
      ) : null}
    </I18n.nav>
  );
}
