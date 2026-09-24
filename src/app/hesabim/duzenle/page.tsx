import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/ProfileForm";
import { getViewer } from "@/lib/queries";

export const metadata = { title: "Profili düzenle" };

export default async function EditProfilePage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/giris-gerekli?returnTo=/hesabim/duzenle");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-[30px]">Profili düzenle</h1>
      <ProfileForm profile={viewer.profile} mode="edit" />
    </div>
  );
}
