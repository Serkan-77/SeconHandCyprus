// Public environment validation (P1-12). No "@/" imports: used by env.ts and
// site.ts and tested directly with node --test.
//
// In production a missing or malformed value must stop the build/server
// instead of silently rendering an empty site or wrong canonical URLs. In
// development the old "no Supabase configured" mode keeps working. A secret
// Supabase key in a NEXT_PUBLIC_ variable is refused everywhere: it would be
// shipped to every browser.

export type PublicEnv = {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  NEXT_PUBLIC_SITE_URL?: string;
};

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function parse(value: string | undefined) {
  try {
    return value ? new URL(value) : null;
  } catch {
    return null;
  }
}

/** Looks like a server-only key: the new sb_secret_ format or a legacy service_role JWT. */
export function looksLikeSecretKey(key: string | undefined) {
  if (!key) return false;
  if (key.startsWith("sb_secret_")) return true;
  const payload = key.split(".")[1];
  if (!payload) return false;
  try {
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))).role === "service_role";
  } catch {
    return false;
  }
}

/** Every problem with the public environment, as human-readable lines (never the values). */
export function publicEnvProblems(env: PublicEnv): string[] {
  const problems: string[] = [];
  const supabase = parse(env.NEXT_PUBLIC_SUPABASE_URL);
  if (!env.NEXT_PUBLIC_SUPABASE_URL) problems.push("NEXT_PUBLIC_SUPABASE_URL tanımlı değil");
  else if (!supabase || supabase.protocol !== "https:") problems.push("NEXT_PUBLIC_SUPABASE_URL geçerli bir https adresi değil");

  if (!env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) problems.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY tanımlı değil");
  else if (looksLikeSecretKey(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)) {
    problems.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY gizli (secret/service_role) bir anahtar gibi görünüyor");
  }

  const site = parse(env.NEXT_PUBLIC_SITE_URL);
  if (!env.NEXT_PUBLIC_SITE_URL) problems.push("NEXT_PUBLIC_SITE_URL tanımlı değil");
  else if (!site || !["http:", "https:"].includes(site.protocol)) problems.push("NEXT_PUBLIC_SITE_URL geçerli bir http(s) adresi değil");
  else if (site.protocol === "http:" && !LOCAL_HOSTS.has(site.hostname)) problems.push("NEXT_PUBLIC_SITE_URL localhost dışında https olmalı");
  else if (site.pathname !== "/" || site.search || site.hash) problems.push("NEXT_PUBLIC_SITE_URL yalnızca origin olmalı (yol, sorgu, # olmadan)");
  return problems;
}

/**
 * Throws in production when the public environment is incomplete or invalid.
 * Outside production only a secret key in a public variable is fatal.
 */
export function assertPublicEnv(env: PublicEnv, production: boolean) {
  const problems = publicEnvProblems(env);
  const fatal = production ? problems : problems.filter((p) => p.includes("gizli"));
  if (fatal.length) {
    throw new Error(`Ortam değişkenleri hatalı:\n- ${fatal.join("\n- ")}`);
  }
}
