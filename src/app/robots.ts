import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/yonetim", "/hesabim", "/mesajlar", "/ilan-ver", "/kurulum", "/auth", "/sistem", "/giris", "/kayit", "/sifre-yenile", "/yeni-sifre", "/telefon-dogrula", "/giris-gerekli"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
