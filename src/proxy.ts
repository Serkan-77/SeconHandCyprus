import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/env";
import { safeInternalPath } from "@/lib/safeRedirect";
import { buildCsp, createNonce } from "@/lib/csp";
import { adsEnabled } from "@/lib/ads";
import { SITE } from "@/lib/site";

const PROTECTED = ["/hesabim", "/mesajlar", "/ilan-ver", "/kurulum", "/yonetim"];

export async function proxy(request: NextRequest) {
  const nonce = createNonce();
  const csp = buildCsp({
    nonce,
    supabaseUrl: SUPABASE_URL,
    dev: process.env.NODE_ENV === "development",
    https: SITE.url.startsWith("https://"),
    ads: adsEnabled,
  });

  // Next.js takes the nonce from the request's CSP header while rendering.
  const forward = () => {
    const headers = new Headers(request.headers);
    headers.set("x-nonce", nonce);
    headers.set("Content-Security-Policy", csp);
    return NextResponse.next({ request: { headers } });
  };
  const withCsp = (res: NextResponse) => {
    res.headers.set("Content-Security-Policy", csp);
    return res;
  };

  let response = forward();
  if (!isSupabaseConfigured) return withCsp(response);

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = forward();
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Refreshes the session cookie when needed. Do not put code between
  // client creation and this call.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;
  const isAdminLogin = pathname === "/yonetim/giris";
  const needsAuth = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`)) && !isAdminLogin;

  if (!user && needsAuth) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.startsWith("/yonetim") ? "/yonetim/giris" : "/giris-gerekli";
    url.search = `?returnTo=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  if (user && (pathname === "/giris" || pathname === "/kayit")) {
    const target = safeInternalPath(request.nextUrl.searchParams.get("returnTo"));
    return NextResponse.redirect(new URL(target, request.url));
  }

  return withCsp(response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images/|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
