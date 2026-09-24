import { NewPasswordForm } from "@/components/NewPasswordForm";
import { getViewer } from "@/lib/queries";

export const metadata = { title: "Yeni şifre belirle" };

export default async function NewPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  // The reset link signs the user in via /auth/callback before landing here;
  // without a session the link was invalid or already used.
  const viewer = await getViewer();
  return <NewPasswordForm valid={token !== "expired" && Boolean(viewer)} />;
}
