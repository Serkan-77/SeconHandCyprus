// Safety gate for scripts that write to the database (P1-13): seed, e2e,
// security and integration checks create/delete rows and demo accounts
// (including a demo admin) and must never run against production.
//
// All of these must hold:
//   1. ALLOW_DESTRUCTIVE_TESTS=1                  explicit opt-in
//   2. DEV_SUPABASE_PROJECT_REF = the project ref  explicit allowlist of the target
//   3. NEXT_PUBLIC_SITE_URL is localhost          the environment is a local one
//   4. no production marker (NODE_ENV / VERCEL_ENV = production)
// Reasons are printed without any key or password.

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function projectRef(supabaseUrl) {
  try {
    const host = new URL(supabaseUrl).hostname;
    return host.endsWith(".supabase.co") ? host.split(".")[0] : null;
  } catch {
    return null;
  }
}

export function destructiveScriptProblems(env) {
  const problems = [];
  if (env.ALLOW_DESTRUCTIVE_TESTS !== "1") problems.push("ALLOW_DESTRUCTIVE_TESTS=1 ile açıkça izin verilmedi");
  const ref = projectRef(env.NEXT_PUBLIC_SUPABASE_URL);
  if (!ref) problems.push("NEXT_PUBLIC_SUPABASE_URL bir Supabase proje adresi değil");
  else if (!env.DEV_SUPABASE_PROJECT_REF) problems.push("DEV_SUPABASE_PROJECT_REF tanımlı değil");
  else if (env.DEV_SUPABASE_PROJECT_REF !== ref) problems.push(`proje ref'i (${ref}) DEV_SUPABASE_PROJECT_REF ile eşleşmiyor`);
  let siteHost = null;
  try {
    siteHost = new URL(env.NEXT_PUBLIC_SITE_URL).hostname;
  } catch {
    // reported below
  }
  if (!siteHost || !LOCAL_HOSTS.has(siteHost)) problems.push("NEXT_PUBLIC_SITE_URL localhost değil");
  if (env.NODE_ENV === "production" || env.VERCEL_ENV === "production") problems.push("production ortam işareti var (NODE_ENV/VERCEL_ENV)");
  return problems;
}

/** Stops the process before any database access unless every condition holds. */
export function assertDevDatabase(script, env = process.env) {
  const problems = destructiveScriptProblems(env);
  if (problems.length) {
    console.error(`${script}: veritabanına yazan bu script yalnızca development projesinde çalışır. Durduruldu:`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(2);
  }
}
