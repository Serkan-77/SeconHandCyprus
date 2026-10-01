import { redirect } from "next/navigation";
import { safeInternalPath } from "@/lib/safeRedirect";

// Kept for old links: sign-in now explains itself on /giris.
export default async function LoginRequired({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const { returnTo } = await searchParams;
  redirect(`/giris?returnTo=${encodeURIComponent(safeInternalPath(returnTo))}`);
}
