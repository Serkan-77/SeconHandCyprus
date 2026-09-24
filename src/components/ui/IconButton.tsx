import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "@/components/icons";

export function IconButton({
  icon,
  label,
  className,
  ...rest
}: {
  icon: IconName;
  label: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      aria-label={label}
      className={cn(
        "inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-text transition hover:bg-brand-soft",
        className,
      )}
      {...rest}
    >
      <Icon name={icon} className="h-5 w-5" />
    </button>
  );
}
