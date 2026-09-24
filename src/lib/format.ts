const priceFormatter = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });

export function formatPrice(price: number | string, currency: string) {
  return `${priceFormatter.format(Number(price))} ${currency}`;
}

export function formatNumber(value: number) {
  return priceFormatter.format(value);
}

export function initials(name: string | null | undefined) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toLocaleUpperCase("tr-TR");
}

const DAY = 24 * 60 * 60 * 1000;

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** "Bugün", "Dün", "3 gün önce" or "12 Eyl" for listing cards. */
export function relativeDay(value: string | Date) {
  const date = new Date(value);
  const diff = Math.round((startOfDay(new Date()) - startOfDay(date)) / DAY);
  if (diff <= 0) return "Bugün";
  if (diff === 1) return "Dün";
  if (diff < 7) return `${diff} gün önce`;
  return date.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

/** "Şimdi", "5 dk önce", "2 saat önce", "Dün", "3 gün önce", "12 Eyl 2026". */
export function timeAgo(value: string | Date) {
  const date = new Date(value);
  const seconds = Math.max(0, (Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "Şimdi";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} dk önce`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} saat önce`;
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / DAY);
  if (days === 1) return "Dün";
  if (days < 7) return `${days} gün önce`;
  return formatDate(date);
}

/** Short label for chat lists: "14:32", "Dün", "Pzt", "12 Eyl". */
export function chatTime(value: string | Date) {
  const date = new Date(value);
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / DAY);
  if (days <= 0) return date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  if (days === 1) return "Dün";
  if (days < 7) return date.toLocaleDateString("tr-TR", { weekday: "short" });
  return date.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

export function clockTime(value: string | Date) {
  return new Date(value).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
}

export function formatLongDate(value: string | Date) {
  return new Date(value).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
}

export function monthYear(value: string | Date) {
  return new Date(value).toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
}

// Turkish ablative suffix for a year read aloud: 2023'ten, 2026'dan, 2022'den.
const lastDigitSuffix: Record<string, string> = {
  "1": "den", "2": "den", "3": "ten", "4": "ten", "5": "ten",
  "6": "dan", "7": "den", "8": "den", "9": "dan",
};
const tensSuffix: Record<string, string> = {
  "1": "dan", "2": "den", "3": "dan", "4": "tan", "5": "den",
  "6": "tan", "7": "ten", "8": "den", "9": "dan", "0": "den",
};

export function memberSince(value: string | Date) {
  const year = String(new Date(value).getFullYear());
  const last = year[3];
  const suffix = last === "0" ? tensSuffix[year[2]] : lastDigitSuffix[last];
  return `${year}'${suffix} beri üye`;
}

export function ratingLabel(avg: number, count: number) {
  if (count === 0) return "Henüz değerlendirme yok";
  return `★ ${avg.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} (${count} değerlendirme)`;
}
