import Image from "next/image";
import { cn } from "@/lib/cn";

export function Avatar({
  initials,
  src,
  large = false,
  className,
}: {
  initials: string;
  src?: string | null;
  large?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative inline-flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-soft font-semibold text-text",
        large ? "h-20 w-20 text-2xl" : "h-11 w-11 text-sm",
        className,
      )}
    >
      {src ? <Image src={src} alt="" fill sizes={large ? "80px" : "44px"} className="object-cover" /> : initials}
    </span>
  );
}
