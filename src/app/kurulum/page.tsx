import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { Onboarding } from "@/components/account/Onboarding";
import { getMe } from "@/lib/api/server";
import { safeInternalPath } from "@/lib/safeRedirect";

export const metadata: Metadata = { title: "Profilini tamamla", robots: { index: false } };

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const [me, { returnTo }] = await Promise.all([getMe(), searchParams]);
  if (!me) redirect("/giris?returnTo=/kurulum");
  return (
    <AuthShell title="Profilini tamamla" subtitle="Adın, fotoğrafın ve bölgen alıcılarla güven kurmanı kolaylaştırır.">
      <Onboarding me={me} next={safeInternalPath(returnTo)} />
    </AuthShell>
  );
}
