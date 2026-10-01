import Link from "next/link";
import { AdminAction } from "@/components/admin/AdminKit";
import { apiServer } from "@/lib/api/server";
import { getI18n } from "@/lib/i18n/server";

export const metadata = { title: "Telefon incelemesi" };

type Row = { id: string; kind: string; detail: string; status: string; createdAt: string; userId: string; displayName: string };

export default async function AdminVerifications() {
  const [{ t, f }, { items }] = await Promise.all([getI18n(), apiServer<{ items: Row[] }>("/admin/verifications")]);
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("Telefon incelemesi")}</h1>
        <p className="mt-1 text-[14px] text-muted">{t("Onaylamadan önce numaranın kullanıcıya ait olduğunu makul bir şekilde kontrol et (ör. kullanıcıyı arayarak).")}</p>
      </div>
      {items.length ? (
        <ul className="divide-y divide-border overflow-hidden rounded-card border border-border">
          {items.map((r) => (
            <li key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="font-medium tabular">{r.detail}</p>
                <p className="text-[13px] text-muted">
                  <Link href={`/yonetim/kullanicilar/${r.userId}`} className="hover:underline" translate="no">
                    {r.displayName}
                  </Link>{" "}
                  · {f("timeAgo", r.createdAt)} · {t(r.status)}
                </p>
              </div>
              {r.status === "pending" ? (
                <div className="flex gap-2">
                  <AdminAction label="Onayla" path={`/admin/verifications/${r.id}`} body={{ approve: true }} variant="primary" icon="check" done="Onaylandı." />
                  <AdminAction label="Reddet" path={`/admin/verifications/${r.id}`} body={{ approve: false }} done="Reddedildi." />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-card border border-dashed border-border-strong p-10 text-center text-[14px] text-muted">{t("İnceleme talebi yok.")}</p>
      )}
    </>
  );
}
