import type { ReactNode } from "react";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SITE } from "@/lib/site";

export type LegalSection = { id: string; title: string; body: ReactNode };

const related = [
  { href: "/hakkimizda", label: "Hakkımızda" },
  { href: "/kosullar", label: "Kullanım koşulları" },
  { href: "/gizlilik", label: "Gizlilik bildirimi" },
  { href: "/cerez-politikasi", label: "Çerez politikası" },
];

/** Shared layout for terms, privacy and cookie pages: sticky table of contents + numbered sections. */
export function LegalDocument({
  title,
  intro,
  sections,
  current,
}: {
  title: string;
  intro: ReactNode;
  sections: LegalSection[];
  current: string;
}) {
  return (
    <div className="mx-auto max-w-[1100px] px-4 pb-16 sm:px-6">
      <Breadcrumbs items={[title]} />
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <nav aria-label="İçindekiler" className="sticky top-6 flex flex-col gap-1 text-xs">
            <span className="mb-2 text-[10px] font-semibold uppercase tracking-[1.4px] text-muted">İçindekiler</span>
            {sections.map((s, i) => (
              <a key={s.id} href={`#${s.id}`} className="rounded-md px-2 py-1.5 text-muted hover:bg-bg hover:text-text">
                {i + 1}. {s.title}
              </a>
            ))}
            <span className="mb-2 mt-6 text-[10px] font-semibold uppercase tracking-[1.4px] text-muted">Diğer metinler</span>
            {related
              .filter((r) => r.href !== current)
              .map((r) => (
                <Link key={r.href} href={r.href} className="rounded-md px-2 py-1.5 text-accent hover:bg-bg">
                  {r.label}
                </Link>
              ))}
          </nav>
        </aside>

        <article className="min-w-0 max-w-[720px]">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[32px]">{title}</h1>
          <p className="mt-2 text-xs text-muted">Son güncelleme: {SITE.legalUpdated}</p>
          <div className="mt-6 text-[14px] leading-relaxed text-muted [&_b]:text-text">{intro}</div>
          <div className="mt-10 flex flex-col gap-9">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} className="scroll-mt-6">
                <h2 className="mb-3 text-lg font-semibold text-text">
                  {i + 1}. {s.title}
                </h2>
                <div className="flex flex-col gap-3 text-[14px] leading-relaxed text-muted [&_b]:text-text [&_li]:ml-5 [&_li]:list-disc [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5 [&_a]:text-accent [&_a]:underline">
                  {s.body}
                </div>
              </section>
            ))}
          </div>
        </article>
      </div>
    </div>
  );
}

export function ContactLine() {
  return SITE.contactEmail ? (
    <>
      <b>{SITE.contactEmail}</b> adresine e-posta gönderebilir ya da <Link href="/destek">destek formunu</Link>{" "}
      kullanabilirsin.
    </>
  ) : (
    <>
      <Link href="/destek">Destek formu</Link> üzerinden bize ulaşabilirsin; talebine kayıtlı e-posta adresinden
      dönüş yapılır.
    </>
  );
}
