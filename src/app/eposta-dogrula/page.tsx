import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { VerifyEmail } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "E-posta doğrulama", robots: { index: false }, referrer: "no-referrer" };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <AuthShell title="E-posta doğrulama">
      <VerifyEmail token={typeof token === "string" ? token : ""} />
    </AuthShell>
  );
}
