import { assertPublicEnv } from "../envCheck.ts";

// Fail fast in production on a missing or invalid public environment (P1-12).
// Each variable is referenced by name so Next.js inlines it into client bundles.
assertPublicEnv(
  {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  },
  process.env.NODE_ENV === "production",
);

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

export function publicImageUrl(path: string | null | undefined, bucket = "listing-images") {
  if (!path) return "/images/placeholder.svg";
  if (path.startsWith("http") || path.startsWith("/")) return path;
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}
