import Link from "next/link";
import { AdminAction, RejectButton } from "@/components/admin/AdminKit";
import { ListingStatusBadge } from "@/components/ListingStatusBadge";
import { MediaImage } from "@/components/ui/MediaImage";
import { Pagination } from "@/components/ui/Pagination";
import { apiServer } from "@/lib/api/server";
import type { ListingCard } from "@/lib/api/types";
import { getI18n } from "@/lib/i18n/server";
import { cn } from "@/lib/cn";

export const metadata = { title: "İlan moderasyonu" };

type Row = ListingCard & { reportCount: number };

export default async function AdminListings({ searchParams }: { searchParams: Promise<{ durum?: string; q?: string; sayfa?: string }> }) {
  const [{ durum, q, sayfa }, { t, f }] = await Promise.all([searchParams, getI18n()]);
  const status = durum ?? "pending";
  const page = Math.max(1, Number(sayfa) || 1);
  const qs = new URLSearchParams({ status, page: String(page), pageSize: "30", ...(q ? { q } : {}) });
  const data = await apiServer<{ listings: Row[]; total: number; counts: Record<string, number> }>(`/admin/listings?${qs}`);
  const tabs = [
    ["pending", "İncelemede", data.counts.pending],
    ["active", "Yayında", data.counts.active],
    ["rejected", "Reddedilen", data.counts.rejected],
    ["hepsi", "Tümü", data.counts.all],
  ] as const;
  const href = (next: Record<string, string | undefined>) => {
    const p = new URLSearchParams({ durum: status, ...(q ? { q } : {}) });
    for (const [k, v] of Object.entries(next)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    return `/yonetim/ilanlar?${p}`;
  };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{t("İlan moderasyonu")}</h1>
        <form className="flex h-10 items-center rounded-full border border-border-strong pl-3 pr-1" role="search">
          <input type="hidden" name="durum" value={status} />
          <input name="q" defaultValue={q} placeholder={t("Başlık ya da ilan no")} aria-label={t("İlan ara")} className="h-full w-56 bg-transparent px-2 text-[14px] outline-none" />
        </form>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tabs.map(([key, label, n]) => (
          <Link key={key} href={href({ durum: key, sayfa: undefined })} className={cn("flex h-9 items-center gap-1.5 rounded-pill px-3.5 text-[13px] font-medium", status === key ? "bg-brand text-on-brand" : "bg-brand-soft text-muted")}>
            {t(label)} <span className="tabular opacity-70">{n}</span>
          </Link>
        ))}
      </div>
      {data.listings.length ? (
        <ul className="flex flex-col gap-2">
          {data.listings.map((l) => (
            <li key={l.id} className="flex flex-col gap-3 rounded-card border border-border p-3 sm:flex-row sm:items-center">
              <Link href={`/yonetim/ilanlar/${l.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <span className="h-16 w-20 flex-shrink-0 overflow-hidden rounded-md bg-brand-soft">
                  <MediaImage urls={l.image} alt="" max="sm" sizes="80px" />
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <ListingStatusBadge status={l.status} />
                    {l.reportCount ? <span className="rounded-md bg-danger-soft px-1.5 text-[11px] font-semibold text-danger">{t(`${l.reportCount} şikayet`)}</span> : null}
                    <span className="text-[12px] text-subtle tabular">KB{l.refNo}</span>
                  </span>
                  <span className="mt-0.5 block truncate font-medium" translate="no">{l.title}</span>
                  <span className="block truncate text-[12px] text-muted">
                    <span translate="no">{l.seller.name}</span> · {l.category?.name} · {f("formatPrice", l.price, l.currency)} · {f("timeAgo", l.createdAt)}
                  </span>
                </span>
              </Link>
              {l.status === "pending" ? (
                <div className="flex flex-shrink-0 gap-2">
                  <AdminAction label="Onayla" path={`/admin/listings/${l.id}/approve`} variant="primary" icon="check" done="İlan yayına alındı." />
                  <RejectButton listingId={l.id} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-card border border-dashed border-border-strong p-10 text-center text-[14px] text-muted">{t("Bu listede ilan yok.")}</p>
      )}
      <Pagination page={page} pages={Math.ceil(data.total / 30)} href={(p) => href({ sayfa: p > 1 ? String(p) : undefined })} />
    </>
  );
}
