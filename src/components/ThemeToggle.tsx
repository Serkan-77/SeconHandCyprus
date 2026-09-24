"use client";

import { useSyncExternalStore } from "react";
import { Icon } from "@/components/icons";

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

export function ThemeToggle({ className }: { className?: string }) {
  const isDark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

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
      className={
        className ??
        "inline-flex min-h-11 items-center gap-2 text-[13px] font-medium text-muted hover:text-text"
      }
    >
      <Icon name={isDark ? "sun" : "moon"} className="h-4 w-4" />
      {isDark ? "Açık görünüm" : "Koyu görünüm"}
    </button>
  );
}
