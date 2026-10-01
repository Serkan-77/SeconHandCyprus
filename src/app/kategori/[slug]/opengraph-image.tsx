import { OG_SIZE, brandCard } from "@/lib/ogImage";
import { getTaxonomy } from "@/lib/api/server";

export const alt = "Kıbrıs İkinci Elcim kategori";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const name = (await getTaxonomy()).categories.find((c) => c.slug === slug)?.name ?? "İlanlar";
  return brandCard({ eyebrow: "KIBRIS · İKİNCİ EL", title: `İkinci el ${name.toLocaleLowerCase("tr-TR")} ilanları` });
}
