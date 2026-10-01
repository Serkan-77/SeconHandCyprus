import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignupForm } from "@/components/auth/AuthForms";
import { getI18n } from "@/lib/i18n/server";
import { safeInternalPath } from "@/lib/safeRedirect";

export const metadata: Metadata = {
  title: "Üye ol",
  description: "Kıbrıs İkinci Elcim'e ücretsiz üye ol: ilan ver, satıcılarla mesajlaş, favorilerini kaydet.",
};

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const [{ returnTo }, { t }] = await Promise.all([searchParams, getI18n()]);
  const target = safeInternalPath(returnTo);
  return (
    <AuthShell
      title="Ücretsiz hesap oluştur"
      subtitle="İlan vermek ve mesajlaşmak için bir dakikanı ayır."
      footer={
        <>
          {t("Zaten üye misin?")}{" "}
          <Link href={`/giris${target !== "/" ? `?returnTo=${encodeURIComponent(target)}` : ""}`} className="font-semibold text-accent hover:underline">
            {t("Giriş yap")}
          </Link>
        </>
      }
    >
      <SignupForm returnTo={target} />
    </AuthShell>
  );
}
