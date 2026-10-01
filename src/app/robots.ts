import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/yonetim",
        "/hesabim",
        "/mesajlar",
        "/ilan-ver",
        "/kurulum",
        "/auth",
        "/sistem",
        "/giris",
        "/kayit",
        "/sifre-yenile",
        "/yeni-sifre",
        "/eposta-dogrula",
        "/telefon-dogrula",
        "/giris-gerekli",
        "/konum",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
