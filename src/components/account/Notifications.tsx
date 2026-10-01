"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { useRealtime } from "@/components/realtime/Realtime";
import { api } from "@/lib/api/client";
import type { Notification } from "@/lib/api/types";
import { setLiveCounts } from "@/lib/liveCounts";
import { formatLocalized } from "@/lib/i18n/format";
import { cn } from "@/lib/cn";

const ICONS: Record<string, IconName> = { message: "chat", listing: "grid", price: "heart", rating: "star", account: "shield", announcement: "bell" };

export function Notifications({ initial }: { initial: Notification[] }) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const [items, setItems] = useState(initial);

  useRealtime((e) => {
    if (e.type === "notification") {
      setItems((list) => (list.some((n) => n.id === e.notification.id) ? list : [{ ...e.notification, readAt: null }, ...list]));
    }
  });

  async function readAll() {
    setItems((list) => list.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    await api.post("/me/notifications/read-all").catch(() => {});
    api.get<{ messages: number; notifications: number }>("/me/counts").then(setLiveCounts).catch(() => {});
    router.refresh();
  }

  async function remove(id: string) {
    setItems((list) => list.filter((n) => n.id !== id));
    await api.del(`/me/notifications/${id}`).catch(() => {});
  }

  const unread = items.filter((n) => !n.readAt).length;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{t("Bildirimler")}</h1>
        {unread ? (
          <Button size="sm" variant="outline" onClick={readAll}>
            {t("Tümünü okundu say")}
          </Button>
        ) : null}
      </div>
      {items.length ? (
        <ul className="mt-5 divide-y divide-border overflow-hidden rounded-card border border-border">
          {items.map((n) => (
            <li key={n.id} className={cn("flex items-start gap-3 p-4", !n.readAt && "bg-accent-soft/60")}>
              <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-brand-soft text-muted">
                <Icon name={ICONS[n.kind] ?? "bell"} className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0 flex-1">
                {n.link ? (
                  <Link href={n.link} className={cn("text-[14px] hover:underline", !n.readAt && "font-semibold")}>
                    {t(n.title)}
                  </Link>
                ) : (
                  <p className={cn("text-[14px]", !n.readAt && "font-semibold")}>{t(n.title)}</p>
                )}
                {n.body ? (
                  <p className="mt-0.5 line-clamp-2 text-[13px] text-muted" translate="no">
                    {n.body}
                  </p>
                ) : null}
                <p className="mt-1 text-[12px] text-subtle">{formatLocalized("timeAgo", [n.createdAt], locale)}</p>
              </div>
              <button type="button" onClick={() => remove(n.id)} aria-label={t("Bildirimi sil")} className="grid h-9 w-9 place-items-center rounded-full text-subtle hover:bg-brand-soft hover:text-text">
                <Icon name="close" className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-5 rounded-card border border-dashed border-border-strong px-6 py-14 text-center">
          <Icon name="bell" className="mx-auto h-7 w-7 text-muted" />
          <p className="mt-3 font-semibold">{t("Bildirimin yok")}</p>
          <p className="mt-1 text-[14px] text-muted">{t("Mesajlar, ilan onayları ve fiyat düşüşleri burada görünür.")}</p>
        </div>
      )}
    </div>
  );
}
