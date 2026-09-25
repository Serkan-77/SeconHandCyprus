// Database security regression checks, run against the Supabase project in
// .env.local through the public API — the same way an attacker would.
//
//   npm run security
//
// Needs NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and
// SEED_PASSWORD (for the seeded demo buyer). Writes nothing: notify() is called
// for a random user id that does not exist, so if it is still executable the
// insert fails on the foreign key instead of reaching anyone's inbox.

import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const password = process.env.SEED_PASSWORD;
if (!url || !key || !password) {
  console.error("NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ve SEED_PASSWORD .env.local içinde olmalı.");
  process.exit(1);
}

const DOMAIN = "demo.kibrisikinciel.test";
const PERMISSION_DENIED = "42501";
const results = [];

function client() {
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function check(name, fn) {
  try {
    await fn();
    results.push(["✓", name]);
  } catch (e) {
    results.push(["✗", `${name}: ${e.message}`]);
  }
}

function describe(error) {
  return error ? `${error.code ?? "?"} ${error.message}` : "hata yok (çağrı başarılı)";
}

async function expectNotifyDenied(supabase) {
  const { error } = await supabase.rpc("notify", {
    p_user: randomUUID(),
    p_kind: "info",
    p_title: "security-check",
    p_body: "security-check",
    p_link: "https://example.invalid",
  });
  if (error?.code !== PERMISSION_DENIED) {
    throw new Error(`notify() çağrılabiliyor — beklenen ${PERMISSION_DENIED}, gelen: ${describe(error)}`);
  }
}

const anon = client();
const buyer = client();

await check("anon kullanıcı notify() RPC'sini çağıramaz (P0-02)", () => expectNotifyDenied(anon));

await check("giriş yapmış kullanıcı notify() RPC'sini çağıramaz (P0-02)", async () => {
  const { error } = await buyer.auth.signInWithPassword({ email: `ece@${DOMAIN}`, password });
  if (error) throw new Error(`demo kullanıcı girişi başarısız: ${error.message}`);
  await expectNotifyDenied(buyer);
});

// Control: client-facing RPCs must stay executable. send_announcement reaches
// its own is_admin() check and refuses a normal user with its own message.
await check("send_announcement RPC'si hâlâ çağrılabilir (yetki kontrolü fonksiyonun içinde)", async () => {
  const { error } = await buyer.rpc("send_announcement", { p_audience: "Herkes", p_title: "x", p_body: "x" });
  if (!error?.message.includes("Yetkisiz")) {
    throw new Error(`beklenen "Yetkisiz işlem." hatası, gelen: ${describe(error)}`);
  }
});

await buyer.auth.signOut();

console.log("\nGüvenlik kontrolleri:");
for (const [mark, name] of results) console.log(` ${mark} ${name}`);
const failed = results.filter(([mark]) => mark === "✗").length;
console.log(`\n${results.length - failed}/${results.length} kontrol geçti.`);
process.exit(failed ? 1 : 0);
