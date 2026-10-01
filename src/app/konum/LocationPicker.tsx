"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/FormError";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { REGION_COOKIE, nearestRegion } from "@/lib/regions";
import { REGIONS } from "@shared/constants";
import { cn } from "@/lib/cn";

type GeoState = "idle" | "locating" | "denied" | "unavailable" | "found";

/** The chosen region is a preference stored in a cookie on this device only. */
export function LocationPicker({ current }: { current: string | null }) {
  const { t } = useLocale();
  const router = useRouter();
  const [geo, setGeo] = useState<GeoState>("idle");
  const [selected, setSelected] = useState<string | null>(current);

  function locateMe() {
    if (!("geolocation" in navigator)) return setGeo("unavailable");
    setGeo("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Only the nearest region is kept; coordinates are never stored or sent.
        setSelected(nearestRegion(pos.coords.latitude, pos.coords.longitude));
        setGeo("found");
      },
      (err) => setGeo(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  }

  function apply(region: string | null) {
    document.cookie = region
      ? `${REGION_COOKIE}=${encodeURIComponent(region)}; path=/; max-age=31536000; samesite=lax`
      : `${REGION_COOKIE}=; path=/; max-age=0; samesite=lax`;
    router.push(region ? `/ilanlar?sehir=${encodeURIComponent(region)}` : "/ilanlar");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      <Button variant="outline" onClick={locateMe} loading={geo === "locating"} icon={<Icon name="pin" className="h-4 w-4" />}>
        {t("Konumumu kullan")}
      </Button>
      {geo === "denied" ? <Notice tone="warning">{t("Konum izni verilmedi. Bölgeni aşağıdan seçebilirsin.")}</Notice> : null}
      {geo === "unavailable" ? <Notice tone="warning">{t("Konumun şu anda alınamadı. Bölgeni aşağıdan seçebilirsin.")}</Notice> : null}
      {geo === "found" && selected ? (
        <Notice tone="success" icon="check">
          {t("Konumuna en yakın bölge:")} <strong>{selected}</strong>
        </Notice>
      ) : null}
      {(["north", "south"] as const).map((side) => (
        <fieldset key={side}>
          <legend className="mb-2 text-[13px] font-semibold text-muted">{t(side === "north" ? "Kuzey Kıbrıs" : "Güney Kıbrıs")}</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup">
            {REGIONS.filter((r) => r.side === side).map((r) => (
              <button
                key={r.name}
                type="button"
                role="radio"
                aria-checked={selected === r.name}
                onClick={() => setSelected(r.name)}
                className={cn(
                  "flex min-h-12 items-center justify-between rounded-card border px-4 text-[15px] font-medium",
                  selected === r.name ? "border-accent bg-accent-soft" : "border-border hover:border-border-strong",
                )}
              >
                {r.name}
                {selected === r.name ? <Icon name="check" className="h-4 w-4 text-accent" /> : null}
              </button>
            ))}
          </div>
        </fieldset>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => apply(selected)} disabled={!selected}>
          {t("Bu bölgedeki ilanları göster")}
        </Button>
        {current ? (
          <Button variant="ghost" onClick={() => apply(null)}>
            {t("Tüm Kıbrıs")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
