import type { ReactNode } from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { getI18n } from "@/lib/i18n/server";

/** Calm, focused frame for sign-in, sign-up and recovery pages. */
export async function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  const { t } = await getI18n();
  const points: { icon: IconName; text: string }[] = [
    { icon: "chat", text: "Numaranı paylaşmadan, uygulama içinden mesajlaş." },
    { icon: "handshake", text: "Buluşmayı iki taraf onaylayınca birbirinizi değerlendirin." },
    { icon: "shield", text: "Şüpheli ilanları tek dokunuşla bildir; ekibimiz inceler." },
  ];
  return (
    <div className="mx-auto grid max-w-[1080px] gap-10 px-4 py-8 sm:px-6 sm:py-14 lg:grid-cols-[1fr_440px] lg:items-center">
      <aside className="hidden lg:block">
        <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-accent">{t("Kıbrıs'ın ikinci el pazarı")}</p>
        <h2 className="mt-3 text-[36px] font-bold leading-[1.1] tracking-[-0.02em]">{t("Adada ne aradıysan, bir mesaj uzağında.")}</h2>
        <ul className="mt-8 space-y-4">
          {points.map((p) => (
            <li key={p.text} className="flex items-start gap-3 text-[15px] text-muted">
              <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-brand-soft text-text">
                <Icon name={p.icon} className="h-5 w-5" />
              </span>
              <span className="pt-2">{t(p.text)}</span>
            </li>
          ))}
        </ul>
      </aside>
      <section className="w-full rounded-hero border border-border bg-surface p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight">{t(title)}</h1>
        {subtitle ? <p className="mt-1.5 text-[14px] text-muted">{t(subtitle)}</p> : null}
        <div className="mt-6">{children}</div>
        {footer ? <div className="mt-6 border-t border-border pt-5 text-center text-[14px] text-muted">{footer}</div> : null}
      </section>
      <p className="text-center text-[12px] text-muted lg:col-span-2">
        <Link href="/kosullar" className="hover:text-text">
          {t("Kullanım koşulları")}
        </Link>
        {" · "}
        <Link href="/gizlilik" className="hover:text-text">
          {t("Gizlilik bildirimi")}
        </Link>
      </p>
    </div>
  );
}
