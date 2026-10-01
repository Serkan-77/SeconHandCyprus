"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { cn } from "@/lib/cn";

type Tone = "default" | "success" | "error";
type Toast = { id: number; message: string; tone: Tone; action?: { label: string; onClick: () => void } };

const ToastContext = createContext<{ show: (message: string, opts?: { tone?: Tone; action?: Toast["action"] }) => void }>({
  show: () => {},
});

/** Short, non-blocking confirmations ("Favorilere eklendi"). Announced politely to screen readers. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useLocale();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((x) => x.id !== id)), []);
  const show = useCallback(
    (message: string, opts: { tone?: Tone; action?: Toast["action"] } = {}) => {
      const id = next.current++;
      setToasts((all) => [...all.slice(-2), { id, message, tone: opts.tone ?? "default", action: opts.action }]);
      setTimeout(() => dismiss(id), opts.tone === "error" ? 6000 : 3500);
    },
    [dismiss],
  );
  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(80px+env(safe-area-inset-bottom))] z-[80] flex flex-col items-center gap-2 px-4 lg:bottom-6"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm animate-sheet-in items-center gap-3 rounded-xl px-4 py-3 text-[13px] font-medium shadow-lg",
              toast.tone === "error" ? "bg-danger text-white dark:text-[#1a0a0a]" : "bg-brand text-on-brand",
            )}
          >
            <Icon name={toast.tone === "error" ? "info" : "check"} className="h-4 w-4 flex-shrink-0" />
            <span className="min-w-0 flex-1">{t(toast.message)}</span>
            {toast.action ? (
              <button
                type="button"
                onClick={() => {
                  toast.action!.onClick();
                  dismiss(toast.id);
                }}
                className="flex-shrink-0 font-semibold underline underline-offset-2"
              >
                {t(toast.action.label)}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
