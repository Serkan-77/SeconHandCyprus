import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminAction, AdminCard, RejectButton } from "@/components/admin/AdminKit";
import { ListingStatusBadge } from "@/components/ListingStatusBadge";
import { LinkButton } from "@/components/ui/Button";
import { MediaImage } from "@/components/ui/MediaImage";
import { apiServerOrNull, getTaxonomy } from "@/lib/api/server";
import type { ImageUrls, ListingCard } from "@/lib/api/types";
import { attributesFor } from "@/lib/taxonomy";
import { getI18n } from "@/lib/i18n/server";
import { specificationGroups } from "@shared/attributes";

type Detail = {
  listing: ListingCard & {
    description: string;
    rejectReason: string | null;
    attributes: Record<string, unknown>;
    categoryPath: { id: number; slug: string; name: string }[];
    images: { id: string; urls: ImageUrls | null }[];
  };
  reports: { id: string; reason: string; detail: string | null; status: string; createdAt: string; reporterName: string | null }[];
  seller: { id: string; displayName: string; status: string; createdAt: string; email: string; listingCount: number; reportCount: number };
};

export const metadata = { title: "İlan incelemesi" };

export default async function AdminListing({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [data, taxonomy, { t, f }] = await Promise.all([apiServerOrNull<Detail>(`/admin/listings/${id}`), getTaxonomy(), getI18n()]);
  if (!data) notFound();
  const { listing: l, reports, seller } = data;
  const specs = l.category ? specificationGroups(attributesFor(taxonomy.categories, taxonomy.attributes, l.category.id), l.attributes) : [];

  return (
    <>
      <div>
        <Link href="/yonetim/ilanlar" className="text-[13px] text-muted hover:text-text">
          ← {t("İlan moderasyonu")}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight" translate="no">
            {l.title}
          </h1>
          <ListingStatusBadge status={l.status} />
          {l.featured ? <span className="text-[13px] font-semibold text-sand">{t("Vitrin")}</span> : null}
        </div>
        <p className="mt-1 text-[14px] text-muted">
          KB{l.refNo} · {l.categoryPath.map((c) => c.name).join(" › ")} · {f("formatPrice", l.price, l.currency)} · {l.city}
          {l.district ? `, ${l.district}` : ""}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {l.status !== "active" ? <AdminAction label="Onayla ve yayınla" path={`/admin/listings/${l.id}/approve`} variant="primary" icon="check" done="İlan yayına alındı." size="md" /> : null}
        {l.status !== "rejected" ? <RejectButton listingId={l.id} size="md" /> : null}
        {l.status === "active" ? (
          <AdminAction label={l.featured ? "Vitrinden çıkar" : "Vitrine al"} path={`/admin/listings/${l.id}/featured`} body={{ featured: !l.featured }} icon="spark" done="Vitrin güncellendi." size="md" />
        ) : null}
        <LinkButton href={`/yonetim/ilanlar/${l.id}/duzenle`} variant="outline" icon={undefined}>
          {t("Düzenle")}
        </LinkButton>
        <LinkButton href={`/ilan/${l.slug}`} variant="ghost">
          {t("Sitede aç")}
        </LinkButton>
        <AdminAction label="İlanı sil" method="DELETE" path={`/admin/listings/${l.id}`} variant="danger" icon="trash" confirm="İlan ve fotoğrafları kalıcı olarak silinir. Şikayet kayıtları ve sohbetler korunur." redirectTo="/yonetim/ilanlar?durum=hepsi" size="md" />
      </div>

      {l.rejectReason ? <p className="rounded-card bg-danger-soft p-3 text-[14px]">{t("Reddedilme gerekçesi:")} {l.rejectReason}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-6">
          <AdminCard title="Fotoğraflar">
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {l.images.map((img) => (
                <li key={img.id} className="group relative aspect-square overflow-hidden rounded-md bg-brand-soft">
                  <a href={img.urls?.lg} target="_blank" rel="noreferrer">
                    <MediaImage urls={img.urls} alt="" max="md" sizes="200px" />
                  </a>
                  <div className="absolute bottom-1 right-1">
                    <AdminAction label="Kaldır" method="DELETE" path={`/admin/listing-images/${img.id}`} variant="danger" confirm="Bu fotoğraf ilandan ve sunucudan silinir." />
                  </div>
                </li>
              ))}
            </ul>
          </AdminCard>
          <AdminCard title="Açıklama">
            <p className="whitespace-pre-line text-[14px] leading-relaxed" translate="no">
              {l.description || "—"}
            </p>
          </AdminCard>
          {specs.length ? (
            <AdminCard title="Özellikler">
              <dl className="grid gap-x-6 gap-y-2 text-[14px] sm:grid-cols-2">
                {specs.flatMap((g) => g.rows).map((r) => (
                  <div key={r.key} className="flex justify-between gap-3 border-b border-border py-1.5">
                    <dt className="text-muted">{r.label}</dt>
                    <dd className="text-right font-medium">{r.value}</dd>
                  </div>
                ))}
              </dl>
            </AdminCard>
          ) : null}
        </div>
        <div className="flex flex-col gap-6">
          <AdminCard title="Satıcı">
            <p className="font-semibold" translate="no">{seller.displayName}</p>
            <p className="text-[13px] text-muted" translate="no">{seller.email}</p>
            <p className="mt-2 text-[13px] text-muted">
              {f("memberSince", seller.createdAt)} · {t(`${seller.listingCount} ilan`)} · {t(`${seller.reportCount} şikayet`)} · {t(seller.status)}
            </p>
            <LinkButton href={`/yonetim/kullanicilar/${seller.id}`} size="sm" variant="outline" className="mt-3">
              {t("Kullanıcıyı aç")}
            </LinkButton>
          </AdminCard>
          <AdminCard title={`Şikayetler (${reports.length})`}>
            {reports.length ? (
              <ul className="divide-y divide-border">
                {reports.map((r) => (
                  <li key={r.id} className="py-2.5">
                    <Link href={`/yonetim/sikayetler/${r.id}`} className="block hover:underline">
                      <p className="text-[14px] font-medium">{t(r.reason)}</p>
                      {r.detail ? <p className="text-[13px] text-muted" translate="no">{r.detail}</p> : null}
                      <p className="text-[12px] text-subtle">
                        {r.reporterName ?? "—"} · {f("timeAgo", r.createdAt)} · {t(r.status)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[14px] text-muted">{t("Şikayet yok.")}</p>
            )}
          </AdminCard>
        </div>
      </div>
    </>
  );
}
