import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";
import { Notice } from "@/components/ui/FormError";
import { apiServer, getMe } from "@/lib/api/server";
import type { MyListing, Notification } from "@/lib/api/types";
import { ListingRail } from "@/components/ListingCard";
import { SectionHead } from "@/components/SectionHead";
import { cn } from "@/lib/cn";
import { getI18n } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Hesabım" };

export default async function AccountHome({ searchParams }: { searchParams: Promise<{ sifre?: string }> }) {
  const [me, { t, f }, { sifre }] = await Promise.all([getMe(), getI18n(), searchParams]);
  if (!me) redirect("/giris?returnTo=/hesabim");
  const [notifications, myListings] = await Promise.all([
    apiServer<{ items: Notification[] }>("/me/notifications?pageSize=5").catch(() => ({ items: [] })),
    apiServer<{ listings: MyListing[] }>("/me/listings?status=active").catch(() => ({ listings: [] as MyListing[] })),
  ]);
  const mine = myListings.listings.slice(0, 12);

  const todo: { done: boolean; label: string; href: string }[] = [
    { done: Boolean(me.avatar), label: "Profil fotoğrafı ekle", href: "/hesabim/ayarlar#profil" },
    { done: Boolean(me.region), label: "Bölgeni seç", href: "/hesabim/ayarlar#profil" },
    { done: Boolean(me.bio), label: "Kendini kısaca tanıt", href: "/hesabim/ayarlar#profil" },
    { done: me.phoneVerified, label: "Telefon numaranı incelet", href: "/hesabim/dogrulama" },
  ];
  const completed = todo.filter((x) => x.done).length;

  const stats: { label: string; value: number; href: string; icon: IconName }[] = [
    { label: "Yayında", value: me.counts.active, href: "/hesabim/ilanlar?durum=active", icon: "grid" },
    { label: "İncelemede", value: me.counts.pending, href: "/hesabim/ilanlar?durum=pending", icon: "clock" },
    { label: "Satılan", value: me.counts.sold, href: "/hesabim/ilanlar?durum=sold", icon: "check" },
    { label: "Favoriler", value: me.counts.favorites, href: "/hesabim/favoriler", icon: "heart" },
  ];

  return (
    <div className="flex flex-col gap-10">
      {sifre === "yenilendi" ? <Notice tone="success" icon="check">{t("Şifren değiştirildi. Diğer cihazlardaki oturumların kapatıldı.")}</Notice> : null}

      {me.counts.rejected ? (
        <Notice tone="danger">
          {t(`${me.counts.rejected} ilanın yayınlanamadı.`)}{" "}
          <Link href="/hesabim/ilanlar?durum=rejected" className="font-semibold underline underline-offset-2">
            {t("Nedenini gör")}
          </Link>
        </Notice>
      ) : null}

      <section aria-label={t("İlan özetin")} className="grid grid-cols-2 border-y border-border sm:grid-cols-4">
        {stats.map((s, i) => (
          <Link key={s.label} href={s.href} className={cn("group flex items-end justify-between gap-3 py-5 pr-4", i > 0 && "sm:border-l sm:border-border sm:pl-6", i % 2 === 1 && "pl-4", i > 1 && "border-t border-border sm:border-t-0")}>
            <span>
              <span className="block text-[36px] font-bold leading-none tracking-[-0.03em] tabular">{s.value}</span>
              <span className="mt-1.5 flex items-center gap-1.5 text-[14px] text-muted group-hover:text-text">
                <Icon name={s.icon} className="h-4 w-4" />
                {t(s.label)}
              </span>
            </span>
            <Icon name="chevron" className="h-5 w-5 text-subtle group-hover:text-text" />
          </Link>
        ))}
      </section>

      {mine.length ? (
        <section aria-labelledby="mine-heading">
          <SectionHead id="mine-heading" title={t("Yayındaki ilanların")} href="/hesabim/ilanlar" linkLabel={t("Tümünü yönet")} />
          <ListingRail items={mine} />
        </section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        {completed < todo.length ? (
          <section className="rounded-card border border-border p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold">{t("Profilini güçlendir")}</h2>
              <span className="text-[13px] text-muted tabular">
                {completed}/{todo.length}
              </span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-brand-soft">
              <div className="h-full rounded-full bg-success" style={{ width: `${(completed / todo.length) * 100}%` }} />
            </div>
            <p className="mt-3 text-[13px] text-muted">{t("Eksiksiz profiller alıcılara güven verir ve daha hızlı cevap alır.")}</p>
            <ul className="mt-3 space-y-1">
              {todo.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="flex min-h-10 items-center gap-2.5 text-[14px]">
                    <span className={`grid h-5 w-5 place-items-center rounded-full ${item.done ? "bg-success text-white" : "border border-border-strong"}`}>
                      {item.done ? <Icon name="check" className="h-3 w-3" /> : null}
                    </span>
                    <span className={item.done ? "text-muted line-through" : "font-medium"}>{t(item.label)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="rounded-card border border-border p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">{t("Son bildirimler")}</h2>
            <Link href="/hesabim/bildirimler" className="text-[13px] font-semibold text-accent hover:underline">
              {t("Tümü")}
            </Link>
          </div>
          {notifications.items.length ? (
            <ul className="mt-2 divide-y divide-border">
              {notifications.items.map((n) => (
                <li key={n.id} className="py-2.5">
                  <Link href={n.link ?? "/hesabim/bildirimler"} className="block">
                    <p className={`text-[14px] ${n.readAt ? "" : "font-semibold"}`}>{t(n.title)}</p>
                    {n.body ? <p className="truncate text-[13px] text-muted" translate="no">{n.body}</p> : null}
                    <p className="text-[12px] text-subtle">{f("timeAgo", n.createdAt)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[14px] text-muted">{t("Yeni bildirimin yok.")}</p>
          )}
        </section>
      </div>
    </div>
  );
}
