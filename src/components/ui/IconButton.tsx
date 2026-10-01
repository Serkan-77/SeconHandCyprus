import * as I18n from "@/components/i18n/Localized";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "@/components/icons";

/** A square icon-only button with an accessible name and a 44 px touch target. */
export function IconButton({
  icon,
  label,
  className,
  iconClassName,
  type = "button",
  ...rest
}: {
  icon: IconName;
  label: string;
  iconClassName?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <I18n.button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-text transition hover:bg-brand-soft disabled:opacity-50",
        className,
      )}
      {...rest}
    >
      <Icon name={icon} className={cn("h-5 w-5", iconClassName)} />
    </I18n.button>
  );
}
