// Environment validation (P1-12). No "@/" imports: used by site.ts and tested
// directly with node --test.
//
// In production a missing or malformed value must stop the build/server
// instead of silently rendering wrong canonical URLs. Secrets must never sit
// in NEXT_PUBLIC_ variables: those are shipped to every browser.

export type PublicEnv = {
  NEXT_PUBLIC_SITE_URL?: string;
  NEXT_PUBLIC_WS_URL?: string;
  [key: string]: string | undefined;
};

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function parse(value: string | undefined) {
  try {
    return value ? new URL(value) : null;
  } catch {
    return null;
  }
}

/** Looks like a server-only secret: a Supabase secret/service key or one of our own secrets' names. */
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

const SECRET_NAME = /SECRET|PASSWORD|PRIVATE|INTERNAL_API_TOKEN|JWT|SMTP_/;

/** Every problem with the public environment, as human-readable lines (never the values). */
export function publicEnvProblems(env: PublicEnv): string[] {
  const problems: string[] = [];
  const site = parse(env.NEXT_PUBLIC_SITE_URL);
  if (!env.NEXT_PUBLIC_SITE_URL) problems.push("NEXT_PUBLIC_SITE_URL tanımlı değil");
  else if (!site || !["http:", "https:"].includes(site.protocol)) problems.push("NEXT_PUBLIC_SITE_URL geçerli bir http(s) adresi değil");
  else if (site.protocol === "http:" && !LOCAL_HOSTS.has(site.hostname)) problems.push("NEXT_PUBLIC_SITE_URL localhost dışında https olmalı");
  else if (site.pathname !== "/" || site.search || site.hash) problems.push("NEXT_PUBLIC_SITE_URL yalnızca origin olmalı (yol, sorgu, # olmadan)");

  if (env.NEXT_PUBLIC_WS_URL) {
    const ws = parse(env.NEXT_PUBLIC_WS_URL);
    if (!ws || !["ws:", "wss:"].includes(ws.protocol)) problems.push("NEXT_PUBLIC_WS_URL geçerli bir ws(s) adresi değil");
  }

  for (const [name, value] of Object.entries(env)) {
    if (!name.startsWith("NEXT_PUBLIC_") || !value) continue;
    if (SECRET_NAME.test(name) || looksLikeSecretKey(value)) {
      problems.push(`${name} gizli bir anahtar gibi görünüyor; NEXT_PUBLIC_ değişkenleri tarayıcıya gönderilir`);
    }
  }
  return problems;
}

/**
 * Throws in production when the public environment is incomplete or invalid.
 * Outside production only a secret in a public variable is fatal.
 */
export function assertPublicEnv(env: PublicEnv, production: boolean) {
  const problems = publicEnvProblems(env);
  const fatal = production ? problems : problems.filter((p) => p.includes("gizli"));
  if (fatal.length) {
    throw new Error(`Ortam değişkenleri hatalı:\n- ${fatal.join("\n- ")}`);
  }
}
