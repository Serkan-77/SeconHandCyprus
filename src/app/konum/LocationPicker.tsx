"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { MapPreview } from "@/components/MapPreview";
import { setRegion } from "@/lib/actions/account";
import { nearestRegion, regionNames } from "@/lib/regions";

type GeoState = "idle" | "locating" | "denied" | "unavailable" | "found";

export function LocationPicker({ current }: { current: string | null }) {
  const [geo, setGeo] = useState<GeoState>("idle");
  const [selected, setSelected] = useState<string | null>(current);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function locateMe() {
    if (!("geolocation" in navigator)) {
      setGeo("unavailable");
      return;
    }
    setGeo("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSelected(nearestRegion(pos.coords.latitude, pos.coords.longitude));
        setGeo("found");
      },
      (err) => setGeo(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  }

  function apply(region: string | null) {
    startTransition(async () => {
      await setRegion(region ?? "");
      router.push(region ? `/ilanlar?sehir=${encodeURIComponent(region)}` : "/ilanlar");
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 sm:p-7">
      {geo === "denied" || geo === "unavailable" ? (
        <div className="mb-6 flex items-start gap-3 rounded-xl bg-brand-soft p-4 text-xs leading-relaxed">
          <Icon name="info" className="h-[18px] w-[18px] flex-shrink-0 text-accent" />
          <span>
            {geo === "denied"
              ? "Konum izni verilmedi. Bölgeni aşağıdan elle seçebilirsin; istersen tarayıcı ayarlarından konum iznini tekrar açabilirsin."
              : "Konumun şu anda alınamadı. Bölgeni aşağıdan elle seçebilirsin."}
          </span>
        </div>
      ) : geo === "found" ? (
        <div className="mb-6 flex items-start gap-3 rounded-xl bg-accent-soft p-4 text-xs leading-relaxed text-accent">
          <Icon name="check" className="h-[18px] w-[18px] flex-shrink-0" />
          <span>
            Konumuna en yakın bölge: <b>{selected}</b>
          </span>
        </div>
      ) : (
        <Button
          variant="outline"
          icon={<Icon name="pin" className="h-4 w-4" />}
          onClick={locateMe}
          disabled={geo === "locating"}
          className="mb-6"
        >
          {geo === "locating" ? "Konum alınıyor…" : "Konumumu kullan"}
        </Button>
      )}

      <MapPreview label={selected ?? "Kıbrıs"} />

      <fieldset className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <legend className="mb-3 text-[13px] font-medium">Bölge seç</legend>
        {regionNames.map((region) => (
          <button
            key={region}
            type="button"
            aria-pressed={selected === region}
            onClick={() => setSelected(region)}
            className={
              "min-h-11 rounded-button border px-3 text-xs " +
              (selected === region ? "border-brand bg-brand text-on-brand" : "border-border bg-surface text-text")
            }
          >
            {region}
          </button>
        ))}
      </fieldset>

      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <Button onClick={() => apply(selected)} disabled={!selected || pending}>
          {selected ? `${selected} ilanlarını göster` : "Bir bölge seç"}
        </Button>
        {current ? (
          <Button variant="outline" full={false} onClick={() => apply(null)} disabled={pending} className="sm:min-w-[180px]">
            Tüm Kıbrıs
          </Button>
        ) : null}
      </div>
    </div>
  );
}
