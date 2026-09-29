
import * as I18n from "@/components/i18n/Localized";
import { cookies } from "next/headers";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { REGION_COOKIE } from "@/lib/regions";
import { LocationPicker } from "./LocationPicker";

export const metadata = { title: "Bölgeni seç" };

export default async function LocationPage() {
  const current = (await cookies()).get(REGION_COOKIE)?.value ?? null;

  return (
    <div className="mx-auto max-w-[760px] px-4 pb-16 sm:px-6">
      <Breadcrumbs items={["Konum seç"]} />
      <I18n.h1 className="mb-2 text-2xl font-semibold tracking-tight sm:text-[32px]">Bölgeni seç</I18n.h1>
      <I18n.p className="mb-6 text-[13px] text-muted">
        Yakınındaki ilanları görmek için bölgeni seç ya da konumunu paylaş. Seçimin bu cihazda hatırlanır.
      </I18n.p>
      <LocationPicker current={current} />
    </div>
  );
}
