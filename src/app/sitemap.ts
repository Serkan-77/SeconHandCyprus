import type { MetadataRoute } from "next";
import { apiServer, getTaxonomy } from "@/lib/api/server";
import { regionNames } from "@/lib/regions";
import { absoluteUrl } from "@/lib/site";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/ilanlar"), changeFrequency: "hourly", priority: 0.9 },
    { url: absoluteUrl("/kategori"), changeFrequency: "weekly", priority: 0.7 },
    { url: absoluteUrl("/magazalar"), changeFrequency: "daily", priority: 0.6 },
    ...regionNames.map((city) => ({
      url: absoluteUrl(`/ilanlar?sehir=${encodeURIComponent(city)}`),
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
    ...["/hakkimizda", "/one-cikar", "/yardim", "/destek", "/kosullar", "/gizlilik", "/cerez-politikasi"].map((path) => ({
      url: absoluteUrl(path),
      changeFrequency: "monthly" as const,
      priority: 0.3,
    })),
  ];

  const [taxonomy, data] = await Promise.all([
    getTaxonomy(),
    apiServer<{ listings: { slug: string; updatedAt: string; sellerId: string }[] }>("/sitemap", { anonymous: true, revalidate: 900 }).catch(() => ({
      listings: [],
    })),
  ]);
  const sellers = [...new Set(data.listings.map((l) => l.sellerId))];

  return [
    ...pages,
    ...taxonomy.categories
      .filter((c) => c.isActive)
      .map((c) => ({ url: absoluteUrl(`/kategori/${c.slug}`), changeFrequency: "daily" as const, priority: c.parentId ? 0.7 : 0.8 })),
    ...data.listings.map((l) => ({
      url: absoluteUrl(`/ilan/${l.slug}`),
      lastModified: l.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...sellers.map((id) => ({ url: absoluteUrl(`/satici/${id}`), changeFrequency: "weekly" as const, priority: 0.4 })),
  ];
}
