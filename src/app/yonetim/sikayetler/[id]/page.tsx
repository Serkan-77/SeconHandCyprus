import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminCard } from "@/components/admin/AdminKit";
import { ResolveReport } from "@/components/admin/ResolveReport";
import { MediaImage } from "@/components/ui/MediaImage";
import { LinkButton } from "@/components/ui/Button";
import { apiServerOrNull } from "@/lib/api/server";
import type { ImageUrls } from "@/lib/api/types";
import { getI18n } from "@/lib/i18n/server";

type Report = {
  id: string;
  reason: string;
  detail: string | null;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  resolutionNote: string | null;
  listingId: string | null;
  reportedUserId: string | null;
  reporterId: string | null;
  listingTitle: string | null;
  listingSlug: string | null;
  listingStatus: string | null;
  listingSellerId: string | null;
  reportedName: string | null;
  reporterName: string | null;
  targetSnapshot: {
    capturedAt?: string;
    captured_at?: string;
    listing?: { title: string; description?: string; price?: number; currency?: string; city?: string; seller_name?: string; seller_id?: string; ref_no?: number };
    user?: { id: string; display_name: string };
  } | null;
};

export const metadata = { title: "Şikayet" };

export default async function AdminReport({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [data, { t, f }] = await Promise.all([apiServerOrNull<{ report: Report; snapshotImages: (ImageUrls | null)[] }>(`/admin/reports/${id}`), getI18n()]);
  if (!data) notFound();
  const r = data.report;
  const snap = r.targetSnapshot;

  return (
    <>
      <Link href="/yonetim/sikayetler" className="text-[13px] text-muted hover:text-text">
        ← {t("Şikayetler")}
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t(r.reason)}</h1>
        <p className="mt-1 text-[14px] text-muted">
          {t(r.status)} · {f("formatLongDate", r.createdAt)} · {t("Şikayet eden:")} {r.reporterName ?? t("silinmiş hesap")}
        </p>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="flex flex-col gap-6">
          <AdminCard title="Şikayet">
            <p className="whitespace-pre-line text-[14px]" translate="no">
              {r.detail || t("Ayrıntı yazılmamış.")}
            </p>
          </AdminCard>
          <AdminCard title="Şikayet edilen (dosyalandığı andaki kayıt)">
            {snap?.listing ? (
              <div className="flex flex-col gap-3 text-[14px]">
                <p className="font-semibold" translate="no">
                  {snap.listing.title} {snap.listing.ref_no ? <span className="text-muted">· KB{snap.listing.ref_no}</span> : null}
                </p>
                <p className="text-muted">
                  {snap.listing.price != null ? f("formatPrice", snap.listing.price, snap.listing.currency ?? "TL") : ""} · {snap.listing.city} · {t("Satıcı:")} <span translate="no">{snap.listing.seller_name}</span>
                </p>
                {snap.listing.description ? (
                  <p className="line-clamp-6 whitespace-pre-line" translate="no">
                    {snap.listing.description}
                  </p>
                ) : null}
                {data.snapshotImages.length ? (
                  <ul className="grid grid-cols-4 gap-2">
                    {data.snapshotImages.map((u, i) => (
                      <li key={i} className="aspect-square overflow-hidden rounded-md bg-brand-soft">
                        <MediaImage urls={u} alt="" max="sm" sizes="120px" />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : snap?.user ? (
              <p className="text-[14px]" translate="no">
                {snap.user.display_name}
              </p>
            ) : (
              <p className="text-[14px] text-muted">—</p>
            )}
          </AdminCard>
        </div>
        <div className="flex flex-col gap-6">
          <AdminCard title="İşlem">
            {r.status === "resolved" ? (
              <p className="text-[14px]">
                {t("Çözüldü:")} {r.resolvedAt ? f("formatLongDate", r.resolvedAt) : ""}
                {r.resolutionNote ? <span className="mt-1 block text-muted">{r.resolutionNote}</span> : null}
              </p>
            ) : (
              <ResolveReport id={r.id} status={r.status} />
            )}
          </AdminCard>
          <AdminCard title="Bağlantılar">
            <div className="flex flex-wrap gap-2">
              {r.listingId ? (
                <LinkButton href={`/yonetim/ilanlar/${r.listingId}`} size="sm" variant="outline">
                  {t("İlanı incele")}
                </LinkButton>
              ) : null}
              {r.listingSellerId ?? r.reportedUserId ? (
                <LinkButton href={`/yonetim/kullanicilar/${r.listingSellerId ?? r.reportedUserId}`} size="sm" variant="outline">
                  {t("Kullanıcıyı aç")}
                </LinkButton>
              ) : null}
              {r.reporterId ? (
                <LinkButton href={`/yonetim/kullanicilar/${r.reporterId}`} size="sm" variant="ghost">
                  {t("Şikayet edeni aç")}
                </LinkButton>
              ) : null}
            </div>
            {!r.listingId && snap?.listing ? <p className="mt-3 text-[13px] text-muted">{t("İlan silinmiş; yukarıdaki kayıt şikayet anındaki halidir.")}</p> : null}
          </AdminCard>
        </div>
      </div>
    </>
  );
}
