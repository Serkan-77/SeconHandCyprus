import { getCategories } from "@/lib/queries";
import { DetailsForm } from "./DetailsForm";

export const metadata = { title: "İlan ver · Ürün bilgileri" };

export default async function AddDetailsPage() {
  const categories = await getCategories();
  return <DetailsForm categories={categories.map((c) => ({ slug: c.slug, name: c.name }))} />;
}
