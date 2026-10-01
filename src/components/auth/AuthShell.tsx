import type { ReactNode } from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { searchPublic } from "@/lib/api/listings";
import { getI18n } from "@/lib/i18n/server";

/**
 * Sign-in, sign-up and recovery: a split screen. On large screens the left
 * half shows what is actually for sale (a dark mosaic of real listing
 * photos) with the three promises; the form has the right half to itself.
 */
export async function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  const [{ t }, latest] = await Promise.all([getI18n(), searchPublic({ pageSize: 12 }, 300)]);
  const photos = latest.items.filter((i) => i.image).slice(0, 6);
  const points: { icon: IconName; text: string }[] = [
    { icon: "chat", text: "Numaranı paylaşmadan, uygulama içinden mesajlaş." },
    { icon: "handshake", text: "Buluşmayı iki taraf onaylayınca birbirinizi değerlendirin." },
    { icon: "shield", text: "Şüpheli ilanları tek dokunuşla bildir; ekibimiz inceler." },
  ];
  return (
    <div className="grid min-h-[calc(100dvh-134px)] lg:grid-cols-2">
      <aside className="dark relative hidden overflow-hidden bg-bg text-text lg:block">
        {photos.length ? (
          <div className="absolute inset-0 grid grid-cols-3 grid-rows-2 gap-1 opacity-60" aria-hidden>
            {photos.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p.id} src={p.image!.md} alt="" className="h-full w-full object-cover" />
            ))}
          </div>
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/20" aria-hidden />
        <div className="relative flex h-full flex-col justify-end p-12 xl:p-16">
          <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-accent">{t("Kıbrıs'ın ikinci el pazarı")}</p>
          <h2 className="mt-3 max-w-[16ch] text-[40px] font-bold leading-[1.05] tracking-[-0.03em] text-white xl:text-[48px]">{t("Adada ne aradıysan, bir mesaj uzağında.")}</h2>
          <ul className="mt-8 space-y-3">
            {points.map((p) => (
              <li key={p.text} className="flex items-center gap-3 text-[15px] text-white/85">
                <Icon name={p.icon} className="h-5 w-5 flex-shrink-0 text-white" />
                {t(p.text)}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <div className="flex flex-col justify-center px-4 py-10 sm:px-10 lg:px-16 xl:px-24">
        <section className="mx-auto w-full max-w-[420px]">
          <h1 className="text-[30px] font-bold leading-tight tracking-[-0.025em] sm:text-[34px]">{t(title)}</h1>
          {subtitle ? <p className="mt-2 text-[15px] text-muted">{t(subtitle)}</p> : null}
          <div className="mt-8">{children}</div>
          {footer ? <div className="mt-8 border-t border-border pt-6 text-[14px] text-muted">{footer}</div> : null}
          <p className="mt-10 text-[12px] text-muted">
            <Link href="/kosullar" className="hover:text-text">
              {t("Kullanım koşulları")}
            </Link>
            {" · "}
            <Link href="/gizlilik" className="hover:text-text">
              {t("Gizlilik bildirimi")}
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
