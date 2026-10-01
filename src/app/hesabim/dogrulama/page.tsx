import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Trust } from "@/components/account/Trust";
import { apiServer, getMe } from "@/lib/api/server";

export const metadata: Metadata = { title: "Güven ve doğrulama" };

export default async function TrustPage() {
  const me = await getMe();
  if (!me) redirect("/giris?returnTo=/hesabim/dogrulama");
  const { items } = await apiServer<{ items: never[] }>("/me/verification-requests").catch(() => ({ items: [] as never[] }));
  return <Trust emailVerified={me.emailVerified} phoneVerified={me.phoneVerified} phone={me.contact.phone} requests={items} />;
}
