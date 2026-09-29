"use client";

import { useSyncExternalStore } from "react";
import { Icon } from "@/components/icons";
import { useLocale } from "@/components/i18n/LocaleProvider";

const media = () => window.matchMedia("(prefers-color-scheme: dark)");

function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  const mq = media();
  mq.addEventListener("change", callback);
  return () => {
    observer.disconnect();
    mq.removeEventListener("change", callback);
  };
}

function getSnapshot() {
  const cls = document.documentElement.classList;
  if (cls.contains("dark")) return true;
  if (cls.contains("light")) return false;
  return media().matches;
}

function getServerSnapshot() {
  return false;
}

export function ThemeToggle({ className, compact = false }: { className?: string; compact?: boolean }) {
  const isDark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const { t } = useLocale();
  const label = t(isDark ? "Açık görünüme geç" : "Koyu görünüme geç");

  function toggle() {
    const next = isDark ? "light" : "dark";
    const cls = document.documentElement.classList;
    cls.remove("dark", "light");
    cls.add(next);
    document.cookie = `theme=${next}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      data-testid="theme-toggle"
      className={
        className ?? (compact ? "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-text transition hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" :
        "inline-flex min-h-11 items-center gap-2 text-[13px] font-medium text-muted hover:text-text"
        )
      }
    >
      <Icon name={isDark ? "sun" : "moon"} className="h-4 w-4" />
      {compact ? null : t(isDark ? "Açık görünüm" : "Koyu görünüm")}
    </button>
  );
}
