import { NextResponse, type NextRequest } from "next/server";

// Supabase e-mail links (verification, password reset) pointed here. After
// the move to our own authentication they can no longer be completed; send
// the person to sign in with a clear note instead of an error page.
export function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next") ?? "";
  const url = request.nextUrl.clone();
  url.search = "";
  if (next.startsWith("/yeni-sifre")) {
    url.pathname = "/sifre-yenile";
  } else {
    url.pathname = "/giris";
    url.searchParams.set("hata", "baglanti");
  }
  return NextResponse.redirect(url);
}
