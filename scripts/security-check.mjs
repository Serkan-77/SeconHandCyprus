// Database security regression checks, run against the Supabase project in
// .env.local through the public API — the same way an attacker would.
//
//   npm run security
//
// Needs NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and
// SEED_PASSWORD (the seeded demo accounts). SUPABASE_SECRET_KEY is optional and
// only used as a fallback to remove test rows a user cannot delete.
//
// What it writes, and removes again in `finally`:
// - notify() is called for a random user id that does not exist, so if it is
//   still executable the insert fails on the foreign key and reaches no inbox;
// - two test listings owned by the demo seller (one approved by the demo
//   admin), a conversation from the demo buyer on it and one message, plus the
//   notifications those create. Deleting the listing cascades to the rest.
// Every attack is followed by a re-read; a value that did change (before the
// fix is applied) is put back so cleanup can find the rows.

import { randomInt, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const password = process.env.SEED_PASSWORD;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !key || !password) {
  console.error("NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ve SEED_PASSWORD .env.local içinde olmalı.");
  process.exit(1);
}

const DOMAIN = "demo.kibrisikinciel.test";
const PERMISSION_DENIED = "42501";
const TEST_TITLE = "Security check";
const FUTURE = "2099-01-01T00:00:00+00:00";
const results = [];

function client(apiKey = key) {
  return createClient(url, apiKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function signIn(user) {
  const supabase = client();
  const { data, error } = await supabase.auth.signInWithPassword({ email: `${user}@${DOMAIN}`, password });
  if (error) throw new Error(`${user} girişi başarısız: ${error.message}`);
  return { supabase, id: data.user.id };
}

async function check(name, fn) {
  try {
    const note = await fn();
    results.push(["✓", note ? `${name} (${note})` : name]);
  } catch (e) {
    results.push(["✗", `${name}: ${e.message}`]);
  }
}

function describe(error) {
  return error ? `${error.code ?? "?"} ${error.message}` : "hata yok (çağrı başarılı)";
}

function must({ data, error }, what) {
  if (error) throw new Error(`${what}: ${describe(error)}`);
  return data;
}

async function readRow(supabase, table, id) {
  return must(await supabase.from(table).select("*").eq("id", id).single(), `${table} okunamadı`);
}

/**
 * Tries a forbidden update and checks the stored row did not change. If it
 * did (the hole is still open) the old value is written back by the same user.
 */
async function expectUnchanged(supabase, table, id, patch) {
  const before = await readRow(supabase, table, id);
  const { error } = await supabase.from(table).update(patch).eq("id", id);
  const after = await readRow(supabase, table, id);
  const changed = Object.keys(patch).filter((col) => String(after[col]) !== String(before[col]));
  if (changed.length) {
    const restore = Object.fromEntries(changed.map((col) => [col, before[col]]));
    await supabase.from(table).update(restore).eq("id", id);
    throw new Error(`değer değişti: ${changed.map((c) => `${c}=${after[c]}`).join(", ")}`);
  }
  return error ? `reddedildi: ${error.code}` : "değer korundu";
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

// ---------------------------------------------------------------- setup

const anon = client();
const seller = await signIn("ece");
const buyer = await signIn("mert");
const admin = await signIn("admin");
const outsider = admin.id; // any other real profile, used as a forged participant

const categories = must(await anon.from("categories").select("id").order("sort_order").limit(2), "kategoriler");
const [{ id: categoryId }, { id: otherCategoryId }] = categories;
const foreignListing = must(
  await anon.from("listings").select("id").eq("status", "active").not("seller_id", "in", `(${seller.id},${buyer.id})`).limit(1).single(),
  "başka bir aktif ilan",
);

const listingIds = new Set();
const notificationLinks = { [seller.id]: new Set(), [buyer.id]: new Set() };
let conversationId = null;

function baseListing(title) {
  return {
    seller_id: seller.id,
    category_id: categoryId,
    title,
    description: "Otomatik güvenlik testi; birkaç saniye içinde silinir.",
    price: 1,
    currency: "TL",
    city: "Girne",
    condition: "Az kullanılmış",
    status: "pending",
  };
}

try {
  // -------------------------------------------------------------- P0-02 notify
  await check("anon kullanıcı notify() RPC'sini çağıramaz (P0-02)", () => expectNotifyDenied(anon));
  await check("giriş yapmış kullanıcı notify() RPC'sini çağıramaz (P0-02)", () => expectNotifyDenied(buyer.supabase));
  // Control: client-facing RPCs stay executable and refuse non-admins themselves.
  await check("send_announcement RPC'si hâlâ çağrılabilir (yetki kontrolü fonksiyonun içinde)", async () => {
    const { error } = await buyer.supabase.rpc("send_announcement", { p_audience: "Herkes", p_title: "x", p_body: "x" });
    if (!error?.message.includes("Yetkisiz")) throw new Error(`beklenen "Yetkisiz işlem." hatası, gelen: ${describe(error)}`);
  });

  // -------------------------------------------------------------- P0-06 listings: INSERT
  const forgedRef = 900000000 + randomInt(1000000);
  const forgedSlug = `forged-slug-${randomInt(1000000)}`;
  const inserted = must(
    await seller.supabase
      .from("listings")
      .insert({
        ...baseListing(`${TEST_TITLE} forged`),
        featured: true,
        view_count: 999999,
        created_at: FUTURE,
        published_at: FUTURE,
        ref_no: forgedRef,
        slug: forgedSlug,
        reject_reason: "forged",
      })
      .select("*")
      .single(),
    "sahte alanlı ilan eklenemedi",
  );
  listingIds.add(inserted.id);

  const insertChecks = [
    ["featured", () => inserted.featured === false],
    ["view_count", () => inserted.view_count === 0],
    ["created_at", () => Math.abs(Date.parse(inserted.created_at) - Date.now()) < 10 * 60 * 1000],
    ["published_at", () => inserted.published_at === null],
    ["ref_no", () => Number(inserted.ref_no) !== forgedRef],
    ["slug", () => inserted.slug !== forgedSlug && inserted.slug.endsWith(`-${inserted.ref_no}`)],
    ["reject_reason", () => inserted.reject_reason === null],
  ];
  for (const [col, ok] of insertChecks) {
    await check(`INSERT: istemcinin gönderdiği ${col} yok sayılır (P0-06)`, () => {
      if (!ok()) throw new Error(`kaydedilen değer: ${inserted[col]}`);
    });
  }
  must(await seller.supabase.from("listings").delete().eq("id", inserted.id), "sahte ilan silinemedi");
  listingIds.delete(inserted.id);

  // -------------------------------------------------------------- P0-06 listings: UPDATE
  const listing = must(
    await seller.supabase.from("listings").insert(baseListing(`${TEST_TITLE} lamp`)).select("*").single(),
    "test ilanı eklenemedi",
  );
  listingIds.add(listing.id);
  must(await admin.supabase.from("listings").update({ status: "active" }).eq("id", listing.id), "admin onayı");
  const approved = await readRow(seller.supabase, "listings", listing.id);
  notificationLinks[seller.id].add(`/ilan/${approved.slug}`);

  const listingAttacks = {
    featured: true,
    view_count: 123456,
    ref_no: forgedRef,
    seller_id: buyer.id,
    created_at: FUTURE,
    published_at: FUTURE,
    category_id: otherCategoryId,
    slug: forgedSlug,
  };
  for (const [col, value] of Object.entries(listingAttacks)) {
    await check(`UPDATE: satıcı kendi aktif ilanında ${col} değiştiremez (P0-06)`, () =>
      expectUnchanged(seller.supabase, "listings", listing.id, { [col]: value }),
    );
  }

  await check("UPDATE: satıcı başlığı değiştirebilir, slug güvenli numarayla yeniden üretilir", async () => {
    const { ref_no } = await readRow(seller.supabase, "listings", listing.id);
    must(await seller.supabase.from("listings").update({ title: `${TEST_TITLE} lamp updated` }).eq("id", listing.id), "başlık güncellenemedi");
    const row = await readRow(seller.supabase, "listings", listing.id);
    if (row.title !== `${TEST_TITLE} lamp updated`) throw new Error(`başlık: ${row.title}`);
    if (row.slug !== `security-check-lamp-updated-${ref_no}`) throw new Error(`slug: ${row.slug}`);
  });

  await check("Admin setFeatured hâlâ çalışır", async () => {
    must(await admin.supabase.from("listings").update({ featured: true }).eq("id", listing.id), "admin featured");
    const row = await readRow(admin.supabase, "listings", listing.id);
    if (row.featured !== true) throw new Error("featured true olmadı");
    must(await admin.supabase.from("listings").update({ featured: false }).eq("id", listing.id), "admin featured geri");
  });

  // -------------------------------------------------------------- P0-03 conversations
  const conversation = must(
    await buyer.supabase
      .from("conversations")
      .insert({ listing_id: listing.id, buyer_id: buyer.id, seller_id: seller.id })
      .select("*")
      .single(),
    "konuşma açılamadı",
  );
  conversationId = conversation.id;
  notificationLinks[buyer.id].add(`/mesajlar?c=${conversation.id}`);

  // Sending also exercises on_message_created, which updates last_message_at as the owner.
  const original = "security-check original";
  let message = null;
  await check("Mesaj gönderimi ve last_message_at trigger'ı çalışır", async () => {
    message = must(
      await seller.supabase
        .from("messages")
        .insert({ conversation_id: conversation.id, sender_id: seller.id, body: original })
        .select("*")
        .single(),
      "mesaj gönderilemedi",
    );
    const conv = await readRow(buyer.supabase, "conversations", conversation.id);
    if (Date.parse(conv.last_message_at) < Date.parse(message.created_at)) throw new Error("last_message_at güncellenmedi");
  });

  await check("Konuşma: alıcı seller_id değiştiremez (P0-03)", () =>
    expectUnchanged(buyer.supabase, "conversations", conversation.id, { seller_id: outsider }),
  );
  await check("Konuşma: alıcı listing_id değiştiremez (P0-03)", () =>
    expectUnchanged(buyer.supabase, "conversations", conversation.id, { listing_id: foreignListing.id }),
  );
  await check("Konuşma: satıcı buyer_id değiştiremez (P0-03)", () =>
    expectUnchanged(seller.supabase, "conversations", conversation.id, { buyer_id: outsider }),
  );
  await check("Konuşma: katılımcı last_message_at değiştiremez (P0-03)", () =>
    expectUnchanged(buyer.supabase, "conversations", conversation.id, { last_message_at: FUTURE }),
  );
  await check("Konuşma: buluşma onayı (confirmMeeting) hâlâ çalışır", async () => {
    must(
      await buyer.supabase.from("conversations").update({ meeting_confirmed_at: new Date().toISOString() }).eq("id", conversation.id),
      "buluşma onayı",
    );
    const row = await readRow(buyer.supabase, "conversations", conversation.id);
    if (!row.meeting_confirmed_at) throw new Error("meeting_confirmed_at boş kaldı");
  });

  // -------------------------------------------------------------- P0-05 messages
  if (message) {
    await check("Mesaj: alıcı body değiştiremez (P0-05)", () =>
      expectUnchanged(buyer.supabase, "messages", message.id, { body: "MANIPULATED" }),
    );
    await check("Mesaj: alıcı sender_id / created_at değiştiremez (P0-05)", async () => {
      const notes = [];
      for (const patch of [{ sender_id: buyer.id }, { created_at: FUTURE }]) {
        notes.push(await expectUnchanged(buyer.supabase, "messages", message.id, patch));
      }
      return notes.join(", ");
    });
    await check("Mesaj: gönderen kendi mesajının body'sini değiştiremez", () =>
      expectUnchanged(seller.supabase, "messages", message.id, { body: "MANIPULATED" }),
    );
    await check("Mesaj: alıcı read_at işaretleyebilir (markConversationRead)", async () => {
      must(await buyer.supabase.from("messages").update({ read_at: new Date().toISOString() }).eq("id", message.id), "read_at");
      const row = await readRow(buyer.supabase, "messages", message.id);
      if (!row.read_at) throw new Error("read_at boş kaldı");
      if (row.body !== original) throw new Error(`body değişti: ${row.body}`);
    });
  }
} catch (e) {
  results.push(["✗", `Kurulum adımı başarısız, kalan kontroller çalışmadı: ${e.message}`]);
} finally {
  // ------------------------------------------------------------ cleanup
  for (const id of listingIds) await seller.supabase.from("listings").delete().eq("id", id);
  if (conversationId) {
    // Cascades from the listing; the secret key only helps if a pre-fix attack moved it elsewhere.
    const { data: left } = await buyer.supabase.from("conversations").select("id").eq("id", conversationId);
    if (left?.length && secret) await client(secret).from("conversations").delete().eq("id", conversationId);
  }
  for (const [owner, links] of [[seller, notificationLinks[seller.id]], [buyer, notificationLinks[buyer.id]]]) {
    if (links.size) await owner.supabase.from("notifications").delete().in("link", [...links]);
  }

  const leftovers = [];
  const { data: ownListings } = await seller.supabase.from("listings").select("id").ilike("title", `${TEST_TITLE}%`);
  if (ownListings?.length) leftovers.push(`${ownListings.length} ilan`);
  if (conversationId) {
    const { data: conv } = await buyer.supabase.from("conversations").select("id").eq("id", conversationId);
    if (conv?.length) leftovers.push("konuşma");
  }
  for (const [owner, links] of [[seller, notificationLinks[seller.id]], [buyer, notificationLinks[buyer.id]]]) {
    if (!links.size) continue;
    const { data: notes } = await owner.supabase.from("notifications").select("id").in("link", [...links]);
    if (notes?.length) leftovers.push(`${notes.length} bildirim`);
  }
  results.push(leftovers.length ? ["✗", `Test verisi temizlenemedi: ${leftovers.join(", ")}`] : ["✓", "Test verisi temizlendi (kalıntı yok)"]);

  await Promise.all([seller, buyer, admin].map((u) => u.supabase.auth.signOut()));
}

console.log("\nGüvenlik kontrolleri:");
for (const [mark, name] of results) console.log(` ${mark} ${name}`);
const failed = results.filter(([mark]) => mark === "✗").length;
console.log(`\n${results.length - failed}/${results.length} kontrol geçti.`);
process.exit(failed ? 1 : 0);
