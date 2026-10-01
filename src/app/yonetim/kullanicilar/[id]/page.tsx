import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminAction, AdminCard, SanctionButton } from "@/components/admin/AdminKit";
import { ListingStatusBadge } from "@/components/ListingStatusBadge";
import { Avatar } from "@/components/ui/Avatar";
import { LinkButton } from "@/components/ui/Button";
import { Stars } from "@/components/ui/Stars";
import { apiServerOrNull, getMe } from "@/lib/api/server";
import type { ImageUrls, ListingCard } from "@/lib/api/types";
import { getI18n } from "@/lib/i18n/server";

type Detail = {
  profile: Record<string, unknown> & {
    id: string;
    name: string;
    displayName: string;
    email: string;
    avatar: ImageUrls | null;
    role: string;
    status: string;
    statusUntil: string | null;
    createdAt: string;
    lastSignInAt: string | null;
    emailVerifiedAt: string | null;
    phone: string | null;
    phoneVerified: boolean;
    whatsappEnabled: boolean;
    region: string | null;
    accountType: string;
    storeVerified: boolean;
    ratingAvg: number | null;
    ratingCount: number | null;
  };
  listings: ListingCard[];
  sanctions: { id: string; kind: string; reason: string; createdAt: string; expiresAt: string | null; createdByName: string | null }[];
  reports: { id: string; reason: string; status: string; createdAt: string; listingTitle: string | null }[];
  ratings: { id: string; score: number; comment: string | null; createdAt: string; raterName: string | null }[];
  activeSessions: number;
};

export const metadata = { title: "Kullanıcı" };

const KIND: Record<string, string> = { warn: "Uyarı", restrict: "Kısıtlama", suspend: "Askıya alma", lift: "Kaldırma" };

export default async function AdminUser({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [data, me, { t, f }] = await Promise.all([apiServerOrNull<Detail>(`/admin/users/${id}`), getMe(), getI18n()]);
  if (!data) notFound();
  const p = data.profile;
  const self = me?.id === p.id;

  return (
    <>
      <Link href="/yonetim/kullanicilar" className="text-[13px] text-muted hover:text-text">
        ← {t("Kullanıcılar")}
      </Link>
      <section className="flex flex-col gap-4 rounded-card border border-border p-5 sm:flex-row sm:items-center">
        <Avatar name={p.name} src={p.avatar} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold" translate="no">
            {p.name} {p.role === "admin" ? <span className="ml-1 rounded bg-accent-soft px-1.5 text-[12px] font-semibold text-accent">admin</span> : null}
          </h1>
          <p className="text-[14px] text-muted" translate="no">
            {p.email} · {p.emailVerifiedAt ? t("e-posta doğrulandı") : t("e-posta doğrulanmadı")}
          </p>
          <p className="text-[13px] text-muted">
            {f("memberSince", p.createdAt)} · {t("Son giriş:")} {p.lastSignInAt ? f("timeAgo", p.lastSignInAt) : "—"} · {t(`${data.activeSessions} açık oturum`)}
          </p>
          <p className="text-[13px]">
            {t("Durum:")} <strong>{t(p.status)}</strong>
            {p.statusUntil ? ` · ${t("bitiş")} ${f("formatDate", p.statusUntil)}` : ""}
            {" · "}
            {t("Telefon:")} <span translate="no">{p.phone ?? "—"}</span> {p.phoneVerified ? `(${t("incelendi")})` : ""}
          </p>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {!self ? <SanctionButton userId={p.id} /> : null}
        <LinkButton href={`/yonetim/kullanicilar/${p.id}/duzenle`} size="sm" variant="outline">
          {t("Düzenle")}
        </LinkButton>
        <LinkButton href={`/satici/${p.id}`} size="sm" variant="ghost">
          {t("Profili aç")}
        </LinkButton>
        {!self ? <AdminAction label="Oturumlarını kapat" path={`/admin/users/${p.id}/sign-out`} icon="logout" confirm="Kullanıcı tüm cihazlarda oturumdan çıkarılır." done="Oturumlar kapatıldı." /> : null}
        {!self && p.role !== "admin" ? (
          <AdminAction
            label="Hesabı sil"
            method="DELETE"
            path={`/admin/users/${p.id}`}
            variant="danger"
            icon="trash"
            confirm="Hesap, ilanlar ve fotoğraflar kalıcı olarak silinir. Şikayet ve yaptırım kayıtları korunur."
            redirectTo="/yonetim/kullanicilar"
          />
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <AdminCard title={`İlanlar (${data.listings.length})`}>
          {data.listings.length ? (
            <ul className="divide-y divide-border">
              {data.listings.map((l) => (
                <li key={l.id} className="flex items-center gap-2 py-2">
                  <ListingStatusBadge status={l.status} />
                  <Link href={`/yonetim/ilanlar/${l.id}`} className="min-w-0 flex-1 truncate text-[14px] hover:underline" translate="no">
                    {l.title}
                  </Link>
                  <span className="text-[13px] text-muted tabular">{f("formatPrice", l.price, l.currency)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[14px] text-muted">{t("İlan yok.")}</p>
          )}
        </AdminCard>
        <AdminCard title="Yaptırım geçmişi">
          {data.sanctions.length ? (
            <ul className="divide-y divide-border">
              {data.sanctions.map((s) => (
                <li key={s.id} className="py-2.5 text-[14px]">
                  <p className="font-medium">
                    {t(KIND[s.kind] ?? s.kind)} · <span className="text-muted">{f("formatDate", s.createdAt)}</span>
                  </p>
                  <p className="text-muted" translate="no">
                    {s.reason}
                  </p>
                  <p className="text-[12px] text-subtle">
                    {s.createdByName ?? "—"}
                    {s.expiresAt ? ` · ${t("bitiş")} ${f("formatDate", s.expiresAt)}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[14px] text-muted">{t("Yaptırım yok.")}</p>
          )}
        </AdminCard>
        <AdminCard title="Hakkındaki şikayetler">
          {data.reports.length ? (
            <ul className="divide-y divide-border">
              {data.reports.map((r) => (
                <li key={r.id} className="py-2">
                  <Link href={`/yonetim/sikayetler/${r.id}`} className="block text-[14px] hover:underline">
                    {t(r.reason)} <span className="text-muted">· {r.listingTitle ?? t("kullanıcı")} · {t(r.status)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[14px] text-muted">{t("Şikayet yok.")}</p>
          )}
        </AdminCard>
        <AdminCard title="Aldığı değerlendirmeler">
          {data.ratings.length ? (
            <ul className="divide-y divide-border">
              {data.ratings.map((r) => (
                <li key={r.id} className="flex items-start gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <Stars value={r.score} />
                    {r.comment ? (
                      <p className="text-[14px]" translate="no">
                        {r.comment}
                      </p>
                    ) : null}
                    <p className="text-[12px] text-subtle">
                      {r.raterName ?? "—"} · {f("formatDate", r.createdAt)}
                    </p>
                  </div>
                  <AdminAction label="Sil" method="DELETE" path={`/admin/ratings/${r.id}`} variant="ghost" confirm="Değerlendirme kalıcı olarak silinir ve işlem kayda geçer." />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[14px] text-muted">{t("Değerlendirme yok.")}</p>
          )}
        </AdminCard>
      </div>
    </>
  );
}
