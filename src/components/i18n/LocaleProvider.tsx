"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { LOCALE_COOKIE, translate, type Locale } from '@/lib/i18n/translate';

const LocaleContext = createContext<{ locale: Locale; setLocale: (locale: Locale) => void }>({ locale: 'tr', setLocale: () => {} });

export function LocaleProvider({ initialLocale, children }: { initialLocale: Locale; children: ReactNode }) {
  const [locale, setLocale] = useState(initialLocale);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
  }, [locale]);
  const context = useMemo(() => ({ locale, setLocale }), [locale]);
  return <LocaleContext.Provider value={context}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  return { ...context, t: (value: string) => translate(value, context.locale) };
}
