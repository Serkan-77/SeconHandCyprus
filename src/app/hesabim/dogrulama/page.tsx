import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/queries";
import { TrustCenter } from "./TrustCenter";

export const metadata = { title: "Doğrulama merkezi" };

export default async function TrustCenterPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/giris-gerekli?returnTo=/hesabim/dogrulama");
  const supabase = await createClient();
  const [{ data: contact }, { data: pending }] = await Promise.all([
    supabase.from("profile_private").select("phone").eq("id", viewer.user.id).single(),
    supabase
      .from("verification_requests")
      .select("detail, status, created_at")
      .eq("user_id", viewer.user.id)
      .eq("kind", "phone")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return (
    <TrustCenter
      email={viewer.user.email ?? ""}
      emailVerified={Boolean(viewer.user.email_confirmed_at)}
      phone={contact?.phone ?? ""}
      phoneVerified={viewer.profile.phoneVerified}
      phoneRequest={pending ? { detail: pending.detail, status: pending.status } : null}
      hasAvatar={Boolean(viewer.profile.avatarUrl)}
    />
  );
}
