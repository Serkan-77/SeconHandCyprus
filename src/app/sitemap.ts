import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/env";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages = ["", "/ilanlar", "/kategori", "/yardim", "/destek", "/kosullar", "/gizlilik"].map((path) => ({
    url: `${siteUrl}${path}`,
    changeFrequency: "daily" as const,
    priority: path === "" ? 1 : 0.6,
  }));
  if (!isSupabaseConfigured) return staticPages;

  // Anonymous client: the sitemap only lists what the public can see.
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  const [{ data: listings }, { data: categories }] = await Promise.all([
    supabase.from("listings").select("slug, updated_at").eq("status", "active").order("updated_at", { ascending: false }).limit(5000),
    supabase.from("categories").select("slug"),
  ]);

  return [
    ...staticPages,
    ...(categories ?? []).map((c) => ({
      url: `${siteUrl}/ilanlar?kategori=${c.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...(listings ?? []).map((l) => ({
      url: `${siteUrl}/ilan/${l.slug}`,
      lastModified: l.updated_at,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
