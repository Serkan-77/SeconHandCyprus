"use client";

import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { LOCALE_COOKIE } from "@/lib/i18n/translate";

export function LanguageToggle({ className }: { className?: string }) {
  const { locale, setLocale } = useLocale();
  const router = useRouter();
  const label = locale === "tr" ? "Switch to English" : "Türkçeye geç";
  function toggle() {
    const next = locale === "tr" ? "en" : "tr";
    // Client text switches at once; server-rendered text follows on refresh,
    // which keeps client state (typed input, open panels) intact.
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    setLocale(next);
    router.refresh();
  }
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      data-testid="language-toggle"
      className={
        className ??
        "inline-flex h-10 min-w-10 shrink-0 items-center justify-center gap-1.5 rounded-button px-2.5 text-xs font-semibold text-text transition hover:bg-brand-soft"
      }
    >
      <Icon name="globe" className="h-4 w-4" />
      <span lang={locale === "tr" ? "en" : "tr"}>{locale === "tr" ? "EN" : "TR"}</span>
    </button>
  );
}
