import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/queries";
import { SettingsView } from "./SettingsView";

export const metadata = { title: "Ayarlar" };

export default async function SettingsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/giris-gerekli?returnTo=/hesabim/ayarlar");
  const supabase = await createClient();
  const { data: contact } = await supabase
    .from("profile_private")
    .select("phone, whatsapp_enabled")
    .eq("id", viewer.user.id)
    .single();

  return (
    <SettingsView
      settings={viewer.profile.settings}
      contact={{ phone: contact?.phone ?? "", whatsapp: contact?.whatsapp_enabled ?? false }}
    />
  );
}
