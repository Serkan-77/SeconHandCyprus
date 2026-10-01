"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { Button, LinkButton } from "@/components/ui/Button";
import { MediaImage } from "@/components/ui/MediaImage";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { ListingStatusBadge } from "@/components/ListingStatusBadge";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import type { ListingStatus, MyListing } from "@/lib/api/types";
import { formatLocalized } from "@/lib/i18n/format";
import { cn } from "@/lib/cn";

const TABS: { key: string; label: string; match: (s: ListingStatus) => boolean }[] = [
  { key: "", label: "Tümü", match: () => true },
  { key: "active", label: "Yayında", match: (s) => s === "active" },
  { key: "pending", label: "İncelemede", match: (s) => s === "pending" },
  { key: "rejected", label: "Reddedilen", match: (s) => s === "rejected" },
  { key: "sold", label: "Satılan", match: (s) => s === "sold" },
  { key: "removed", label: "Kaldırılan", match: (s) => s === "removed" || s === "draft" },
];

export function MyListings({ listings, tab }: { listings: MyListing[]; tab: string }) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<MyListing | null>(null);
  const current = TABS.find((x) => x.key === tab) ?? TABS[0];
  const shown = listings.filter((l) => current.match(l.status));

  async function setStatus(l: MyListing, status: "sold" | "removed" | "pending") {
    setBusy(l.id);
    try {
      await api.post(`/listings/${l.id}/status`, { status });
      toast.show(status === "sold" ? "Satıldı olarak işaretlendi." : status === "removed" ? "İlan yayından kaldırıldı." : "İlan incelemeye gönderildi.");
      router.refresh();
    } catch (e) {
      toast.show(errorMessage(e), { tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  async function remove(l: MyListing) {
    setBusy(l.id);
    try {
      await api.del(`/listings/${l.id}`);
      setConfirmDelete(null);
      toast.show("İlan silindi.");
      router.refresh();
    } catch (e) {
      toast.show(errorMessage(e), { tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="no-scrollbar -mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1" role="tablist">
        {TABS.map((x) => {
          const n = listings.filter((l) => x.match(l.status)).length;
          return (
            <Link
              key={x.key}
              role="tab"
              aria-selected={x.key === current.key}
              href={x.key ? `/hesabim/ilanlar?durum=${x.key}` : "/hesabim/ilanlar"}
              className={cn(
                "flex h-9 flex-shrink-0 items-center gap-1.5 rounded-pill px-3.5 text-[13px] font-medium",
                x.key === current.key ? "bg-brand text-on-brand" : "bg-brand-soft text-muted hover:text-text",
              )}
            >
              {t(x.label)}
              <span className="tabular opacity-70">{n}</span>
            </Link>
          );
        })}
      </div>

      {shown.length ? (
        <ul className="flex flex-col gap-3">
          {shown.map((l) => (
            <li key={l.id} className="rounded-card border border-border p-3 sm:p-4">
              <div className="flex gap-3 sm:gap-4">
                <Link href={`/ilan/${l.slug}`} className="h-20 w-24 flex-shrink-0 overflow-hidden rounded-[10px] bg-brand-soft sm:h-24 sm:w-32">
                  <MediaImage urls={l.image} alt="" max="sm" sizes="128px" />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <ListingStatusBadge status={l.status} />
                    {l.featured ? <span className="text-[12px] font-semibold text-sand">{t("Vitrin")}</span> : null}
                    <span className="text-[12px] text-subtle tabular">KB{l.refNo}</span>
                  </div>
                  <Link href={`/ilan/${l.slug}`} className="mt-1 block truncate font-semibold hover:underline" translate="no">
                    {l.title}
                  </Link>
                  <p className="text-[15px] font-bold tabular">{formatLocalized("formatPrice", [l.price, l.currency], locale)}</p>
                  <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-muted">
                    <span className="flex items-center gap-1">
                      <Icon name="eye" className="h-3.5 w-3.5" />
                      {l.viewCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <Icon name="heart" className="h-3.5 w-3.5" />
                      {l.favoriteCount ?? 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <Icon name="chat" className="h-3.5 w-3.5" />
                      {l.conversationCount}
                      {l.unreadCount ? <span className="font-semibold text-accent">{t(`(${l.unreadCount} yeni)`)}</span> : null}
                    </span>
                    <span>{formatLocalized("formatDate", [l.updatedAt], locale)}</span>
                  </p>
                </div>
              </div>
              {l.status === "rejected" && l.rejectReason ? (
                <p className="mt-3 rounded-button bg-danger-soft px-3 py-2 text-[13px]">
                  <span className="font-semibold">{t("Reddedilme nedeni:")}</span> <span translate="no">{l.rejectReason}</span>
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                <LinkButton href={`/hesabim/ilanlar/${l.id}`} size="sm" variant="outline" icon={<Icon name="edit" className="h-4 w-4" />}>
                  {t("Düzenle")}
                </LinkButton>
                {l.status === "active" ? (
                  <>
                    <Button size="sm" variant="secondary" loading={busy === l.id} onClick={() => setStatus(l, "sold")} icon={<Icon name="check" className="h-4 w-4" />}>
                      {t("Satıldı")}
                    </Button>
                    <Button size="sm" variant="ghost" disabled={busy === l.id} onClick={() => setStatus(l, "removed")}>
                      {t("Yayından kaldır")}
                    </Button>
                  </>
                ) : null}
                {l.status === "removed" || l.status === "draft" || l.status === "rejected" || l.status === "sold" ? (
                  <Button size="sm" variant="secondary" loading={busy === l.id} onClick={() => setStatus(l, "pending")} icon={<Icon name="refresh" className="h-4 w-4" />}>
                    {t(l.status === "rejected" ? "Tekrar incelemeye gönder" : "Yeniden yayınla")}
                  </Button>
                ) : null}
                {l.conversationCount ? (
                  <LinkButton href="/mesajlar" size="sm" variant="ghost">
                    {t("Mesajlar")}
                  </LinkButton>
                ) : null}
                <Button size="sm" variant="danger-ghost" className="ml-auto" onClick={() => setConfirmDelete(l)} icon={<Icon name="trash" className="h-4 w-4" />}>
                  {t("Sil")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-card border border-dashed border-border-strong px-6 py-14 text-center">
          <p className="font-semibold">{t(listings.length ? "Bu durumda ilanın yok" : "Henüz ilan vermedin")}</p>
          <p className="mt-1 text-[14px] text-muted">{t("Evindeki kullanmadığın eşyaları iki dakikada ilana dönüştür.")}</p>
          <LinkButton href="/ilan-ver" className="mt-4" icon={<Icon name="plus" className="h-4 w-4" />}>
            {t("İlan ver")}
          </LinkButton>
        </div>
      )}

      <Modal
        title="İlanı sil"
        description="Silinen ilan geri getirilemez. Satıldıysa silmek yerine “Satıldı” olarak işaretleyebilirsin; mesajların korunur."
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              {t("Vazgeç")}
            </Button>
            <Button variant="danger" loading={Boolean(confirmDelete && busy === confirmDelete.id)} onClick={() => confirmDelete && remove(confirmDelete)}>
              {t("Kalıcı olarak sil")}
            </Button>
          </>
        }
      >
        <p className="text-[14px] font-medium" translate="no">
          {confirmDelete?.title}
        </p>
      </Modal>
    </div>
  );
}
