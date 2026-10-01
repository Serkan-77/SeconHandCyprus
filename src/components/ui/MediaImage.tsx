import type { ImageUrls } from "@/lib/api/types";
import { cn } from "@/lib/cn";

// Listing photos come from the API already resized to 400/800/1600 px WebP,
// so a plain responsive <img> is enough: no second resize on the server.
const WIDTHS = { sm: 400, md: 800, lg: 1600 } as const;

export function MediaImage({
  urls,
  alt,
  sizes = "(min-width: 1024px) 25vw, 50vw",
  priority = false,
  className,
  max = "lg",
}: {
  urls: ImageUrls | null | undefined;
  alt: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
  /** Largest variant to offer (cards never need the 1600 px one). */
  max?: "sm" | "md" | "lg";
}) {
  if (!urls) {
    return (
      <span className={cn("flex h-full w-full items-center justify-center bg-brand-soft text-subtle", className)} aria-hidden>
        <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 3h18v18H3zM3 17l6-6 5 5 3-3 4 4M8 7h.01" />
        </svg>
      </span>
    );
  }
  const keys = (["sm", "md", "lg"] as const).slice(0, max === "sm" ? 1 : max === "md" ? 2 : 3);
  const external = /^https?:\/\//.test(urls.sm) && urls.sm === urls.lg;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={urls[keys[keys.length - 1] === "lg" ? "md" : keys[keys.length - 1]]}
      srcSet={external ? undefined : keys.map((k) => `${urls[k]} ${WIDTHS[k]}w`).join(", ")}
      sizes={external ? undefined : sizes}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      className={cn("h-full w-full object-cover", className)}
    />
  );
}
