
import * as I18n from "@/components/i18n/Localized";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "inverse";

const variantClass: Record<Variant, string> = {
  primary: "bg-brand text-on-brand hover:brightness-95",
  secondary: "bg-brand-soft text-text hover:brightness-95",
  outline: "bg-surface text-text border border-border hover:bg-brand-soft",
  ghost: "bg-transparent text-text hover:bg-brand-soft",
  danger: "bg-text text-surface hover:brightness-90",
  // Transparent, inherits the parent's (already-inverted) text color — for buttons
  // placed on a surface whose color already flips independently of the site theme,
  // like the always-inverted local-banner section.
  inverse: "bg-transparent text-current border border-current/30 hover:bg-current/10",
};

function buttonClasses(variant: Variant, full: boolean, className?: string) {
  return cn(
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-button px-5 text-sm font-semibold transition active:scale-[0.985]",
    full ? "w-full" : "w-auto",
    variantClass[variant],
    className,
  );
}

type BaseProps = {
  variant?: Variant;
  icon?: ReactNode;
  full?: boolean;
  className?: string;
  children: ReactNode;
};

export function Button({
  variant = "primary",
  icon,
  full = true,
  className,
  children,
  ...rest
}: BaseProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <I18n.button className={buttonClasses(variant, full, className)} {...rest}>
      {icon}
      {children}
    </I18n.button>
  );
}

export function LinkButton({
  variant = "primary",
  icon,
  full = true,
  className,
  children,
  href,
  ...rest
}: BaseProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return (
    <I18n.Link href={href} className={buttonClasses(variant, full, className)} {...rest}>
      {icon}
      {children}
    </I18n.Link>
  );
}
