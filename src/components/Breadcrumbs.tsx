import Link from "next/link";
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
    <nav aria-label="İçerik yolu" className="flex flex-wrap items-center gap-2.5 py-5 text-[11px] text-muted">
      <JsonLd data={structured} />
      <Link href="/">Ana sayfa</Link>
      {crumbs.map((item, i) => (
        <span key={`${item.label}-${i}`} className="flex items-center gap-2.5">
          <span>/</span>
          {item.href && i < crumbs.length - 1 ? (
            <Link href={item.href} className="hover:text-text">
              {item.label}
            </Link>
          ) : (
            <span className={i === crumbs.length - 1 ? "text-text" : ""} aria-current={i === crumbs.length - 1 ? "page" : undefined}>
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
