import { redirect } from "next/navigation";
import { VerifyPhoneForm } from "./VerifyPhoneForm";

export const metadata = { title: "Telefonunu doğrula" };

export default async function VerifyPhonePage({ searchParams }: { searchParams: Promise<{ tel?: string }> }) {
  const { tel } = await searchParams;
  if (!tel) redirect("/giris");
  return <VerifyPhoneForm phone={tel} />;
}
