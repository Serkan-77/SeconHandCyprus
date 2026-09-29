import messages from './en.json' with { type: 'json' };

export type Locale = 'tr' | 'en';
export const LOCALE_COOKIE = 'kie-locale';
export function parseLocale(value: string | undefined | null): Locale {
  return value === 'en' ? 'en' : 'tr';
}

const dictionary: Record<string, string> = messages;
const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
const patterns = Object.entries(dictionary).filter(([key]) => /\{\d+\}/.test(key)).map(([key, value]) => {
  const slots: string[] = [];
  const escaped = key.split(/(\{\d+\})/).map(part => {
    if (/^\{\d+\}$/.test(part)) { slots.push(part); return '(.+?)'; }
    return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('');
  return { regex: new RegExp(`^${escaped}$`), value, slots, fieldLabel: ['{0} boş olamaz.', '{0} en az {1} karakter olmalı.', '{0} ilanları'].includes(key) };
});

/** Source-language keys keep server actions and stored enum values stable. */
export function translate(value: string, locale: Locale): string {
  if (locale === 'tr' || !value.trim()) return value;
  const key = normalize(value);
  let result = Object.hasOwn(dictionary, key) ? dictionary[key] : undefined;
  // Multiple delivery options are stored as stable enum labels joined by commas.
  if (result === undefined && key.includes(', ')) {
    const parts = key.split(', ');
    if (parts.every(part => Object.hasOwn(dictionary, part))) result = parts.map(part => dictionary[part]).join(', ');
  }
  if (result === undefined) {
    for (const pattern of patterns) {
      const match = pattern.regex.exec(key);
      if (match) {
        result = pattern.value.replace(/\{\d+\}/g, slot => {
          const captured = match[pattern.slots.indexOf(slot) + 1] ?? slot;
          // Validation templates interpolate UI field labels, not user content.
          return slot === '{0}' && pattern.fieldLabel
            ? (Object.hasOwn(dictionary, captured) ? dictionary[captured] : captured)
            : captured;
        });
        break;
      }
    }
  }
  if (result === undefined) return value;
  return `${value.match(/^\s*/)?.[0] ?? ''}${result}${value.match(/\s*$/)?.[0] ?? ''}`;
}
