import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { REGION_COOKIE } from "@/lib/regions";
import { getI18n } from "@/lib/i18n/server";
import { LocationPicker } from "./LocationPicker";

export const metadata: Metadata = { title: "Bölgeni seç", robots: { index: false } };

export default async function LocationPage() {
  const [{ t }, jar] = await Promise.all([getI18n(), cookies()]);
  const current = jar.get(REGION_COOKIE)?.value ?? null;
  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-4 sm:px-6 sm:pt-6">
      <Breadcrumbs items={[t("Bölgeni seç")]} />
      <h1 className="mt-3 text-2xl font-bold tracking-tight">{t("Bölgeni seç")}</h1>
      <p className="mb-6 mt-1 text-[14px] text-muted">{t("Yakınındaki ilanları önce görmek için bölgeni seç. Seçimin yalnızca bu cihazda hatırlanır.")}</p>
      <LocationPicker current={current} />
    </div>
  );
}
