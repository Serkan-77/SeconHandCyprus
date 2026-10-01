import Link from "next/link";
import { AdminAction } from "@/components/admin/AdminKit";
import { apiServer } from "@/lib/api/server";
import { getI18n } from "@/lib/i18n/server";

export const metadata = { title: "Destek talepleri" };

type Row = { id: string; email: string; topic: string; message: string; status: string; createdAt: string; userId: string | null; displayName: string | null };

export default async function AdminSupport() {
  const [{ t, f }, { items }] = await Promise.all([getI18n(), apiServer<{ items: Row[] }>("/admin/support")]);
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">{t("Destek talepleri")}</h1>
      {items.length ? (
        <ul className="flex flex-col gap-3">
          {items.map((r) => (
            <li key={r.id} className={`rounded-card border border-border p-4 ${r.status === "closed" ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{t(r.topic)}</p>
                <span className="text-[13px] text-muted">{f("timeAgo", r.createdAt)}</span>
              </div>
              <p className="mt-1 text-[13px] text-muted">
                <a href={`mailto:${r.email}?subject=${encodeURIComponent(`Destek talebiniz: ${r.topic}`)}`} className="text-accent hover:underline" translate="no">
                  {r.email}
                </a>
                {r.userId ? (
                  <>
                    {" · "}
                    <Link href={`/yonetim/kullanicilar/${r.userId}`} className="hover:underline" translate="no">
                      {r.displayName}
                    </Link>
                  </>
                ) : (
                  ` · ${t("üye değil")}`
                )}
              </p>
              <p className="mt-2 whitespace-pre-line text-[14px]" translate="no">
                {r.message}
              </p>
              {r.status === "open" ? (
                <div className="mt-3">
                  <AdminAction label="Kapat" path={`/admin/support/${r.id}/close`} done="Talep kapatıldı." />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-card border border-dashed border-border-strong p-10 text-center text-[14px] text-muted">{t("Destek talebi yok.")}</p>
      )}
    </>
  );
}
