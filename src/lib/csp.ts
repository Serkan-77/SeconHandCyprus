// Content-Security-Policy for HTML responses (P1-15), built per request in
// src/proxy.ts with a fresh nonce. Next.js reads the nonce from the request's
// CSP header and attaches it to its own scripts; every HTML page is rendered
// dynamically (the root layout reads cookies), so each page gets its nonce.
//
// - Scripts: only nonce'd scripts and what they load ('strict-dynamic'), no
//   'unsafe-inline'. 'unsafe-eval' is added in development only (React uses
//   eval for dev error stacks). JSON-LD <script type="application/ld+json">
//   is a data block, not executed, so it needs no nonce.
// - Styles: 'unsafe-inline' is kept because the UI uses React style
//   attributes, which a nonce cannot cover.
// - Supabase: REST/Auth/Storage over https and Realtime over wss.
// - Google OAuth: a no-JS form post is redirected to Supabase and then to
//   accounts.google.com, and Chrome applies form-action to that chain.
// - AdSense hosts are only added when ads are enabled (not yet).

export type CspOptions = {
  nonce: string;
  supabaseUrl: string;
  dev: boolean;
  https: boolean;
  ads: boolean;
};

const ADSENSE = {
  script: ["https://pagead2.googlesyndication.com", "https://*.googlesyndication.com", "https://*.adtrafficquality.google"],
  frame: ["https://googleads.g.doubleclick.net", "https://tpc.googlesyndication.com", "https://*.googlesyndication.com", "https://www.google.com"],
  connect: ["https://*.googlesyndication.com", "https://*.doubleclick.net", "https://*.adtrafficquality.google"],
  img: ["https://*.googlesyndication.com", "https://*.doubleclick.net", "https://*.google.com", "https://*.gstatic.com"],
};

function origin(url: string) {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

export function buildCsp({ nonce, supabaseUrl, dev, https, ads }: CspOptions): string {
  const supabase = origin(supabaseUrl);
  const supabaseWs = supabase.replace(/^http/, "ws");
  const list = (...items: (string | false | undefined)[]) => items.filter(Boolean).join(" ");

  const directives: [string, string][] = [
    ["default-src", "'self'"],
    ["script-src", list("'self'", `'nonce-${nonce}'`, "'strict-dynamic'", dev && "'unsafe-eval'", ...(ads ? ADSENSE.script : []))],
    ["style-src", "'self' 'unsafe-inline'"],
    ["img-src", list("'self'", "data:", "blob:", supabase, "https://lh3.googleusercontent.com", ...(ads ? ADSENSE.img : []))],
    ["font-src", "'self' data:"],
    ["connect-src", list("'self'", supabase, supabaseWs, ...(ads ? ADSENSE.connect : []))],
    ["frame-src", ads ? ADSENSE.frame.join(" ") : "'none'"],
    ["object-src", "'none'"],
    ["base-uri", "'self'"],
    ["form-action", list("'self'", supabase, "https://accounts.google.com")],
    ["frame-ancestors", "'none'"],
    ["manifest-src", "'self'"],
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
