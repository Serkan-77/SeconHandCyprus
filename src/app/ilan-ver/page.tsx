import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SellWizardClient as SellWizard } from "@/components/sell/SellWizardClient";
import { getMe, getTaxonomy } from "@/lib/api/server";
import { REGION_COOKIE } from "@/lib/regions";

export const metadata: Metadata = { title: "İlan ver", robots: { index: false } };

export default async function SellPage() {
  const me = await getMe();
  if (!me) redirect("/giris?returnTo=/ilan-ver");
  const [taxonomy, jar] = await Promise.all([getTaxonomy(), cookies()]);
  const restricted = (me.status === "restricted" || me.status === "suspended") && (!me.statusUntil || new Date(me.statusUntil) > new Date());
  return (
    <SellWizard
      userId={me.id}
      categories={taxonomy.categories}
      attributes={taxonomy.attributes}
      regions={taxonomy.regions}
      defaultCity={me.region ?? jar.get(REGION_COOKIE)?.value ?? null}
      restricted={restricted}
    />
  );
}
