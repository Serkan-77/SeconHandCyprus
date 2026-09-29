
import * as I18n from "@/components/i18n/Localized";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function TextLink({
  href,
  children,
  className,
  underline = false,
  ...rest
}: {
  href: string;
  children: ReactNode;
  underline?: boolean;
} & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <I18n.Link
      href={href}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 text-[13px] font-medium text-accent",
        underline && "text-text underline underline-offset-4",
        className,
      )}
      {...rest}
    >
      {children}
    </I18n.Link>
  );
}
