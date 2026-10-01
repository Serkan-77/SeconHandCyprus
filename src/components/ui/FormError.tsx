import * as I18n from "@/components/i18n/Localized";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import { cn } from "@/lib/cn";

/** An error summary for a form; announced to screen readers. */
export function FormError({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div role="alert" className={cn("flex items-start gap-2.5 rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-[13px] text-text", className)}>
      <Icon name="info" className="mt-px h-4 w-4 flex-shrink-0 text-danger" />
      <I18n.span>{children}</I18n.span>
    </div>
  );
}

export function FormSuccess({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <I18n.div role="status" className={cn("flex items-center gap-1.5 text-[13px] font-medium text-success", className)}>
      <Icon name="check" className="h-4 w-4" />
      {children}
    </I18n.div>
  );
}

export function Notice({
  children,
  tone = "info",
  className,
  icon = "info",
}: {
  children: ReactNode;
  tone?: "info" | "warning" | "success" | "danger";
  className?: string;
  icon?: IconName;
}) {
  const tones = {
    info: "bg-accent-soft text-text [&_svg]:text-accent",
    warning: "bg-warning-soft text-text [&_svg]:text-warning",
    success: "bg-success-soft text-text [&_svg]:text-success",
    danger: "bg-danger-soft text-text [&_svg]:text-danger",
  };
  return (
    <div className={cn("flex items-start gap-2.5 rounded-xl px-4 py-3 text-[13px] leading-relaxed", tones[tone], className)}>
      <Icon name={icon} className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
