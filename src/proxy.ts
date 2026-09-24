import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/env";

const PROTECTED = ["/hesabim", "/mesajlar", "/ilan-ver", "/kurulum", "/yonetim"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!isSupabaseConfigured) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
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
    const target = request.nextUrl.searchParams.get("returnTo");
    return NextResponse.redirect(new URL(target?.startsWith("/") && !target.startsWith("//") ? target : "/", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images/|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
