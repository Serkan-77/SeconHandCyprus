
import * as I18n from "@/components/i18n/Localized";
import { JsonLd } from "@/components/JsonLd";
import { absoluteUrl } from "@/lib/site";

export type Crumb = string | { label: string; href: string };

/** Visible breadcrumb trail plus the matching schema.org BreadcrumbList. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
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
    <I18n.nav aria-label="İçerik yolu" className="flex flex-wrap items-center gap-2.5 py-5 text-[11px] text-muted">
      <JsonLd data={structured} />
      <I18n.Link href="/">Ana sayfa</I18n.Link>
      {crumbs.map((item, i) => (
        <I18n.span key={`${item.label}-${i}`} className="flex items-center gap-2.5">
          <I18n.span>/</I18n.span>
          {item.href && i < crumbs.length - 1 ? (
            <I18n.Link href={item.href} className="hover:text-text">
              {item.label}
            </I18n.Link>
          ) : (
            <I18n.span className={i === crumbs.length - 1 ? "text-text" : ""} aria-current={i === crumbs.length - 1 ? "page" : undefined}>
              {item.label}
            </I18n.span>
          )}
        </I18n.span>
      ))}
    </I18n.nav>
  );
}
