"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { ADSENSE_CLIENT, AD_SLOTS, adsEnabled, type AdPlacement } from "@/lib/ads";
import { cn } from "@/lib/cn";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

const sizes: Record<AdPlacement, string> = {
  home: "min-h-[120px] sm:min-h-[140px]",
  results: "min-h-[120px]",
  listing: "min-h-[250px]",
};

/**
 * A labelled AdSense unit. Renders nothing in production until AdSense is
 * configured; in development it shows a dashed placeholder so the layout can
 * be reviewed. Space is reserved up front to avoid layout shift.
 */
export function AdSlot({ placement, className }: { placement: AdPlacement; className?: string }) {
  const ref = useRef<HTMLModElement>(null);
  const pathname = usePathname();
  const slot = AD_SLOTS[placement];

  useEffect(() => {
    if (!adsEnabled || !ref.current || ref.current.dataset.adsbygoogleStatus) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // Ad blockers or a not-yet-loaded script: leave the space empty.
    }
  }, [pathname]);

  if (!adsEnabled) {
    if (process.env.NODE_ENV !== "development") return null;
    return (
      <aside
        aria-label="Reklam alanı"
        className={cn(
          "grid place-items-center rounded-card border border-dashed border-border text-center text-[11px] text-muted",
          sizes[placement],
          className,
        )}
      >
        <span>
          Reklam alanı · {placement}
          <br />
          <small>NEXT_PUBLIC_ADSENSE_CLIENT ayarlanınca AdSense burada görünür (yalnızca geliştirmede görünür)</small>
        </span>
      </aside>
    );
  }

  return (
    <aside aria-label="Reklam" className={cn("flex flex-col gap-1", className)}>
      <span className="text-[9px] font-semibold uppercase tracking-[1.4px] text-muted">Reklam</span>
      <ins
        key={pathname}
        ref={ref}
        className={cn("adsbygoogle block w-full overflow-hidden", sizes[placement])}
        data-ad-client={ADSENSE_CLIENT}
        {...(slot ? { "data-ad-slot": slot } : {})}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
