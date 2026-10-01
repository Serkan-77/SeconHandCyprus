import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Settings } from "@/components/account/Settings";
import { getMe } from "@/lib/api/server";

export const metadata: Metadata = { title: "Ayarlar" };

export default async function SettingsPage() {
  const me = await getMe();
  if (!me) redirect("/giris?returnTo=/hesabim/ayarlar");
  return <Settings me={me} />;
}
