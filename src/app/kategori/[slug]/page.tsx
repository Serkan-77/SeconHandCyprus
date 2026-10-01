import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Results } from "@/components/search/Results";
import { getTaxonomy } from "@/lib/api/server";
import { chainOf } from "@/lib/taxonomy";
import { isIndexable, resultsHref, type WebParams } from "@/lib/search";
import { SITE } from "@/lib/site";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<WebParams> };

async function findCategory(slug: string) {
  return (await getTaxonomy()).categories.find((c) => c.slug === slug && c.isActive);
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const query = await searchParams;
  const category = await findCategory(slug);
  if (!category) return { title: "Kategori bulunamadı", robots: { index: false } };
  const taxonomy = await getTaxonomy();
  const path = chainOf(taxonomy.categories, category.id)
    .map((c) => c.name)
    .join(" › ");
  const name = category.name.toLocaleLowerCase("tr-TR");
  const city = typeof query.sehir === "string" && !query.sehir.includes(",") ? query.sehir : undefined;
  const page = Number(query.sayfa) || 1;
  const title = city ? `${city} ikinci el ${name}` : `İkinci el ${name} ilanları`;
  return {
    title: page > 1 ? `${title} · Sayfa ${page}` : title,
    description:
      category.description ??
      `Kıbrıs'ta${city ? ` ${city} bölgesinde` : ""} satılık ikinci el ${name} (${path}). Fotoğraflı ilanları incele, özelliklere göre filtrele ve satıcıyla doğrudan mesajlaş. ${SITE.name}'de ilan vermek ücretsiz.`,
    alternates: { canonical: resultsHref(`/kategori/${slug}`, {}, { sehir: city, sayfa: page > 1 ? String(page) : undefined }) },
    robots: isIndexable(query) ? undefined : { index: false, follow: true },
  };
}

export default async function CategoryResultsPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const category = await findCategory(slug);
  if (!category) notFound();
  return <Results params={await searchParams} category={category} />;
}
