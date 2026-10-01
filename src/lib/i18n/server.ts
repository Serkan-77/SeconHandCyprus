import "server-only";
// Translation for server components: the page is rendered in the visitor's
// language as plain HTML (no client component per string). The language
// toggle refreshes the route, so server-rendered text follows the switch.
import { cache } from "react";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, parseLocale, translate, type Locale } from "./translate";
import { formatLocalized, type FormatKind } from "./format";

export const getLocale = cache(async (): Promise<Locale> => parseLocale((await cookies()).get(LOCALE_COOKIE)?.value));

export async function getI18n() {
  const locale = await getLocale();
  return {
    locale,
    t: (text: string) => translate(text, locale),
    f: (kind: FormatKind, ...args: (string | number | Date)[]) => formatLocalized(kind, args, locale),
    /** A category/attribute label in the visitor's language. */
    name: (item: { name?: string; label?: string; nameEn?: string | null; labelEn?: string | null }) =>
      locale === "en" ? (item.nameEn ?? item.labelEn ?? item.name ?? item.label ?? "") : (item.name ?? item.label ?? ""),
  };
}
