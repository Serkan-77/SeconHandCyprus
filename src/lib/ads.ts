// Google AdSense configuration. Everything stays off until
// NEXT_PUBLIC_ADSENSE_CLIENT (e.g. "ca-pub-1234567890123456") is set.
export const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "";
export const adsEnabled = /^ca-pub-\d{10,20}$/.test(ADSENSE_CLIENT);

/** Ad unit ids from the AdSense dashboard (Ads › By ad unit). */
export const AD_SLOTS = {
  home: process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME ?? "",
  results: process.env.NEXT_PUBLIC_ADSENSE_SLOT_RESULTS ?? "",
  listing: process.env.NEXT_PUBLIC_ADSENSE_SLOT_LISTING ?? "",
} as const;

export type AdPlacement = keyof typeof AD_SLOTS;
