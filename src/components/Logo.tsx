import Image from "next/image";
import { SITE } from "@/lib/site";
import { cn } from "@/lib/cn";

/**
 * Full wordmark (island + "Kıbrıs İkinci Elcim"), transparent PNG.
 * `tone="auto"` swaps to the lighter variant with the site theme (see `.logo-*` in globals.css);
 * `tone="dark"` is for surfaces that are always dark, like the admin sidebar.
 */
export function Logo({
  className,
  priority = false,
  tone = "auto",
}: {
  className?: string;
  priority?: boolean;
  tone?: "auto" | "dark";
}) {
  const img = (src: string, extra?: string) => (
    <Image
      src={src}
      alt={SITE.name}
      width={538}
      height={104}
      priority={priority}
      className={cn("h-9 w-auto", extra, className)}
    />
  );
  if (tone === "dark") return img("/brand/logo-dark.png");
  return (
    <>
      {img("/brand/logo.png", "logo-light")}
      {img("/brand/logo-dark.png", "logo-dark")}
    </>
  );
}
