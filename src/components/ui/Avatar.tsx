import { cn } from "@/lib/cn";
import { initials as toInitials } from "@/lib/format";
import type { ImageUrls } from "@/lib/api/types";

const SIZES = { xs: "h-7 w-7 text-[11px]", sm: "h-9 w-9 text-xs", md: "h-11 w-11 text-sm", lg: "h-16 w-16 text-xl", xl: "h-24 w-24 text-3xl" };

/** Profile photo, or initials on a neutral disc. Decorative: the name is always shown next to it. */
export function Avatar({
  name,
  src,
  size = "md",
  className,
  initials,
  large,
}: {
  name?: string | null;
  src?: ImageUrls | string | null;
  size?: keyof typeof SIZES;
  className?: string;
  /** @deprecated pass name */
  initials?: string;
  /** @deprecated pass size="lg" */
  large?: boolean;
}) {
  const url = typeof src === "string" ? src : src ? (size === "xl" || size === "lg" || large ? src.md : src.sm) : null;
  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-flex flex-shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-brand-soft font-semibold text-muted",
        SIZES[large ? "lg" : size],
        className,
      )}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
      ) : (
        (initials ?? toInitials(name))
      )}
    </span>
  );
}
