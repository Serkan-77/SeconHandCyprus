import { OG_SIZE, brandCard } from "@/lib/ogImage";

export const alt = "Kıbrıs İkinci Elcim — iyi eşyalara ikinci bir hikâye";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return brandCard({ eyebrow: "KIBRIS'TA YENİDEN KEŞFET", title: "Güzel şeyler ikinci kez sevilir." });
}
