
import * as I18n from "@/components/i18n/Localized";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { LinkButton } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/queries";
import { AdminUserForm } from "./AdminUserForm";

export const metadata = { title: "Yönetim · Kullanıcı düzenleme", robots: { index: false } };

export default async function AdminEditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AdminShell>
      <Editor id={id} />
    </AdminShell>
  );
}

async function Editor({ id }: { id: string }) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const viewer = await requireAdmin();
  const supabase = await createClient();
  const [{ data: profile }, { data: contact }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
    supabase.from("profile_private").select("phone").eq("id", id).maybeSingle(),
  ]);
  if (!profile) notFound();

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <I18n.h1 className="text-2xl font-semibold tracking-tight sm:text-[27px]">Kullanıcıyı düzenle</I18n.h1>
        <LinkButton href={`/yonetim/kullanicilar/${id}`} variant="outline" full={false} className="min-h-10 text-xs">
          Kullanıcıya dön
        </LinkButton>
      </div>
      <AdminUserForm
        userId={id}
        isSelf={id === viewer.user.id}
        canDelete={profile.role !== "admin"}
        initial={{
          name: profile.display_name,
          region: profile.region ?? "",
          bio: profile.bio ?? "",
          phone: contact?.phone ?? "",
          phoneVerified: profile.phone_verified,
          role: profile.role,
          accountType: profile.account_type === "store" ? "store" : "personal",
          store: {
            storeName: profile.store_name ?? "",
            address: profile.store_address ?? "",
            phone: profile.store_phone ?? "",
            website: profile.store_website ?? "",
            hours: profile.store_hours ?? "",
          },
          storeVerified: Boolean(profile.store_verified),
        }}
      />
    </>
  );
}
