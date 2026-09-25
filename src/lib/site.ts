export const SITE = {
  name: "Kıbrıs İkinci El",
  tagline: "İyi eşyalara ikinci bir hikâye",
  description:
    "Kıbrıs'ta ikinci el mobilya, elektronik, giyim, bebek ürünleri ve daha fazlası. Ücretsiz ilan ver, satıcıyla doğrudan mesajlaş.",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  /** Shown on legal pages; leave empty to point people to the support form instead. */
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "",
  legalUpdated: "24 Eylül 2026",
  locale: "tr_TR",
} as const;

export function absoluteUrl(path = "/") {
  return `${SITE.url}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Sign-in methods that need outside setup stay hidden until switched on:
 * - phone OTP needs an SMS provider (or a Send SMS hook) in Supabase,
 * - Google needs an OAuth client in Google Cloud and the Google provider enabled in Supabase.
 */
export const AUTH_METHODS = {
  phone: process.env.NEXT_PUBLIC_AUTH_PHONE === "1",
  google: process.env.NEXT_PUBLIC_AUTH_GOOGLE === "1",
} as const;
