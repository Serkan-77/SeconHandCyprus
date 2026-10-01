"use client";

import { useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconButton } from "@/components/ui/IconButton";
import { useFocusTrap } from "@/components/ui/useFocusTrap";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { cn } from "@/lib/cn";

/** A side drawer (left/right) or a full-height bottom sheet on phones, for menus and filters. */
export function Sheet({
  title,
  open,
  onClose,
  children,
  footer,
  side = "right",
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  side?: "left" | "right" | "bottom";
}) {
  const { t } = useLocale();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useFocusTrap(panelRef, open, onClose);
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 animate-fade-in bg-overlay" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "absolute flex flex-col bg-surface shadow-lg outline-none",
          side === "bottom"
            ? "inset-x-0 bottom-0 max-h-[90dvh] animate-sheet-in rounded-t-sheet"
            : cn("inset-y-0 w-[min(420px,92vw)] animate-fade-in", side === "left" ? "left-0" : "right-0"),
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <h2 id={titleId} className="text-base font-semibold text-text">
            {t(title)}
          </h2>
          <IconButton icon="close" label="Kapat" onClick={onClose} className="-mr-2" />
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
        {footer ? (
          <div className="flex gap-2 border-t border-border px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
