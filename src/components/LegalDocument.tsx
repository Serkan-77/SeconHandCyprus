
import * as I18n from "@/components/i18n/Localized";
import type { ReactNode } from "react";
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
          <I18n.nav aria-label="İçindekiler" className="sticky top-6 flex flex-col gap-1 text-xs">
            <I18n.span className="mb-2 text-[10px] font-semibold uppercase tracking-[1.4px] text-muted">İçindekiler</I18n.span>
            {sections.map((s, i) => (
              <I18n.a key={s.id} href={`#${s.id}`} className="rounded-md px-2 py-1.5 text-muted hover:bg-bg hover:text-text">
                {i + 1}. {s.title}
              </I18n.a>
            ))}
            <I18n.span className="mb-2 mt-6 text-[10px] font-semibold uppercase tracking-[1.4px] text-muted">Diğer metinler</I18n.span>
            {related
              .filter((r) => r.href !== current)
              .map((r) => (
                <I18n.Link key={r.href} href={r.href} className="rounded-md px-2 py-1.5 text-accent hover:bg-bg">
                  {r.label}
                </I18n.Link>
              ))}
          </I18n.nav>
        </aside>

        <article className="min-w-0 max-w-[720px]">
          <I18n.h1 className="text-2xl font-semibold tracking-tight sm:text-[32px]">{title}</I18n.h1>
          <I18n.p className="mt-2 text-xs text-muted">Son güncelleme: {SITE.legalUpdated}</I18n.p>
          <I18n.div className="mt-6 text-[14px] leading-relaxed text-muted [&_b]:text-text">{intro}</I18n.div>
          <I18n.div className="mt-10 flex flex-col gap-9">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} className="scroll-mt-6">
                <I18n.h2 className="mb-3 text-lg font-semibold text-text">
                  {i + 1}. {s.title}
                </I18n.h2>
                <I18n.div className="flex flex-col gap-3 text-[14px] leading-relaxed text-muted [&_b]:text-text [&_li]:ml-5 [&_li]:list-disc [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5 [&_a]:text-accent [&_a]:underline">
                  {s.body}
                </I18n.div>
              </section>
            ))}
          </I18n.div>
        </article>
      </div>
    </div>
  );
}

export function ContactLine() {
  return SITE.contactEmail ? (
    <I18n.Text>
      <I18n.b>{SITE.contactEmail}</I18n.b> adresine e-posta gönderebilir ya da <I18n.Link href="/destek">destek formunu</I18n.Link>{" "}
      kullanabilirsin.
    </I18n.Text>
  ) : (
    <I18n.Text>
      <I18n.Link href="/destek">Destek formu</I18n.Link> üzerinden bize ulaşabilirsin; talebine kayıtlı e-posta adresinden
      dönüş yapılır.
    </I18n.Text>
  );
}
