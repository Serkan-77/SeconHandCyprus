import { OG_SIZE, brandCard } from "@/lib/ogImage";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";

export const alt = "Kıbrıs İkinci El kategori";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  const { data } = await db.from("categories").select("name").eq("slug", slug).maybeSingle();
  const name = data?.name ?? "İlanlar";
  return brandCard({ eyebrow: "KIBRIS · İKİNCİ EL", title: `İkinci el ${name.toLocaleLowerCase("tr-TR")} ilanları` });
}
