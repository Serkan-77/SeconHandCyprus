import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminUserForm } from "@/components/admin/AdminUserForm";
import { apiServerOrNull } from "@/lib/api/server";
import { getI18n } from "@/lib/i18n/server";

export const metadata = { title: "Kullanıcıyı düzenle" };

type P = Record<string, string | boolean | null>;

export default async function AdminEditUser({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [data, { t }] = await Promise.all([apiServerOrNull<{ profile: P }>(`/admin/users/${id}`), getI18n()]);
  if (!data) notFound();
  const p = data.profile;
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  return (
    <>
      <Link href={`/yonetim/kullanicilar/${id}`} className="text-[13px] text-muted hover:text-text">
        ← {t("Kullanıcı")}
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">{t("Kullanıcıyı düzenle")}</h1>
      <AdminUserForm
        id={id}
        initial={{
          name: s(p.displayName),
          region: s(p.region),
          bio: s(p.bio),
          phone: s(p.phone),
          phoneVerified: Boolean(p.phoneVerified),
          role: p.role === "admin" ? "admin" : "user",
          accountType: p.accountType === "store" ? "store" : "personal",
          store: { storeName: s(p.storeName), address: s(p.storeAddress), phone: s(p.storePhone), website: s(p.storeWebsite), hours: s(p.storeHours) },
          storeVerified: Boolean(p.storeVerified),
        }}
      />
    </>
  );
}
