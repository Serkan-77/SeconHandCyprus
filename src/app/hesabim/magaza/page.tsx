import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StoreSettings } from "@/components/account/StoreSettings";
import { getMe } from "@/lib/api/server";

export const metadata: Metadata = { title: "Mağaza" };

export default async function StorePage() {
  const me = await getMe();
  if (!me) redirect("/giris?returnTo=/hesabim/magaza");
  return <StoreSettings me={me} />;
}
