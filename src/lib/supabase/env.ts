export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

export function publicImageUrl(path: string | null | undefined, bucket = "listing-images") {
  if (!path) return "/images/placeholder.svg";
  if (path.startsWith("http") || path.startsWith("/")) return path;
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}
