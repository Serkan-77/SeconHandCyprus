import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/env";
import { regionNames } from "@/lib/regions";
import { absoluteUrl } from "@/lib/site";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/ilanlar"), changeFrequency: "hourly", priority: 0.9 },
    { url: absoluteUrl("/kategori"), changeFrequency: "weekly", priority: 0.7 },
    ...regionNames.map((city) => ({
      url: absoluteUrl(`/ilanlar?sehir=${encodeURIComponent(city)}`),
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
    ...["/hakkimizda", "/yardim", "/destek", "/kosullar", "/gizlilik", "/cerez-politikasi"].map((path) => ({
      url: absoluteUrl(path),
      changeFrequency: "monthly" as const,
      priority: 0.3,
    })),
  ];
  if (!isSupabaseConfigured) return pages;

  // Anonymous client: the sitemap only lists what the public can see.
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  const [{ data: listings }, { data: categories }] = await Promise.all([
    supabase
      .from("listings")
      .select("slug, seller_id, updated_at")
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(10000),
    supabase.from("categories").select("slug"),
  ]);

  const sellers = [...new Set((listings ?? []).map((l) => l.seller_id))];

  return [
    ...pages,
    ...(categories ?? []).map((c) => ({
      url: absoluteUrl(`/kategori/${c.slug}`),
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...(listings ?? []).map((l) => ({
      url: absoluteUrl(`/ilan/${l.slug}`),
      lastModified: l.updated_at,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...sellers.map((id) => ({
      url: absoluteUrl(`/satici/${id}`),
      changeFrequency: "weekly" as const,
      priority: 0.4,
    })),
  ];
}
