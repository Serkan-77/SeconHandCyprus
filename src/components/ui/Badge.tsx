
import * as I18n from "@/components/i18n/Localized";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Kind = "accent" | "neutral" | "danger";

const kindClass: Record<Kind, string> = {
  accent: "bg-accent-soft text-accent",
  neutral: "bg-brand-soft text-text",
  danger: "bg-brand-soft text-danger",
};

export function Badge({
  children,
  kind = "accent",
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
        "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold leading-tight",
        kindClass[kind],
        className,
      )}
    >
      {icon}
      {children}
    </I18n.span>
  );
}
