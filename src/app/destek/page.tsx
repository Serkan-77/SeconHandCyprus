import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getMe } from "@/lib/api/server";
import { SITE } from "@/lib/site";
import { getI18n } from "@/lib/i18n/server";
import { SupportForm } from "./SupportForm";

export const metadata: Metadata = { title: "Destek", description: `${SITE.name} destek ekibine ulaş.` };

export default async function SupportPage() {
  const [me, { t }] = await Promise.all([getMe(), getI18n()]);
  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-4 sm:px-6 sm:pt-6">
      <Breadcrumbs items={[t("Destek")]} />
      <h1 className="mt-3 text-2xl font-bold tracking-tight">{t("Destek talebi oluştur")}</h1>
      <p className="mb-6 mt-1 text-[14px] text-muted">
        {t("Önce")}{" "}
        <Link href="/yardim" className="font-medium text-accent hover:underline">
          {t("yardım sayfasına")}
        </Link>{" "}
        {t("göz atabilirsin; sık sorulan soruların cevabı orada.")}
      </p>
      <SupportForm defaultEmail={me?.email ?? ""} />
    </div>
  );
}
