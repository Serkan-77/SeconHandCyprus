
import * as I18n from "@/components/i18n/Localized";
import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/cn";

const steps = [
  { href: "/ilan-ver/fotograflar", label: "Fotoğraflar" },
  { href: "/ilan-ver/detaylar", label: "Ürün bilgileri" },
  { href: "/ilan-ver/fiyat-konum", label: "Fiyat ve konum" },
  { href: "/ilan-ver/onizleme", label: "Önizleme" },
];

export function WizardLayout({
  active,
  children,
  preview,
}: {
  active: number;
  children: ReactNode;
  preview?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[1328px] px-4 pb-16 sm:px-6">
      <Breadcrumbs items={["İlan ver"]} />
      <I18n.div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_minmax(0,1fr)_250px]">
        <aside className="hidden lg:block">
          <I18n.span className="text-[9px] font-semibold tracking-[1.8px] text-accent">YENİ İLAN</I18n.span>
          <I18n.h1 className="my-5 text-[30px] font-medium leading-[1.15] tracking-[-1px]">
            Eşyana yeni
            <br />
            bir ev bul.
          </I18n.h1>
          <I18n.p className="text-xs leading-loose text-muted">
            Birkaç küçük adım,
            <br />
            yeni bir başlangıç.
          </I18n.p>
          <I18n.ol className="my-8 flex flex-col gap-0">
            {steps.map((step, i) => (
              <li key={step.href}>
                <I18n.Link
                  href={step.href}
                  className={cn(
                    "flex items-center gap-3 py-3 text-xs",
                    i === active ? "font-semibold text-text" : "text-muted",
                  )}
                >
                  <I18n.span
                    className={cn(
                      "grid h-7 w-7 place-items-center rounded-full border border-border text-[11px]",
                      i === active && "border-brand bg-brand text-on-brand",
                      i < active && "border-transparent bg-accent-soft text-accent",
                    )}
                  >
                    {i + 1}
                  </I18n.span>
                  {step.label}
                </I18n.Link>
              </li>
            ))}
          </I18n.ol>
          <div className="flex gap-2.5 border-t border-border pt-6 text-[10px] leading-relaxed text-muted">
            <Icon name="shield" className="h-5 w-5 flex-shrink-0 text-accent" />
            <I18n.p>
              İlan vermek ücretsiz.
              <br />
              Ürününü görmeden ödeme isteyenlere karşı dikkatli ol.
            </I18n.p>
          </div>
        </aside>

        <I18n.ol className="flex justify-between gap-2.5 lg:hidden">
          {steps.map((step, i) => (
            <li key={step.href} className="min-w-0 flex-1 text-center">
              <I18n.Link href={step.href} className="flex flex-col items-center gap-1.5 text-[9px]">
                <I18n.span
                  className={cn(
                    "grid h-[26px] w-[26px] place-items-center rounded-full border border-border text-[10px]",
                    i === active && "border-brand bg-brand text-on-brand",
                    i < active && "border-transparent bg-accent-soft text-accent",
                  )}
                >
                  {i + 1}
                </I18n.span>
                <I18n.span className={i === active ? "font-semibold text-text" : "text-muted"}>
                  {step.label}
                </I18n.span>
              </I18n.Link>
            </li>
          ))}
        </I18n.ol>

        <section className="min-w-0 overflow-hidden rounded-2xl border border-border">
          <I18n.div className="flex flex-col gap-6 p-5 sm:p-7">{children}</I18n.div>
        </section>

        {preview ? <I18n.aside className="hidden lg:block">{preview}</I18n.aside> : null}
      </I18n.div>
    </div>
  );
}
