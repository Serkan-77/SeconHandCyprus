"use client";
import * as I18n from "@/components/i18n/Localized";


import { useSyncExternalStore } from "react";
import { Icon } from "@/components/icons";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

function getServerSnapshot() {
  return true;
}

export function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (online) return null;

  return (
    <I18n.div className="flex items-center justify-center gap-2 bg-text px-4 py-2.5 text-center text-xs text-surface">
      <Icon name="wifi" className="h-4 w-4 flex-shrink-0" />
      Bağlantın yok. Bazı içerikler güncel olmayabilir.
    </I18n.div>
  );
}
