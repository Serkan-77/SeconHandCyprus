// Integration checks against the development Supabase project in .env.local.
//
//   npm run integration
//
// Needs NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and
// SEED_PASSWORD (demo accounts). Every row it writes is removed in `finally`.
//
// Chat paging (P1-11): a 7-message test conversation is read in pages of 3,
// newest first, and must come back complete and in order; the inbox query
// must return each conversation's real latest message.

import { fetchLatestMessages, fetchOlderMessages } from "../src/lib/chat.ts";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const password = process.env.SEED_PASSWORD;
if (!url || !key || !password) {
  console.error("NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ve SEED_PASSWORD .env.local içinde olmalı.");
  process.exit(1);
}

const DOMAIN = "demo.kibrisikinciel.test";
const MARK = "integration-check";
const STARTED = new Date(Date.now() - 60 * 1000).toISOString();
const results = [];

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
async function signIn(user) {
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.auth.signInWithPassword({ email: `${user}@${DOMAIN}`, password });
  if (error) throw new Error(`${user} girişi başarısız: ${error.message}`);
  return { supabase, id: data.user.id };
}

const seller = await signIn("ece");
const buyer = await signIn("mert");
const admin = await signIn("admin");
let listingId = null;
let conversationId = null;

try {
  const { data: cats } = await admin.supabase.from("categories").select("id").order("sort_order").limit(1);
  const listing = must(
    await seller.supabase
      .from("listings")
      .insert({ seller_id: seller.id, category_id: cats[0].id, title: `${MARK} chat`, description: MARK, price: 1, currency: "TL", city: "Girne", condition: "Az kullanılmış", status: "pending" })
      .select("id")
      .single(),
    "ilan",
  );
  listingId = listing.id;
  must(await admin.supabase.from("listings").update({ status: "active" }).eq("id", listingId), "onay");
  const conv = must(
    await buyer.supabase.from("conversations").insert({ listing_id: listingId, buyer_id: buyer.id, seller_id: seller.id }).select("id").single(),
    "konuşma",
  );
  conversationId = conv.id;
  const sent = [];
  for (let i = 1; i <= 7; i++) {
    const author = i % 2 ? buyer : seller;
    const m = must(
      await author.supabase.from("messages").insert({ conversation_id: conversationId, sender_id: author.id, body: `${MARK} ${i}` }).select("id").single(),
      `mesaj ${i}`,
    );
    sent.push(m.id);
  }

  // ------------------------------------------------------------ P1-11
  await check("Sohbet: ilk sayfa en yeni mesajları kronolojik getiriyor (P1-11)", async () => {
    const page = await fetchLatestMessages(buyer.supabase, conversationId, 3);
    const bodies = page.messages.map((m) => m.body);
    if (bodies.join("|") !== [`${MARK} 5`, `${MARK} 6`, `${MARK} 7`].join("|")) throw new Error(bodies.join(", "));
    if (!page.hasMore) throw new Error("hasMore false");
  });
  await check("Sohbet: eski sayfalar eksiksiz ve sırayla geliyor; son sayfada hasMore=false", async () => {
    let page = await fetchLatestMessages(buyer.supabase, conversationId, 3);
    const all = [...page.messages];
    let rounds = 0;
    while (page.hasMore && rounds++ < 5) {
      page = await fetchOlderMessages(buyer.supabase, conversationId, all[0], 3);
      all.unshift(...page.messages);
    }
    const bodies = all.map((m) => m.body);
    const expected = Array.from({ length: 7 }, (_, i) => `${MARK} ${i + 1}`);
    if (bodies.join("|") !== expected.join("|")) throw new Error(bodies.join(", "));
    if (new Set(all.map((m) => m.id)).size !== 7) throw new Error("tekrar eden mesaj");
    return `${rounds + 1} sayfa`;
  });
  await check("Sohbet: konuşma dışındaki kullanıcı mesajları okuyamıyor", async () => {
    const outsider = await signIn("selin");
    const page = await fetchLatestMessages(outsider.supabase, conversationId, 3);
    await outsider.supabase.auth.signOut();
    if (page.messages.length) throw new Error(`${page.messages.length} mesaj döndü`);
  });
  await check("Gelen kutusu: her konuşmanın gerçek son mesajı (tek sorgu)", async () => {
    const { data, error } = await buyer.supabase
      .from("conversations")
      .select("id, last:messages(body, created_at)")
      .or(`buyer_id.eq.${buyer.id},seller_id.eq.${buyer.id}`)
      .order("created_at", { referencedTable: "last", ascending: false })
      .limit(1, { referencedTable: "last" });
    if (error) throw new Error(error.message);
    const mine = data.find((c) => c.id === conversationId);
    if (mine?.last?.[0]?.body !== `${MARK} 7`) throw new Error(`son mesaj: ${mine?.last?.[0]?.body}`);
    if (data.some((c) => c.last.length > 1)) throw new Error("konuşma başına birden fazla mesaj döndü");
    return `${data.length} konuşma`;
  });
} catch (e) {
  results.push(["✗", `Kurulum adımı başarısız: ${e.message}`]);
} finally {
  if (listingId) await seller.supabase.from("listings").delete().eq("id", listingId);
  for (const owner of [seller, buyer]) {
    if (conversationId) await owner.supabase.from("notifications").delete().eq("link", `/mesajlar?c=${conversationId}`);
  }
  await seller.supabase.from("notifications").delete().like("link", `/ilan/${MARK}-chat-%`).gte("created_at", STARTED);
  const left = [];
  const { count: l } = await admin.supabase.from("listings").select("id", { count: "exact", head: true }).ilike("title", `${MARK}%`);
  const { count: m } = await admin.supabase.from("messages").select("id", { count: "exact", head: true }).ilike("body", `${MARK}%`);
  if (l) left.push(`${l} ilan`);
  if (m) left.push(`${m} mesaj`);
  for (const owner of [seller, buyer]) {
    const { count } = await owner.supabase.from("notifications").select("id", { count: "exact", head: true }).gte("created_at", STARTED);
    if (count) left.push(`${count} bildirim`);
  }
  results.push(left.length ? ["✗", `Test verisi temizlenemedi: ${left.join(", ")}`] : ["✓", "Test verisi temizlendi (kalıntı yok)"]);
  await Promise.all([seller, buyer, admin].map((u) => u.supabase.auth.signOut()));
}

console.log("\nEntegrasyon kontrolleri:");
for (const [mark, name] of results) console.log(` ${mark} ${name}`);
const failed = results.filter(([mark]) => mark === "✗").length;
console.log(`\n${results.length - failed}/${results.length} kontrol geçti.`);
process.exit(failed ? 1 : 0);
