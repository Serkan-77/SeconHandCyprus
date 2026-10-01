import { NextResponse, type NextRequest } from "next/server";
import { safeInternalPath } from "@/lib/safeRedirect";
import { buildCsp, createNonce } from "@/lib/csp";
import { adsEnabled } from "@/lib/ads";
import { AUTH_METHODS, SITE, WS_URL } from "@/lib/site";

// Runs before every page. It:
//  1. builds a per-request CSP with a fresh nonce;
//  2. keeps the session fresh: when the short-lived access cookie is missing
//     or about to expire and a refresh cookie exists, it asks the API for new
//     tokens before rendering, so server components see a valid session and
//     the browser receives the rotated cookies with this response;
//  3. sends signed-out visitors of account pages to sign-in.
// Authorization itself happens in the API; this only picks what to render.

const API = (process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4000").replace(/\/$/, "");
const INTERNAL_TOKEN = process.env.INTERNAL_API_TOKEN ?? "";
const PROTECTED = ["/hesabim", "/mesajlar", "/ilan-ver", "/kurulum", "/yonetim"];
const REFRESH_MARGIN_SECONDS = 60;

/** Seconds until the JWT expires (read only, not verified: the API verifies). */
function secondsLeft(token: string | undefined) {
  if (!token) return -1;
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp === "number" ? payload.exp - Date.now() / 1000 : -1;
  } catch {
    return -1;
  }
}

type SetCookie = { name: string; value: string; maxAge: number };

function parseSetCookies(res: Response): SetCookie[] {
  return res.headers.getSetCookie().map((line) => {
    const [pair, ...attrs] = line.split(";");
    const eq = pair.indexOf("=");
    const maxAge = attrs.map((a) => a.trim()).find((a) => a.toLowerCase().startsWith("max-age="));
    return {
      name: pair.slice(0, eq).trim(),
      value: decodeURIComponent(pair.slice(eq + 1).trim()),
      maxAge: maxAge ? Number(maxAge.split("=")[1]) : 0,
    };
  });
}

async function refresh(request: NextRequest): Promise<SetCookie[] | null> {
  const rt = request.cookies.get("kie_rt")?.value;
  if (!rt) return null;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  try {
    const res = await fetch(`${API}/api/v1/auth/refresh`, {
      method: "POST",
      headers: {
        cookie: `kie_rt=${rt}`,
        "x-kie-csrf": "1",
        ...(INTERNAL_TOKEN && ip ? { "x-kie-internal": INTERNAL_TOKEN, "x-kie-client-ip": ip } : {}),
      },
      cache: "no-store",
    });
    return parseSetCookies(res);
  } catch {
    // API unreachable: render as signed out for this request; the cookie stays.
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const nonce = createNonce();
  const csp = buildCsp({
    nonce,
    dev: process.env.NODE_ENV === "development",
    https: SITE.url.startsWith("https://"),
    ads: adsEnabled,
    connect: WS_URL ? [WS_URL] : [],
    googleSignIn: AUTH_METHODS.google,
  });

  let refreshed: SetCookie[] | null = null;
  const access = request.cookies.get("kie_at")?.value;
  if (request.cookies.has("kie_rt") && secondsLeft(access) < REFRESH_MARGIN_SECONDS) {
    refreshed = await refresh(request);
    for (const c of refreshed ?? []) {
      if (c.value && c.maxAge > 0) request.cookies.set(c.name, c.value);
      else request.cookies.delete(c.name);
    }
  }

  const signedIn = request.cookies.has("kie_at");
  const { pathname, search } = request.nextUrl;
  const isAdminLogin = pathname === "/yonetim/giris";
  const needsAuth = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`)) && !isAdminLogin;

  let response: NextResponse;
  if (!signedIn && needsAuth) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.startsWith("/yonetim") ? "/yonetim/giris" : "/giris";
    url.search = `?returnTo=${encodeURIComponent(pathname + search)}`;
    response = NextResponse.redirect(url);
  } else if (signedIn && (pathname === "/giris" || pathname === "/kayit")) {
    const target = safeInternalPath(request.nextUrl.searchParams.get("returnTo"));
    response = NextResponse.redirect(new URL(target, request.url));
  } else {
    // Next.js takes the nonce from the request's CSP header while rendering.
    const headers = new Headers(request.headers);
    headers.set("x-nonce", nonce);
    headers.set("Content-Security-Policy", csp);
    response = NextResponse.next({ request: { headers } });
  }

  for (const c of refreshed ?? []) {
    response.cookies.set(c.name, c.value, {
      httpOnly: true,
      secure: SITE.url.startsWith("https://"),
      sameSite: "lax",
      path: "/",
      maxAge: c.value ? c.maxAge : 0,
    });
  }
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: ["/((?!api/|media/|_next/static|_next/image|favicon.ico|images/|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)"],
};
