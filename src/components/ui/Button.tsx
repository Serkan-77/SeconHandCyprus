import * as I18n from "@/components/i18n/Localized";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "accent" | "secondary" | "outline" | "ghost" | "danger" | "danger-ghost" | "inverse";
type Size = "sm" | "md" | "lg";

const variantClass: Record<Variant, string> = {
  primary: "bg-brand text-on-brand hover:opacity-90 disabled:opacity-50",
  accent: "bg-accent text-on-accent hover:bg-accent-hover disabled:opacity-50",
  // White with a black outline: the second choice next to a black primary.
  secondary: "border border-brand bg-surface text-text hover:bg-brand-soft disabled:opacity-60",
  outline: "border border-border-strong bg-surface text-text hover:bg-brand-soft disabled:opacity-60",
  ghost: "bg-transparent text-text hover:bg-brand-soft disabled:opacity-60",
  danger: "bg-danger text-white hover:opacity-90 disabled:opacity-50 dark:text-[#1a0a0a]",
  "danger-ghost": "bg-transparent text-danger hover:bg-danger-soft disabled:opacity-60",
  // For surfaces whose colour already flips independently of the theme.
  inverse: "border border-current/30 bg-transparent text-current hover:bg-current/10",
};

const sizeClass: Record<Size, string> = {
  sm: "min-h-9 px-3.5 text-[13px] gap-1.5 rounded-[9px]",
  md: "min-h-11 px-5 text-sm gap-2 rounded-button",
  lg: "min-h-12 px-6 text-[15px] gap-2 rounded-button",
};

export function buttonClasses(variant: Variant = "primary", full = false, className?: string, size: Size = "md") {
  return cn(
    "inline-flex select-none items-center justify-center font-semibold transition-[background,opacity,transform] duration-150 active:scale-[0.985] disabled:pointer-events-none",
    sizeClass[size],
    full ? "w-full" : "w-auto",
    variantClass[variant],
    className,
  );
}

type BaseProps = {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  iconEnd?: ReactNode;
  full?: boolean;
  loading?: boolean;
  className?: string;
  children: ReactNode;
};

function Spinner() {
  return (
    <span
      aria-hidden
      className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
    />
  );
}

export function Button({
  variant = "primary",
  size = "md",
  icon,
  iconEnd,
  full = false,
  loading = false,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: BaseProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <I18n.button
      type={type}
      className={buttonClasses(variant, full, className, size)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children}
      {iconEnd}
    </I18n.button>
  );
}

export function LinkButton({
  variant = "primary",
  size = "md",
  icon,
  iconEnd,
  full = false,
  className,
  children,
  href,
  ...rest
}: Omit<BaseProps, "loading"> & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return (
    <I18n.Link href={href} className={buttonClasses(variant, full, className, size)} {...rest}>
      {icon}
      {children}
      {iconEnd}
    </I18n.Link>
  );
}
