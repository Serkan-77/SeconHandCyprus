// Same-origin redirect targets (P1-03).
//
// A user-supplied "returnTo"/"next" value may only ever point at a path on
// this site. The old check (starts with "/" and not "//") let "/\evil.com"
// through: URL parsers treat "\" like "/", so the browser went to evil.com.

const BASE = "http://same-origin.invalid";

/**
 * Returns `value` when it is a plain internal path such as "/ilanlar?q=x",
 * otherwise `fallback`. Rejects scheme-relative ("//x"), backslashes, control
 * characters, absolute URLs and their percent-encoded or double-encoded forms.
 */
export function safeInternalPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) return fallback;

  // Check the raw value and up to two rounds of percent-decoding, so "%5c",
  // "%2f%2f" and "%255c" cannot smuggle a backslash or "//" past the checks.
  const variants = [value];
  for (let i = 0; i < 2; i++) {
    try {
      const decoded = decodeURIComponent(variants[variants.length - 1]);
      if (decoded === variants[variants.length - 1]) break;
      variants.push(decoded);
    } catch {
      return fallback;
    }
  }
  for (const v of variants) {
    if (!v.startsWith("/") || v.startsWith("//")) return fallback;
    if (v.includes("\\")) return fallback;
    if (/[\u0000-\u001f\u007f]/.test(v)) return fallback;
  }

  // Final word from a real URL parser: the target must stay on this origin.
  try {
    const url = new URL(value, BASE);
    if (url.origin !== BASE) return fallback;
  } catch {
    return fallback;
  }
  return value;
}
