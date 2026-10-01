import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetRequestForm } from "@/components/auth/AuthForms";
import { getI18n } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Şifremi unuttum", robots: { index: false } };

export default async function ResetRequestPage() {
  const { t } = await getI18n();
  return (
    <AuthShell
      title="Şifreni mi unuttun?"
      subtitle="E-posta adresini yaz, şifreni yenilemen için bir bağlantı gönderelim."
      footer={
        <Link href="/giris" className="font-semibold text-accent hover:underline">
          {t("Girişe dön")}
        </Link>
      }
    >
      <ResetRequestForm />
    </AuthShell>
  );
}
