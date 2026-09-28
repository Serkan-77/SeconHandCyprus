import Image from "next/image";
import { SITE } from "@/lib/site";
import { cn } from "@/lib/cn";

/** Full wordmark (island + "Kıbrıs İkinci Elcim"). Transparent PNG, reads on light and dark surfaces. */
export function Logo({ className, priority = false }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src="/brand/logo.png"
      alt={SITE.name}
      width={538}
      height={104}
      priority={priority}
      className={cn("h-9 w-auto", className)}
    />
  );
}
