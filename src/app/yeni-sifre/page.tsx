import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { NewPasswordForm } from "@/components/auth/AuthForms";

// The token is in the URL: keep this page out of indexes and referrers.
export const metadata: Metadata = { title: "Yeni şifre", robots: { index: false }, referrer: "no-referrer" };

export default async function NewPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <AuthShell title="Yeni şifre belirle">
      <NewPasswordForm token={typeof token === "string" ? token : ""} />
    </AuthShell>
  );
}
