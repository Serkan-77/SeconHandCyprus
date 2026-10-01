import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/AuthForms";
import { getI18n } from "@/lib/i18n/server";
import { safeInternalPath } from "@/lib/safeRedirect";

export const metadata: Metadata = { title: "Giriş yap", robots: { index: false } };

const NOTICES: Record<string, string> = {
  gerekli: "Devam etmek için giriş yap.",
  baglanti: "Bu bağlantı artık geçerli değil. Giriş yapıp devam edebilirsin.",
  oturum: "Oturumun sona erdi. Tekrar giriş yap.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ returnTo?: string; hata?: string }> }) {
  const [{ returnTo, hata }, { t }] = await Promise.all([searchParams, getI18n()]);
  const target = safeInternalPath(returnTo);
  const notice = hata ? NOTICES[hata] : target !== "/" ? NOTICES.gerekli : undefined;
  return (
    <AuthShell
      title="Tekrar hoş geldin"
      subtitle="E-posta adresin ve şifrenle giriş yap."
      footer={
        <>
          {t("Hesabın yok mu?")}{" "}
          <Link href={`/kayit${target !== "/" ? `?returnTo=${encodeURIComponent(target)}` : ""}`} className="font-semibold text-accent hover:underline">
            {t("Ücretsiz üye ol")}
          </Link>
        </>
      }
    >
      <LoginForm returnTo={target} notice={notice} />
    </AuthShell>
  );
}
