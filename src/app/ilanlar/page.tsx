import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { ListingsResults, isIndexable, resultsHref, type ResultsParams } from "@/components/ListingsResults";
import { SITE } from "@/lib/site";

export async function generateMetadata({ searchParams }: { searchParams: Promise<ResultsParams> }): Promise<Metadata> {
  const params = await searchParams;
  const city = params.sehir;
  const page = Number(params.sayfa) || 1;
  const title = params.q
    ? `"${params.q}" araması`
    : city
      ? `${city} ikinci el ilanları`
      : "Kıbrıs ikinci el ilanları";
  const canonical = city ? `/ilanlar?sehir=${encodeURIComponent(city)}` : "/ilanlar";
  return {
    title: page > 1 ? `${title} · Sayfa ${page}` : title,
    description: city
      ? `${city} ve çevresinde satılık ikinci el eşyalar: mobilya, elektronik, giyim ve daha fazlası. ${SITE.name}'de ücretsiz ilan ver.`
      : `Kıbrıs genelinde satılık ikinci el eşyalar. Kategori, şehir ve fiyata göre filtrele; satıcıyla doğrudan mesajlaş.`,
    alternates: { canonical },
    // Internal search and filter combinations are thin pages: keep them out of the index but let crawlers follow links.
    robots: isIndexable(params) ? undefined : { index: false, follow: true },
  };
}

export default async function ResultsPage({ searchParams }: { searchParams: Promise<ResultsParams> }) {
  const params = await searchParams;
  // Old category URLs (/ilanlar?kategori=x) move to /kategori/x.
  if (params.kategori) permanentRedirect(resultsHref(params));
  return <ListingsResults params={params} />;
}
