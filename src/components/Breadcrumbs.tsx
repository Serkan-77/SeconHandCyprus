import Link from "next/link";

export function Breadcrumbs({ items }: { items: string[] }) {
  return (
    <nav
      aria-label="İçerik yolu"
      className="flex flex-wrap items-center gap-2.5 py-5 text-[11px] text-muted"
    >
      <Link href="/">Ana sayfa</Link>
      {items.map((item, i) => (
        <span key={item} className="flex items-center gap-2.5">
          <span>/</span>
          <span className={i === items.length - 1 ? "text-text" : ""}>{item}</span>
        </span>
      ))}
    </nav>
  );
}
