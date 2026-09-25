// Shared helpers for the database test scripts (development project only).
import { randomInt } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export const DOMAIN = "demo.kibrisikinciel.test";

export function env() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const password = process.env.SEED_PASSWORD;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key || !password) {
    console.error("NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ve SEED_PASSWORD .env.local içinde olmalı.");
    process.exit(1);
  }
  return { url, key, password, secret };
}

export function makeKit({ url, key, password, secret }) {
  const results = [];
  const client = (apiKey = key) => createClient(url, apiKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const service = secret ? client(secret) : null;
  const tempUsers = [];

  async function signIn(user) {
    const supabase = client();
    const email = user.includes("@") ? user : `${user}@${DOMAIN}`;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(`${user} girişi başarısız: ${error.message}`);
    return { supabase, id: data.user.id, email };
  }

  /** A throwaway account on the demo domain; removed in cleanup. Needs the secret key. */
  async function tempUser(label) {
    if (!service) throw new Error("SUPABASE_SECRET_KEY gerekli (geçici test kullanıcısı)");
    const email = `p1-${label}-${Date.now()}-${randomInt(100000)}@${DOMAIN}`;
    const { data, error } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: `P1 ${label}`, region: "Girne" },
    });
    if (error) throw new Error(`geçici kullanıcı oluşturulamadı: ${error.message}`);
    tempUsers.push(data.user.id);
    return signIn(email);
  }

  async function removeTempUsers() {
    const left = [];
    for (const id of tempUsers) {
      for (const bucket of ["listing-images", "avatars"]) {
        const { data: files } = await service.storage.from(bucket).list(id, { limit: 1000 });
        if (files?.length) await service.storage.from(bucket).remove(files.map((f) => `${id}/${f.name}`));
      }
      const { error } = await service.auth.admin.deleteUser(id);
      if (error && !/not found/i.test(error.message)) left.push(`${id}: ${error.message}`);
    }
    return left;
  }

  async function check(name, fn) {
    try {
      const note = await fn();
      results.push(["✓", note ? `${name} (${note})` : name]);
    } catch (e) {
      results.push(["✗", `${name}: ${e.message}`]);
    }
  }

  function must({ data, error }, what) {
    if (error) throw new Error(`${what}: ${error.code ?? "?"} ${error.message}`);
    return data;
  }

  /** Expects the call to be refused: an error, or no row written/returned. */
  async function expectRefused(promise, what) {
    const { data, error } = await promise;
    if (!error && (Array.isArray(data) ? data.length : data)) throw new Error(`${what}: işlem kabul edildi`);
    return error ? `reddedildi: ${error.code}` : "0 satır";
  }

  function report(title) {
    console.log(`\n${title}`);
    for (const [mark, name] of results) console.log(` ${mark} ${name}`);
    const failed = results.filter(([mark]) => mark === "✗").length;
    console.log(`\n${results.length - failed}/${results.length} kontrol geçti.`);
    return failed;
  }

  return { results, client, service, signIn, tempUser, removeTempUsers, check, must, expectRefused, report };
}
