import { redirect } from "next/navigation";
import { VerifyPhoneForm } from "./VerifyPhoneForm";
import { AUTH_METHODS } from "@/lib/site";

export const metadata = { title: "Telefonunu doğrula" };

export default async function VerifyPhonePage({ searchParams }: { searchParams: Promise<{ tel?: string }> }) {
  const { tel } = await searchParams;
  if (!tel || !AUTH_METHODS.phone) redirect("/giris");
  return <VerifyPhoneForm phone={tel} />;
}
