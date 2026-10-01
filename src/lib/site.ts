import { assertPublicEnv } from "./envCheck.ts";

// Fail fast in production on a missing or invalid public environment (P1-12).
// Each variable is referenced by name so Next.js inlines it into client bundles.
assertPublicEnv(
  {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
  },
  process.env.NODE_ENV === "production",
);

export const SITE = {
  name: "Kıbrıs İkinci Elcim",
  tagline: "İyi eşyalara ikinci bir hikâye",
  description:
    "Kıbrıs'ta ikinci el mobilya, elektronik, giyim, bebek ürünleri ve daha fazlası. Ücretsiz ilan ver, satıcıyla doğrudan mesajlaş.",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  /** Shown on legal pages; leave empty to point people to the support form instead. */
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "",
  legalUpdated: "26 Eylül 2026",
  locale: "tr_TR",
} as const;

/** Realtime socket: same origin by default; a separate origin only in development. */
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "";

export function absoluteUrl(path = "/") {
  return `${SITE.url}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Google sign-in stays hidden until the OAuth client is configured on the API. */
export const AUTH_METHODS = {
  google: process.env.NEXT_PUBLIC_AUTH_GOOGLE === "1",
} as const;
