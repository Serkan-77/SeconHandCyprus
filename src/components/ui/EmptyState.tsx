import * as I18n from "@/components/i18n/Localized";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import { cn } from "@/lib/cn";

/** A calm, useful empty or error state: what happened and what to do next. */
export function EmptyState({
  icon = "search",
  title,
  children,
  action,
  className,
  tone = "neutral",
}: {
  icon?: IconName;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
  tone?: "neutral" | "error";
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-border-strong px-6 py-12 text-center", className)}>
      <span
        className={cn(
          "grid h-14 w-14 place-items-center rounded-full",
          tone === "error" ? "bg-danger-soft text-danger" : "bg-brand-soft text-muted",
        )}
      >
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <I18n.h2 className="text-base font-semibold text-text">{title}</I18n.h2>
      {children ? <I18n.div className="max-w-sm text-[13px] leading-relaxed text-muted">{children}</I18n.div> : null}
      {action ? <div className="mt-2 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}
