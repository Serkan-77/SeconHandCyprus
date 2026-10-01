import * as I18n from "@/components/i18n/Localized";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Kind = "accent" | "neutral" | "sand" | "success" | "warning" | "danger" | "outline";

const kindClass: Record<Kind, string> = {
  accent: "bg-accent-soft text-accent",
  neutral: "bg-brand-soft text-text",
  sand: "bg-sand-soft text-sand",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  outline: "border border-border text-muted",
};

export function Badge({
  children,
  kind = "neutral",
  icon,
  className,
}: {
  children: ReactNode;
  kind?: Kind;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <I18n.span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-[3px] text-[11px] font-semibold leading-tight",
        kindClass[kind],
        className,
      )}
    >
      {icon}
      {children}
    </I18n.span>
  );
}
