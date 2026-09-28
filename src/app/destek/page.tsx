import { getViewer } from "@/lib/queries";
import { SITE } from "@/lib/site";
import { SupportForm } from "./SupportForm";

export const metadata = { title: "Destek talebi", description: `${SITE.name} destek ekibine ulaş.` };

export default async function SupportPage() {
  const viewer = await getViewer();
  return <SupportForm defaultEmail={viewer?.user.email ?? ""} />;
}
