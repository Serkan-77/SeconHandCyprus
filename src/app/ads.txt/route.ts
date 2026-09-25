import { ADSENSE_CLIENT, adsEnabled } from "@/lib/ads";

// Authorised Digital Sellers file required by AdSense: /ads.txt
export function GET() {
  if (!adsEnabled) return new Response("Not found", { status: 404 });
  const publisher = ADSENSE_CLIENT.replace(/^ca-/, "");
  return new Response(`google.com, ${publisher}, DIRECT, f08c47fec0942fa0\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" },
  });
}
