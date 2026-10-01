import type { NextConfig } from "next";

// Content-Security-Policy is set per request (with a nonce) in src/proxy.ts;
// these are the static security headers (P1-15).
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Location is used by the region picker (/konum); camera only for photo capture in the listing form.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self), payment=(), usb=(), browsing-topics=()" },
  // HSTS only makes sense on the real HTTPS domain.
  ...(process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_SITE_URL?.startsWith("https://")
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
    : []),
];

// In production Caddy sends /api and /media straight to the API container;
// these rewrites make the same URLs work in development (next dev + API on :4000).
const API = (process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4000").replace(/\/$/, "");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  output: "standalone",
  // The shared validation and attribute code lives outside src/.
  transpilePackages: [],
  images: {
    // Listing photos are served pre-sized as WebP by the API; Next's optimizer
    // is only used for the few static assets.
    remotePatterns: [{ protocol: "https", hostname: "lh3.googleusercontent.com" }],
  },
  async rewrites() {
    return [
      { source: "/api/v1/:path*", destination: `${API}/api/v1/:path*` },
      { source: "/media/:path*", destination: `${API}/media/:path*` },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
