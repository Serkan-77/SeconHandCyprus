
import * as I18n from "@/components/i18n/Localized";
import type { ReactNode } from "react";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/cn";

export function FormError({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div role="alert" className={cn("flex items-start gap-2.5 rounded-xl bg-brand-soft px-4 py-3 text-xs", className)}>
      <Icon name="info" className="h-4 w-4 flex-shrink-0 text-accent" />
      <I18n.span>{children}</I18n.span>
    </div>
  );
}

export function FormSuccess({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <I18n.div role="status" className={cn("flex items-center gap-1.5 text-xs font-medium text-accent", className)}>
      <Icon name="check" className="h-4 w-4" />
      {children}
    </I18n.div>
  );
}
