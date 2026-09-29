
import * as I18n from "@/components/i18n/Localized";
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
    <I18n.span
      className={cn(
        "relative inline-flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-soft font-semibold text-text",
        large ? "h-20 w-20 text-2xl" : "h-11 w-11 text-sm",
        className,
      )}
    >
      {src ? <I18n.Image src={src} alt="" fill sizes={large ? "80px" : "44px"} className="object-cover" /> : initials}
    </I18n.span>
  );
}
