// Content-Security-Policy for HTML responses (P1-15), built per request in
// src/proxy.ts with a fresh nonce. Next.js reads the nonce from the request's
// CSP header and attaches it to its own scripts.
//
// - Scripts: only nonce'd scripts and what they load ('strict-dynamic'), no
//   'unsafe-inline'. 'unsafe-eval' in development only (React dev stacks).
//   JSON-LD is a data block, not executed, so it needs no nonce.
// - Styles: 'unsafe-inline' is kept because the UI uses React style
//   attributes, which a nonce cannot cover.
// - API and realtime are same-origin (/api/v1, /api/v1/ws). A separate
//   realtime origin (development: the API on :4000) is added explicitly.
// - Images: own /media, data:/blob: previews, Google profile photos.
// - AdSense hosts only when ads are enabled (including Google's consent
//   message host for EEA/UK visitors).

export type CspOptions = {
  nonce: string;
  dev: boolean;
  https: boolean;
  ads: boolean;
  /** Extra connect-src origins, e.g. ws://localhost:4000 in development. */
  connect?: string[];
  /** Google sign-in redirects through a form post. */
  googleSignIn?: boolean;
};

const ADSENSE = {
  script: [
    "https://pagead2.googlesyndication.com",
    "https://*.googlesyndication.com",
    "https://*.adtrafficquality.google",
    "https://fundingchoicesmessages.google.com",
  ],
  frame: [
    "https://googleads.g.doubleclick.net",
    "https://tpc.googlesyndication.com",
    "https://*.googlesyndication.com",
    "https://www.google.com",
    "https://fundingchoicesmessages.google.com",
  ],
  connect: [
    "https://*.googlesyndication.com",
    "https://*.doubleclick.net",
    "https://*.adtrafficquality.google",
    "https://fundingchoicesmessages.google.com",
  ],
  img: ["https://*.googlesyndication.com", "https://*.doubleclick.net", "https://*.google.com", "https://*.gstatic.com"],
};

function origin(url: string) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "";
  }
}

export function buildCsp({ nonce, dev, https, ads, connect = [], googleSignIn = false }: CspOptions): string {
  const list = (...items: (string | false | undefined)[]) => items.filter(Boolean).join(" ");
  const extraConnect = connect.map(origin).filter(Boolean);

  const directives: [string, string][] = [
    ["default-src", "'self'"],
    ["script-src", list("'self'", `'nonce-${nonce}'`, "'strict-dynamic'", dev && "'unsafe-eval'", ...(ads ? ADSENSE.script : []))],
    ["style-src", "'self' 'unsafe-inline'"],
    ["img-src", list("'self'", "data:", "blob:", "https://lh3.googleusercontent.com", ...(ads ? ADSENSE.img : []))],
    ["font-src", "'self' data:"],
    ["connect-src", list("'self'", ...extraConnect, ...(ads ? ADSENSE.connect : []))],
    ["frame-src", ads ? ADSENSE.frame.join(" ") : "'none'"],
    ["object-src", "'none'"],
    ["base-uri", "'self'"],
    ["form-action", list("'self'", googleSignIn && "https://accounts.google.com")],
    ["frame-ancestors", "'none'"],
    ["manifest-src", "'self'"],
    ["worker-src", "'self' blob:"],
  ];
  const policy = directives.map(([name, value]) => `${name} ${value}`);
  if (https) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}

/** 128 bits from the Web Crypto API (available in the proxy runtime). */
export function createNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}
