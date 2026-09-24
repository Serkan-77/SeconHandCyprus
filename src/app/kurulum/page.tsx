import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/AuthLayout";
import { ProfileForm } from "@/components/ProfileForm";
import { getViewer } from "@/lib/queries";

export const metadata = { title: "Profilini tamamla" };

export default async function SetupProfilePage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/giris-gerekli?returnTo=/kurulum");

  return (
    <AuthLayout title="Profilini tamamla." backHref="/" backLabel="Şimdilik atla">
      <p className="mb-6 text-sm text-muted">
        Adın ve bölgen, satıcılar ve alıcılarla güven kurmana yardımcı olur.
      </p>
      <ProfileForm profile={viewer.profile} mode="setup" />
    </AuthLayout>
  );
}
