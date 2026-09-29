"use client";

import { useSyncExternalStore } from "react";
import { LocaleProvider, useLocale } from "@/components/i18n/LocaleProvider";
import { AppearanceControls } from "@/components/AppearanceControls";
import { LOCALE_COOKIE, parseLocale } from "@/lib/i18n/translate";

const subscribe = () => () => {};
const savedLocale = () => parseLocale(document.cookie.split('; ').find(value => value.startsWith(`${LOCALE_COOKIE}=`))?.split('=')[1]);

// Replaces the root layout when it fails, so it cannot use the app's styles.
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const locale = useSyncExternalStore(subscribe, savedLocale, () => 'tr' as const);
  return <LocaleProvider initialLocale={locale} key={locale}><ErrorContent retry={retry} /></LocaleProvider>;
}

function ErrorContent({ retry }: { retry: () => void }) {
  const { locale, t } = useLocale();
  return (
    <html lang={locale}>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
          background: "var(--error-bg, #ffffff)",
          color: "var(--error-text, #111318)",
          padding: 16,
          textAlign: "center",
        }}
      >
        <title>{t("Bir sorun oluştu")}</title>
        <style>{`
          .dark { --error-bg: #181b20; --error-text: #f7f8fa; }
          [data-testid="appearance-controls"] { display: inline-flex; align-items: center; margin-bottom: 24px; gap: 4px; }
          [data-testid="appearance-controls"] button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; min-width: 44px; border: 1px solid #66707e; border-radius: 8px; background: transparent; color: inherit; cursor: pointer; }
          [data-testid="appearance-controls"] svg { width: 16px; height: 16px; }
        `}</style>
        <div style={{ maxWidth: 420 }}>
          <AppearanceControls />
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>{t("Bir şeyler ters gitti.")}</h1>
          <p style={{ fontSize: 14, color: "#5b6170", marginBottom: 24 }}>
            {t("Site şu anda yüklenemedi. Birazdan tekrar dene.")}
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              minHeight: 48,
              padding: "0 24px",
              borderRadius: 12,
              border: 0,
              background: "#111318",
              color: "#fff",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {t("Tekrar dene")}
          </button>
        </div>
      </body>
    </html>
  );
}
