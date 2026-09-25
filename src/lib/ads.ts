// Google AdSense configuration, in two steps (P1-14):
//
// 1. NEXT_PUBLIC_ADSENSE_CLIENT (e.g. "ca-pub-1234567890123456") only turns on
//    what Google's site review needs: the google-adsense-account meta tag and
//    /ads.txt. No ad script is loaded, so no ad cookies or tracking.
// 2. Ads are served only once NEXT_PUBLIC_ADSENSE_CMP_READY=1 as well: set it
//    after a certified consent message (Google Privacy & messaging, GDPR) is
//    published for the site. Part of the audience is in the EU (Cyprus), and
//    that consent flow lives in the AdSense panel, not in this code.
export const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "";
export const adsenseConfigured = /^ca-pub-\d{10,20}$/.test(ADSENSE_CLIENT);
export const adsEnabled = adsenseConfigured && process.env.NEXT_PUBLIC_ADSENSE_CMP_READY === "1";

/** Ad unit ids from the AdSense dashboard (Ads › By ad unit). */
export const AD_SLOTS = {
  home: process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME ?? "",
  results: process.env.NEXT_PUBLIC_ADSENSE_SLOT_RESULTS ?? "",
  listing: process.env.NEXT_PUBLIC_ADSENSE_SLOT_LISTING ?? "",
} as const;

export type AdPlacement = keyof typeof AD_SLOTS;
