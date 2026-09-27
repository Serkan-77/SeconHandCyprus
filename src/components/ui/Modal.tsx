"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { IconButton } from "@/components/ui/IconButton";

export function Modal({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);
  // Callers pass inline arrow functions, so onClose changes on every render.
  // Keeping it out of the effect's dependencies stops each keystroke in a
  // controlled field from re-running the effect and stealing focus.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    lastFocused.current = document.activeElement as HTMLElement;
    panelRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      lastFocused.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#0d0f12]/40 sm:items-center"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[92vh] w-full flex-col gap-5 overflow-auto rounded-t-sheet bg-surface p-6 outline-none sm:max-w-lg sm:rounded-2xl"
      >
        <div className="mx-auto -mt-1 mb-1 h-1 w-9 rounded-full bg-border sm:hidden" />
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-text">{title}</h2>
          <IconButton icon="close" label="Kapat" onClick={onClose} />
        </div>
        {children}
      </div>
    </div>
  );
}
