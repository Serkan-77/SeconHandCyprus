"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string; ok?: boolean; message?: string; email?: string } | undefined;

async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function safeReturnTo(value: FormDataEntryValue | null) {
  const path = typeof value === "string" ? value : "";
  return path.startsWith("/") && !path.startsWith("//") ? path : "/";
}

function translateAuthError(message: string) {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "E-posta ya da şifre hatalı.";
  if (m.includes("email not confirmed")) return "E-posta adresin henüz doğrulanmadı. Gelen kutunu kontrol et.";
  if (m.includes("already registered")) return "Bu e-posta ile kayıtlı bir hesap zaten var.";
  if (m.includes("password should be")) return "Şifre en az 8 karakter olmalı.";
  if (m.includes("rate limit")) return "Çok fazla deneme yaptın. Birkaç dakika sonra tekrar dene.";
  if (m.includes("phone") && m.includes("provider")) return "Telefonla giriş şu anda kullanılamıyor. E-posta ile giriş yap.";
  if (m.includes("sms")) return "SMS gönderilemedi. Telefonla giriş şu anda kullanılamıyor.";
  if (m.includes("token has expired") || m.includes("invalid")) return "Kodun süresi doldu ya da hatalı.";
  if (m.includes("same_password") || m.includes("different from the old")) return "Yeni şifre eskisinden farklı olmalı.";
  return "Bir sorun oluştu. Lütfen tekrar dene.";
}

export async function signIn(_: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  });
  if (error) return { error: translateAuthError(error.message) };
  redirect(safeReturnTo(formData.get("returnTo")));
}

export async function signInWithPhone(_: FormState, formData: FormData): Promise<FormState> {
  const phone = String(formData.get("phone") ?? "").replace(/\s/g, "");
  if (!/^\+?\d{10,15}$/.test(phone)) return { error: "Geçerli bir telefon numarası gir." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ phone, options: { shouldCreateUser: false } });
  if (error) return { error: translateAuthError(error.message) };
  redirect(`/telefon-dogrula?tel=${encodeURIComponent(phone)}`);
}

export async function verifyPhoneOtp(_: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    phone: String(formData.get("phone") ?? ""),
    token: String(formData.get("token") ?? ""),
    type: "sms",
  });
  if (error) return { error: translateAuthError(error.message) };
  redirect("/");
}

export async function signUp(_: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").replace(/\s/g, "");
  if (password.length < 8) return { error: "Şifre en az 8 karakter olmalı." };
  if (displayName.length < 2) return { error: "Adını gir." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName, phone, marketing: formData.get("marketing") === "on" },
      emailRedirectTo: `${await siteOrigin()}/auth/callback?next=/kurulum`,
    },
  });
  if (error) return { error: translateAuthError(error.message) };
  // Supabase returns a user with no identities when the e-mail already exists.
  if (data.user && data.user.identities?.length === 0) {
    return { error: "Bu e-posta ile kayıtlı bir hesap zaten var." };
  }
  if (data.session) redirect("/kurulum");
  return { ok: true, email };
}

export async function requestPasswordReset(_: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await siteOrigin()}/auth/callback?next=/yeni-sifre`,
  });
  if (error) return { error: translateAuthError(error.message) };
  return { ok: true, email };
}

export async function updatePassword(_: FormState, formData: FormData): Promise<FormState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("password2") ?? "");
  if (password.length < 8) return { error: "Şifre en az 8 karakter olmalı." };
  if (password !== confirm) return { error: "Şifreler birbiriyle eşleşmiyor." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: translateAuthError(error.message) };
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
    options: { emailRedirectTo: `${await siteOrigin()}/auth/callback?next=/hesabim/dogrulama` },
  });
  if (error) return { error: translateAuthError(error.message) };
  return { ok: true, email: user.email };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  refresh();
  redirect("/");
}
