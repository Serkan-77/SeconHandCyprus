"use client";

import { Icon } from '@/components/icons';
import { useLocale } from '@/components/i18n/LocaleProvider';

export function LanguageToggle() {
  const { locale, setLocale } = useLocale();
  const label = locale === 'tr' ? 'Switch to English' : 'Türkçeye geç';
  return (
    <button type="button" onClick={() => setLocale(locale === 'tr' ? 'en' : 'tr')}
      aria-label={label} title={label} data-testid="language-toggle"
      className="inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-text transition hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
      <Icon name="globe" className="h-4 w-4" />
      <span lang={locale === 'tr' ? 'en' : 'tr'}>{locale === 'tr' ? 'EN' : 'TR'}</span>
    </button>
  );
}
