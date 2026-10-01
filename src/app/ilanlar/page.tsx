import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { Results } from "@/components/search/Results";
import { isIndexable, resultsHref, type WebParams } from "@/lib/search";
import { SITE } from "@/lib/site";

type Props = { searchParams: Promise<WebParams> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const city = typeof params.sehir === "string" && !params.sehir.includes(",") ? params.sehir : undefined;
  const page = Number(params.sayfa) || 1;
  const title = params.q ? `"${params.q}" araması` : city ? `${city} ikinci el ilanları` : "Kıbrıs ikinci el ilanları";
  const canonical = resultsHref("/ilanlar", {}, { sehir: city, sayfa: page > 1 ? String(page) : undefined });
  return {
    title: page > 1 ? `${title} · Sayfa ${page}` : title,
    description: city
      ? `${city} ve çevresinde satılık ikinci el eşyalar: mobilya, elektronik, giyim ve daha fazlası. ${SITE.name}'de ücretsiz ilan ver.`
      : "Kıbrıs genelinde satılık ikinci el eşyalar. Kategori, şehir, fiyat ve ürün özelliklerine göre filtrele; satıcıyla doğrudan mesajlaş.",
    alternates: { canonical },
    // Internal search and filter combinations are thin pages: out of the index, links still followed.
    robots: isIndexable(params) ? undefined : { index: false, follow: true },
  };
}

export default async function ResultsPage({ searchParams }: Props) {
  const params = await searchParams;
  // Old URLs: /ilanlar?kategori=x → /kategori/x.
  if (typeof params.kategori === "string" && /^[a-z0-9-]+$/.test(params.kategori)) {
    permanentRedirect(resultsHref(`/kategori/${params.kategori}`, params));
  }
  return <Results params={params} />;
}
