import Link from "next/link";
import { Pagination } from "@/components/ui/Pagination";
import { apiServer } from "@/lib/api/server";
import { getI18n } from "@/lib/i18n/server";

export const metadata = { title: "İşlem kayıtları" };

type Row = { id: number; action: string; targetType: string; targetId: string | null; detail: Record<string, unknown>; createdAt: string; adminName: string | null };

const ACTIONS: Record<string, string> = {
  "listing.approve": "İlanı onayladı",
  "listing.reject": "İlanı reddetti",
  "listing.feature": "Vitrine aldı",
  "listing.unfeature": "Vitrinden çıkardı",
  "listing.edit": "İlanı düzenledi",
  "listing.delete": "İlanı sildi",
  "listing.image_remove": "Fotoğraf kaldırdı",
  "user.edit": "Kullanıcıyı düzenledi",
  "user.delete": "Hesabı sildi",
  "user.sign_out": "Oturumları kapattı",
  "user.sanction.warn": "Uyardı",
  "user.sanction.restrict": "Kısıtladı",
  "user.sanction.suspend": "Askıya aldı",
  "user.sanction.lift": "Kısıtlamayı kaldırdı",
  "rating.delete": "Değerlendirme sildi",
  "report.reviewing": "Şikayeti incelemeye aldı",
  "report.resolved": "Şikayeti çözdü",
  "verification.approve": "Telefonu onayladı",
  "verification.reject": "Telefonu reddetti",
  "support.close": "Destek talebini kapattı",
  "announcement.send": "Duyuru gönderdi",
  "category.create": "Kategori ekledi",
  "category.edit": "Kategoriyi düzenledi",
  "category.delete": "Kategoriyi sildi",
  "attribute.create": "Alan ekledi",
  "attribute.edit": "Alanı düzenledi",
  "attribute.delete": "Alanı sildi",
};

function targetHref(type: string, id: string | null) {
  if (!id) return null;
  if (type === "listing") return `/yonetim/ilanlar/${id}`;
  if (type === "user") return `/yonetim/kullanicilar/${id}`;
  if (type === "report") return `/yonetim/sikayetler/${id}`;
  return null;
}

export default async function AuditLog({ searchParams }: { searchParams: Promise<{ sayfa?: string }> }) {
  const [{ sayfa }, { t, f }] = await Promise.all([searchParams, getI18n()]);
  const page = Math.max(1, Number(sayfa) || 1);
  const { items } = await apiServer<{ items: Row[] }>(`/admin/audit?page=${page}&pageSize=50`);
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("İşlem kayıtları")}</h1>
        <p className="mt-1 text-[14px] text-muted">{t("Yöneticilerin başkalarının verisini değiştiren her işlemi burada kalıcı olarak kayıtlıdır.")}</p>
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-card border border-border text-[14px]">
        {items.map((a) => {
          const href = targetHref(a.targetType, a.targetId);
          return (
            <li key={a.id} className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
              <span className="w-40 flex-shrink-0 text-[13px] text-muted">{f("timeAgo", a.createdAt)}</span>
              <span className="min-w-0 flex-1">
                <strong translate="no">{a.adminName ?? "—"}</strong> {t(ACTIONS[a.action] ?? a.action)}
                {href ? (
                  <Link href={href} className="ml-1 text-accent hover:underline">
                    {t("aç")}
                  </Link>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
      <Pagination page={page} pages={items.length === 50 ? page + 1 : page} href={(p) => (p === 1 ? "/yonetim/kayitlar" : `/yonetim/kayitlar?sayfa=${p}`)} />
    </>
  );
}
