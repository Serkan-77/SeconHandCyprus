"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { safeInternalPath } from "@/lib/safeRedirect";
import { absoluteUrl } from "@/lib/site";

export type FormState =
  | { error?: string; ok?: boolean; message?: string; email?: string; values?: Record<string, string> }
  | undefined;

// Links in auth e-mails and the OAuth return URL are built from the configured
// site URL (NEXT_PUBLIC_SITE_URL), never from the request's Host or
// X-Forwarded-Host headers, which a client can forge (P1-04).
function authCallbackUrl(next: string) {
  return absoluteUrl(`/auth/callback?next=${encodeURIComponent(next)}`);
}

function safeReturnTo(value: FormDataEntryValue | null) {
  return safeInternalPath(value);
}

type AuthErrorLike = { message: string; code?: string; reasons?: string[] };

// Supabase error codes first (stable), message text only as a fallback. The
// raw error is logged so an unexpected one shows up in the server logs.
function translateAuthError(error: AuthErrorLike) {
  const code = error.code ?? "";
  const m = error.message.toLowerCase();
  if (code === "same_password" || m.includes("different from the old")) return "Yeni şifre eskisiyle aynı olamaz. Farklı bir şifre seç.";
  if (code === "weak_password") {
    const reasons = error.reasons ?? [];
    if (reasons.includes("pwned")) return "Bu şifre sızdırılmış şifre listelerinde geçiyor. Daha güçlü bir şifre seç.";
    if (reasons.includes("characters")) return "Şifre büyük harf, küçük harf, rakam ve sembol içermeli.";
    return "Şifre en az 8 karakter olmalı.";
  }
  if (code === "invalid_credentials" || m.includes("invalid login")) return "E-posta ya da şifre hatalı.";
  if (code === "email_not_confirmed" || m.includes("email not confirmed"))
    return "E-posta adresin henüz doğrulanmadı. Gelen kutundaki doğrulama bağlantısına tıkla.";
  if (code === "user_already_exists" || code === "email_exists" || m.includes("already registered"))
    return "Bu e-posta ile kayıtlı bir hesap zaten var. Giriş yap ya da şifreni sıfırla.";
  if (code === "user_banned") return "Bu hesap askıya alınmış. Destek ile iletişime geç.";
  if (code === "email_address_invalid" || m.includes("email address") && m.includes("invalid")) return "Geçerli bir e-posta adresi gir.";
  if (code === "session_not_found" || code === "session_expired" || m.includes("auth session missing"))
    return "Oturumun sona ermiş. Şifre sıfırlama bağlantısını yeniden iste.";
  if (code === "reauthentication_needed") return "Güvenlik için tekrar giriş yapıp yeniden dene.";
  if (code.startsWith("over_") || m.includes("rate limit")) return "Çok fazla deneme yaptın. Birkaç dakika sonra tekrar dene.";
  if (code === "phone_provider_disabled" || (m.includes("phone") && m.includes("provider")))
    return "Telefonla giriş şu anda kullanılamıyor. E-posta ile giriş yap.";
  if (m.includes("sms")) return "SMS gönderilemedi. Telefonla giriş şu anda kullanılamıyor.";
  if (code === "otp_expired" || m.includes("token has expired")) return "Kodun süresi doldu ya da hatalı.";
  if (m.includes("password should be")) return "Şifre en az 8 karakter olmalı.";
  console.error("[auth] unhandled error", code, error.message);
  return "Bir sorun oluştu. Lütfen tekrar dene.";
}

export async function signIn(_: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password: String(formData.get("password") ?? "") });
  // The e-mail comes back so the form can keep it after React resets the inputs.
  if (error) return { error: translateAuthError(error), email };
  redirect(safeReturnTo(formData.get("returnTo")));
}

export async function signInWithGoogle(formData: FormData) {
  const returnTo = safeReturnTo(formData.get("returnTo"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: authCallbackUrl(returnTo) },
  });
  if (error || !data.url) redirect("/giris?hata=google");
  redirect(data.url);
}

export async function signInWithPhone(_: FormState, formData: FormData): Promise<FormState> {
  const phone = String(formData.get("phone") ?? "").replace(/\s/g, "");
  if (!/^\+?\d{10,15}$/.test(phone)) return { error: "Geçerli bir telefon numarası gir." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ phone, options: { shouldCreateUser: false } });
  if (error) return { error: translateAuthError(error) };
  redirect(`/telefon-dogrula?tel=${encodeURIComponent(phone)}`);
}

export async function verifyPhoneOtp(_: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    phone: String(formData.get("phone") ?? ""),
    token: String(formData.get("token") ?? ""),
    type: "sms",
  });
  if (error) return { error: translateAuthError(error) };
  redirect("/");
}

export async function signUp(_: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").replace(/\s/g, "");
  const values = { name: displayName, email, phone };
  if (password.length < 8) return { error: "Şifre en az 8 karakter olmalı.", values };
  if (displayName.length < 2) return { error: "Adını gir.", values };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName, phone, marketing: formData.get("marketing") === "on" },
      emailRedirectTo: authCallbackUrl("/kurulum"),
    },
  });
  if (error) return { error: translateAuthError(error), values };
  // Supabase returns a user with no identities when the e-mail already exists.
  if (data.user && data.user.identities?.length === 0) {
    return { error: "Bu e-posta ile kayıtlı bir hesap zaten var. Giriş yap ya da şifreni sıfırla.", values };
  }
  if (data.session) redirect("/kurulum");
  return { ok: true, email };
}

export async function requestPasswordReset(_: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: authCallbackUrl("/yeni-sifre"),
  });
  if (error) return { error: translateAuthError(error), email };
  return { ok: true, email };
}

export async function updatePassword(_: FormState, formData: FormData): Promise<FormState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("password2") ?? "");
  if (password.length < 8) return { error: "Şifre en az 8 karakter olmalı." };
  if (password !== confirm) return { error: "Şifreler birbiriyle eşleşmiyor." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: translateAuthError(error) };
  return { ok: true };
}

export async function resendEmailVerification(): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "Oturum bulunamadı." };
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: user.email,
    options: { emailRedirectTo: authCallbackUrl("/hesabim/dogrulama") },
  });
  if (error) return { error: translateAuthError(error) };
  return { ok: true, email: user.email };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  refresh();
  redirect("/");
}
