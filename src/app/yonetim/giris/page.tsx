import { redirect } from "next/navigation";
import { getViewer } from "@/lib/queries";
import { AdminLoginForm } from "./AdminLoginForm";

export const metadata = { title: "Yönetici girişi", robots: { index: false } };

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ yetki?: string }> }) {
  const viewer = await getViewer();
  if (viewer?.profile.role === "admin") redirect("/yonetim");
  const { yetki } = await searchParams;
  return <AdminLoginForm signedInAs={viewer ? (viewer.user.email ?? "") : null} denied={yetki === "yok"} />;
}
