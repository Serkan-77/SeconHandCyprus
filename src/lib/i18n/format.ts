import * as original from '../format.ts';
import type { Locale } from './translate.ts';

export type FormatKind = Exclude<keyof typeof original, 'initials'> | 'decimal';

/** Keep money in its original currency; only change how numbers and dates are displayed. */
export function formatLocalized(kind: FormatKind, args: (string | number | Date)[], locale: Locale): string {
  if (kind === 'decimal') return Number(args[0]).toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (locale === 'tr') {
    const formatter = original[kind] as (...values: (string | number | Date)[]) => string;
    return formatter(...args);
  }
  const number = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
  if (kind === 'formatNumber') return number.format(Number(args[0]));
  if (kind === 'formatPrice') return `${number.format(Number(args[0]))} ${args[1]}`;
  if (kind === 'ratingLabel') return Number(args[1]) === 0 ? 'No reviews yet' : `★ ${Number(args[0]).toFixed(1)} (${args[1]} ${Number(args[1]) === 1 ? 'review' : 'reviews'})`;
  const date = new Date(args[0]);
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((start(new Date()) - start(date)) / 86400000);
  const format = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', options).format(date);
  switch (kind) {
    case 'memberSince': return `Member since ${date.getFullYear()}`;
    case 'formatDate': return format({ day: 'numeric', month: 'short', year: 'numeric' });
    case 'formatLongDate': return format({ day: 'numeric', month: 'long', year: 'numeric' });
    case 'monthYear': return format({ month: 'long', year: 'numeric' });
    case 'clockTime': return format({ hour: '2-digit', minute: '2-digit', hour12: false });
    case 'chatTime':
      if (days <= 0) return format({ hour: '2-digit', minute: '2-digit', hour12: false });
      if (days === 1) return 'Yesterday';
      return format(days < 7 ? { weekday: 'short' } : { day: 'numeric', month: 'short' });
    case 'relativeDay':
      if (days <= 0) return 'Today';
      if (days === 1) return 'Yesterday';
      if (days < 7) return `${days} days ago`;
      return format({ day: 'numeric', month: 'short' });
    case 'timeAgo': {
      const seconds = Math.max(0, (Date.now() - date.getTime()) / 1000);
      if (seconds < 60) return 'Now';
      if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
      if (seconds < 86400) {
        const hours = Math.floor(seconds / 3600);
        return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
      }
      if (days === 1) return 'Yesterday';
      if (days < 7) return `${days} days ago`;
      return format({ day: 'numeric', month: 'short', year: 'numeric' });
    }
  }
}
