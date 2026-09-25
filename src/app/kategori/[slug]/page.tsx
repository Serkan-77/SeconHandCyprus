import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListingsResults, isIndexable, type ResultsParams } from "@/components/ListingsResults";
import { getCategories } from "@/lib/queries";
import { SITE } from "@/lib/site";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<ResultsParams> };

async function findCategory(slug: string) {
  return (await getCategories()).find((c) => c.slug === slug);
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const query = await searchParams;
  const category = await findCategory(slug);
  if (!category) return { title: "Kategori bulunamadı" };
  const name = category.name.toLocaleLowerCase("tr-TR");
  const city = query.sehir;
  const page = Number(query.sayfa) || 1;
  const title = city ? `${city} ikinci el ${name}` : `İkinci el ${name} ilanları`;
  return {
    title: page > 1 ? `${title} · Sayfa ${page}` : title,
    description: `Kıbrıs'ta${city ? ` ${city} bölgesinde` : ""} satılık ikinci el ${name}. Fotoğraflı ilanları incele, fiyatları karşılaştır ve satıcıyla doğrudan mesajlaş. ${SITE.name}'de ilan vermek ücretsiz.`,
    alternates: { canonical: city ? `/kategori/${slug}?sehir=${encodeURIComponent(city)}` : `/kategori/${slug}` },
    robots: isIndexable(query) ? undefined : { index: false, follow: true },
  };
}

export default async function CategoryResultsPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const category = await findCategory(slug);
  if (!category) notFound();
  return <ListingsResults params={await searchParams} category={category} />;
}
