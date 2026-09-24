import { getViewer } from "@/lib/queries";
import { SupportForm } from "./SupportForm";

export const metadata = { title: "Destek talebi", description: "Kıbrıs İkinci El destek ekibine ulaş." };

export default async function SupportPage() {
  const viewer = await getViewer();
  return <SupportForm defaultEmail={viewer?.user.email ?? ""} />;
}
