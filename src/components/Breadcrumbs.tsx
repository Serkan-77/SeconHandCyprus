import * as I18n from "@/components/i18n/Localized";
import { JsonLd } from "@/components/JsonLd";
import { Icon } from "@/components/icons";
import { absoluteUrl } from "@/lib/site";

export type Crumb = string | { label: string; href?: string };

/** Visible breadcrumb trail (after "Ana sayfa") plus the matching schema.org BreadcrumbList. */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  const crumbs = items.map((c) => (typeof c === "string" ? { label: c, href: undefined } : c));
  const structured = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [{ label: "Ana sayfa", href: "/" }, ...crumbs].map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.label,
      ...(c.href ? { item: absoluteUrl(c.href) } : {}),
    })),
  };

  return (
    <I18n.nav aria-label="İçerik yolu" className={className ?? "py-1"}>
      <JsonLd data={structured} />
      <ol className="no-scrollbar flex items-center gap-1.5 overflow-x-auto whitespace-nowrap text-[13px] text-muted">
        <li>
          <I18n.Link href="/" className="hover:text-text">
            Ana sayfa
          </I18n.Link>
        </li>
        {crumbs.map((item, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1.5">
              <Icon name="chevron" className="h-3 w-3 flex-shrink-0 text-subtle" />
              {item.href && !last ? (
                <I18n.Link href={item.href} className="hover:text-text">
                  {item.label}
                </I18n.Link>
              ) : (
                <I18n.span className={last ? "font-medium text-text" : ""} aria-current={last ? "page" : undefined}>
                  {item.label}
                </I18n.span>
              )}
            </li>
          );
        })}
      </ol>
    </I18n.nav>
  );
}
