import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE.name,
    short_name: "İkinci El",
    description: SITE.description,
    lang: "tr",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#111318",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
