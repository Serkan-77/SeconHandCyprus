import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { SITE } from "@/lib/site";

export const OG_SIZE = { width: 1200, height: 630 };

async function fonts() {
  const load = (file: string) => readFile(join(process.cwd(), "assets/fonts", file));
  const [l5, l7, e5, e7] = await Promise.all([
    load("inter-latin-500.woff"),
    load("inter-latin-700.woff"),
    load("inter-latin-ext-500.woff"),
    load("inter-latin-ext-700.woff"),
  ]);
  return [
    { name: "Inter", data: l5, weight: 500 as const, style: "normal" as const },
    { name: "Inter", data: e5, weight: 500 as const, style: "normal" as const },
    { name: "Inter", data: l7, weight: 700 as const, style: "normal" as const },
    { name: "Inter", data: e7, weight: 700 as const, style: "normal" as const },
  ];
}

/** Brand share card: black on off-white, blue eyebrow, "k." mark. */
export async function brandCard({ eyebrow, title, footer }: { eyebrow: string; title: string; footer?: string }) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#f5f6f8",
          color: "#111318",
          fontFamily: "Inter",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              background: "#111318",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 48,
              fontWeight: 700,
              letterSpacing: -3,
            }}
          >
            k.
          </div>
          <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: -1 }}>{SITE.name}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: 4, color: "#2458d3" }}>{eyebrow}</div>
          <div style={{ fontSize: 76, fontWeight: 500, lineHeight: 1.05, letterSpacing: -3, maxWidth: 980 }}>{title}</div>
        </div>
        <div style={{ fontSize: 26, color: "#66707e" }}>{footer ?? "Ücretsiz ilan ver · Satıcıyla doğrudan mesajlaş"}</div>
      </div>
    ),
    { ...OG_SIZE, fonts: await fonts() },
  );
}
