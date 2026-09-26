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
//   admin), conversations from two demo buyers on it, a few messages and at
//   most one rating, plus the notifications those create. Deleting the
//   listing cascades to conversations and messages; ratings cannot be deleted
//   by users, so they are removed with SUPABASE_SECRET_KEY;
// - the demo seller's phone number is changed and restored through an
//   admin-approved review request; review requests are removed with the
//   secret key, which also puts the number back if a check stops half-way.
// Every attack is followed by a re-read; a value that did change (before the
// fix is applied) is put back so cleanup can find the rows.

import { randomInt, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { assertDevDatabase } from "./lib/dev-guard.mjs";

// Writes to the database: development project only (P1-13).
assertDevDatabase("security");

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
const PAST = "2000-01-01T00:00:00+00:00";
const RATING_MARK = "security-check";
const STARTED = new Date(Date.now() - 60 * 1000).toISOString();
const results = [];

/** A timestamp the server set just now (allows for clock skew), not a forged one. */
function isServerNow(value) {
  return Boolean(value) && Math.abs(Date.parse(value) - Date.now()) < 10 * 60 * 1000;
}

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
  const missing = Object.keys(patch).filter((col) => !(col in before));
  if (missing.length) throw new Error(`kolon yok: ${missing.join(", ")} (migration uygulanmamış olabilir)`);
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
const secondBuyer = await signIn("selin");
const outsider = admin.id; // any other real profile, used as a forged participant

const categories = must(await anon.from("categories").select("id").order("sort_order").limit(2), "kategoriler");
const [{ id: categoryId }, { id: otherCategoryId }] = categories;
const foreignListing = must(
  await anon.from("listings").select("id").eq("status", "active").not("seller_id", "in", `(${seller.id},${buyer.id})`).limit(1).single(),
  "başka bir aktif ilan",
);

const listingIds = new Set();
// Rating notifications link to the ratee's reviews page; only rows created during this run are removed.
const notificationLinks = {
  [seller.id]: new Set([`/satici/${seller.id}/yorumlar`]),
  [buyer.id]: new Set([`/satici/${buyer.id}/yorumlar`]),
  [secondBuyer.id]: new Set([`/satici/${secondBuyer.id}/yorumlar`]),
};
const conversationIds = new Set();
const verificationIds = new Set();
let phoneRestore = null; // ece's number and review flag before the P0-07 checks

/** Tries to rate; a rating that does get in is left for cleanup and fails the check. */
async function expectRatingDenied(rater, conversationId, rateeId, score = 5) {
  const { data, error } = await rater.supabase
    .from("ratings")
    .insert({ rater_id: rater.id, ratee_id: rateeId, conversation_id: conversationId, score, comment: RATING_MARK })
    .select("id");
  if (!error && data?.length) throw new Error("puan kaydedildi");
  return `reddedildi: ${error?.code ?? "0 satır"}`;
}

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
    // Since 0008 a content edit sends the listing back to review (P1-01); the
    // checks below need it public again, so the admin re-approves it.
    must(await admin.supabase.from("listings").update({ status: "active" }).eq("id", listing.id), "admin yeniden onay");
    // The re-approval notifies the seller under the new slug.
    notificationLinks[seller.id].add(`/ilan/${row.slug}`);
  });

  await check("Admin setFeatured hâlâ çalışır", async () => {
    must(await admin.supabase.from("listings").update({ featured: true }).eq("id", listing.id), "admin featured");
    const row = await readRow(admin.supabase, "listings", listing.id);
    if (row.featured !== true) throw new Error("featured true olmadı");
    must(await admin.supabase.from("listings").update({ featured: false }).eq("id", listing.id), "admin featured geri");
  });

  // -------------------------------------------------------------- P0-04 conversation INSERT
  await check("Konuşma INSERT: sahte seller_id ile konuşma açılamaz (P0-04)", async () => {
    const { data, error } = await secondBuyer.supabase
      .from("conversations")
      .insert({ listing_id: listing.id, buyer_id: secondBuyer.id, seller_id: outsider })
      .select("id");
    if (!error && data?.length) {
      data.forEach((c) => conversationIds.add(c.id));
      throw new Error("konuşma sahte satıcıyla oluşturuldu");
    }
    return `reddedildi: ${error?.code}`;
  });

  // The main conversation is opened with forged system columns; the database must ignore them.
  const conversation = must(
    await buyer.supabase
      .from("conversations")
      .insert({
        listing_id: listing.id,
        buyer_id: buyer.id,
        seller_id: seller.id,
        created_at: FUTURE,
        last_message_at: FUTURE,
        meeting_confirmed_at: FUTURE,
      })
      .select("*")
      .single(),
    "konuşma açılamadı",
  );
  conversationIds.add(conversation.id);
  notificationLinks[buyer.id].add(`/mesajlar?c=${conversation.id}`);
  for (const [col, ok] of [
    ["created_at", () => isServerNow(conversation.created_at)],
    ["last_message_at", () => isServerNow(conversation.last_message_at)],
    ["meeting_confirmed_at", () => conversation.meeting_confirmed_at === null],
  ]) {
    await check(`Konuşma INSERT: istemcinin gönderdiği ${col} yok sayılır (P0-04)`, () => {
      if (!ok()) throw new Error(`kaydedilen değer: ${conversation[col]}`);
    });
  }

  // A second buyer forges both confirmations up front.
  let secondConversation = null;
  await check("Konuşma INSERT: istemcinin gönderdiği buyer/seller_confirmed_at yok sayılır (P0-04)", async () => {
    secondConversation = must(
      await secondBuyer.supabase
        .from("conversations")
        .insert({
          listing_id: listing.id,
          buyer_id: secondBuyer.id,
          seller_id: seller.id,
          buyer_confirmed_at: PAST,
          seller_confirmed_at: PAST,
        })
        .select("*")
        .single(),
      "konuşma açılamadı",
    );
    conversationIds.add(secondConversation.id);
    if (secondConversation.buyer_confirmed_at !== null || secondConversation.seller_confirmed_at !== null) {
      throw new Error(`kaydedilen: ${secondConversation.buyer_confirmed_at} / ${secondConversation.seller_confirmed_at}`);
    }
  });

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

  // -------------------------------------------------------------- P0-04 message INSERT
  await check("Mesaj INSERT: istemcinin gönderdiği created_at ve read_at yok sayılır (P0-04)", async () => {
    const forged = must(
      await seller.supabase
        .from("messages")
        .insert({
          conversation_id: conversation.id,
          sender_id: seller.id,
          body: "security-check forged",
          created_at: FUTURE,
          read_at: PAST,
        })
        .select("*")
        .single(),
      "mesaj gönderilemedi",
    );
    if (!isServerNow(forged.created_at)) throw new Error(`created_at: ${forged.created_at}`);
    if (forged.read_at !== null) throw new Error(`read_at: ${forged.read_at}`);
  });
  await check("Mesaj INSERT: sahte sender_id reddedilir", async () => {
    const { data, error } = await seller.supabase
      .from("messages")
      .insert({ conversation_id: conversation.id, sender_id: buyer.id, body: "security-check spoofed" })
      .select("id");
    if (!error && data?.length) throw new Error("başkası adına mesaj kaydedildi");
    return `reddedildi: ${error?.code}`;
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

  // -------------------------------------------------------------- P0-04 confirmation + ratings
  // Main conversation: buyer = mert, seller = ece. Nobody has confirmed yet.
  await check("Puan: hiç onay yokken reddedilir (P0-04)", () => expectRatingDenied(buyer, conversation.id, seller.id));
  await check("Onay: alıcı satıcının onayını veremez (P0-04)", () =>
    expectUnchanged(buyer.supabase, "conversations", conversation.id, { seller_confirmed_at: new Date().toISOString() }),
  );
  await check("Onay: satıcı alıcının onayını veremez (P0-04)", () =>
    expectUnchanged(seller.supabase, "conversations", conversation.id, { buyer_confirmed_at: new Date().toISOString() }),
  );
  await check("Onay: alıcı kendi onayını verir, zaman damgası sunucudan gelir (P0-04)", async () => {
    must(await buyer.supabase.from("conversations").update({ buyer_confirmed_at: PAST }).eq("id", conversation.id), "alıcı onayı");
    const row = await readRow(buyer.supabase, "conversations", conversation.id);
    if (!isServerNow(row.buyer_confirmed_at)) throw new Error(`buyer_confirmed_at: ${row.buyer_confirmed_at}`);
  });
  await check("Onay: tek taraf onayladığında meeting_confirmed_at boş kalır (P0-04)", async () => {
    const row = await readRow(buyer.supabase, "conversations", conversation.id);
    if (row.meeting_confirmed_at !== null) throw new Error(`meeting_confirmed_at: ${row.meeting_confirmed_at}`);
  });
  await check("Onay: alıcı kendi onayının tarihini değiştiremez / geri çekemez (P0-04)", async () => {
    const notes = [];
    for (const value of [FUTURE, null]) {
      notes.push(await expectUnchanged(buyer.supabase, "conversations", conversation.id, { buyer_confirmed_at: value }));
    }
    return notes.join(", ");
  });
  await check("Puan: sadece alıcı onayladıyken reddedilir (P0-04)", () => expectRatingDenied(buyer, conversation.id, seller.id));
  await check("Onay: meeting_confirmed_at doğrudan değiştirilemez (P0-04)", () =>
    expectUnchanged(buyer.supabase, "conversations", conversation.id, { meeting_confirmed_at: new Date().toISOString() }),
  );

  // Second conversation: only the seller confirms.
  await check("Puan: sadece satıcı onayladıyken reddedilir (P0-04)", async () => {
    if (!secondConversation) throw new Error("ikinci konuşma oluşturulamadı");
    must(
      await seller.supabase.from("conversations").update({ seller_confirmed_at: PAST }).eq("id", secondConversation.id),
      "satıcı onayı",
    );
    const notes = [
      await expectRatingDenied(secondBuyer, secondConversation.id, seller.id),
      await expectRatingDenied(seller, secondConversation.id, secondBuyer.id),
    ];
    return notes.join(", ");
  });

  await check("Onay: satıcı kendi onayını verir; iki onay sonrası meeting_confirmed_at dolar (P0-04)", async () => {
    must(await seller.supabase.from("conversations").update({ seller_confirmed_at: PAST }).eq("id", conversation.id), "satıcı onayı");
    const row = await readRow(seller.supabase, "conversations", conversation.id);
    if (!isServerNow(row.seller_confirmed_at)) throw new Error(`seller_confirmed_at: ${row.seller_confirmed_at}`);
    if (!isServerNow(row.meeting_confirmed_at)) throw new Error(`meeting_confirmed_at: ${row.meeting_confirmed_at}`);
  });
  await check("Onay: iki taraflı onaydan sonra meeting_confirmed_at doğrudan değiştirilemez (P0-04)", () =>
    expectUnchanged(seller.supabase, "conversations", conversation.id, { meeting_confirmed_at: null }),
  );

  await check("Puan: iki taraf onaylayınca verilebilir; listing_id ve tarih sunucudan (P0-04)", async () => {
    const rating = must(
      await buyer.supabase
        .from("ratings")
        .insert({
          rater_id: buyer.id,
          ratee_id: seller.id,
          conversation_id: conversation.id,
          listing_id: foreignListing.id,
          score: 5,
          comment: RATING_MARK,
          created_at: FUTURE,
        })
        .select("*")
        .single(),
      "puan verilemedi",
    );
    if (rating.listing_id !== listing.id) throw new Error(`listing_id: ${rating.listing_id}`);
    if (!isServerNow(rating.created_at)) throw new Error(`created_at: ${rating.created_at}`);
  });
  await check("Puan: aynı konuşma için ikinci puan reddedilir", () => expectRatingDenied(buyer, conversation.id, seller.id));
  await check("Puan: kendine puan reddedilir", () => expectRatingDenied(buyer, conversation.id, buyer.id));
  await check("Puan: konuşma dışındaki kişiye puan reddedilir", () => expectRatingDenied(seller, conversation.id, outsider));
  await check("Puan: 1-5 dışındaki puan reddedilir", () => expectRatingDenied(seller, conversation.id, buyer.id, 6));

  // -------------------------------------------------------------- P0-07 phone review
  // ece is seeded with a manually reviewed number. It is changed, then put back
  // through a review request the admin approves (the real restore path).
  const originalPhone = must(
    await seller.supabase.from("profile_private").select("phone").eq("id", seller.id).single(),
    "telefon okunamadı",
  ).phone;
  phoneRestore = { phone: originalPhone, verified: (await readRow(seller.supabase, "profiles", seller.id)).phone_verified };
  const isVerified = async () => (await readRow(seller.supabase, "profiles", seller.id)).phone_verified;

  await check("Telefon: ön koşul — ece'nin numarası incelenmiş", async () => {
    if (!originalPhone || !phoneRestore.verified) throw new Error(`telefon=${originalPhone} phone_verified=${phoneRestore.verified}`);
  });
  await check("Telefon: aynı numara tekrar yazılınca inceleme korunur (P0-07)", async () => {
    must(await seller.supabase.from("profile_private").update({ phone: originalPhone }).eq("id", seller.id), "telefon");
    if (!(await isVerified())) throw new Error("phone_verified sıfırlandı");
  });
  await check("Telefon: numara değişince phone_verified sıfırlanır (P0-07)", async () => {
    must(await seller.supabase.from("profile_private").update({ phone: "+905000000000" }).eq("id", seller.id), "telefon");
    if (await isVerified()) throw new Error("phone_verified true kaldı");
  });
  // Restores ece through the real path: a review request the admin approves.
  const approveOriginal = async () => {
    const request = must(
      await seller.supabase.from("verification_requests").insert({ user_id: seller.id, kind: "phone", detail: originalPhone }).select("id").single(),
      "inceleme talebi",
    );
    verificationIds.add(request.id);
    notificationLinks[seller.id].add("/hesabim/dogrulama");
    must(await admin.supabase.from("verification_requests").update({ status: "approved" }).eq("id", request.id), "admin onayı");
    const phone = must(await seller.supabase.from("profile_private").select("phone").eq("id", seller.id).single(), "telefon").phone;
    if (phone !== originalPhone) throw new Error(`telefon: ${phone}`);
    if (!(await isVerified())) throw new Error("phone_verified true olmadı");
  };
  await check("Telefon: admin onayı numarayı yazar ve phone_verified=true kalır (onay akışı çalışır)", approveOriginal);
  await check("Telefon: numara silinince (null) phone_verified sıfırlanır (P0-07)", async () => {
    must(await seller.supabase.from("profile_private").update({ phone: null }).eq("id", seller.id), "telefon");
    if (await isVerified()) throw new Error("phone_verified true kaldı");
  });
  await check("Telefon: ikinci admin onayı numarayı ve incelemeyi yeniden geri getirir", approveOriginal);
  await check("reset_phone_verification RPC olarak çağrılamaz (anon / authenticated)", async () => {
    const codes = [];
    for (const caller of [anon, buyer.supabase]) {
      const { error } = await caller.rpc("reset_phone_verification");
      if (!error) throw new Error("çağrı başarılı oldu");
      codes.push(error.code);
    }
    if (!(await isVerified())) throw new Error("ece'nin incelemesi değişti");
    return `reddedildi: ${codes.join(", ")}`;
  });

  await check("Profil: kullanıcı phone_verified=true yapamaz", () =>
    expectUnchanged(buyer.supabase, "profiles", buyer.id, { phone_verified: true }),
  );
  await check("Profil: kullanıcı role / status / status_until değiştiremez", async () => {
    const notes = [];
    for (const patch of [{ role: "admin" }, { status: "suspended" }, { status_until: FUTURE }]) {
      notes.push(await expectUnchanged(buyer.supabase, "profiles", buyer.id, patch));
    }
    return notes.join(", ");
  });
  await check("İnceleme talebi: kullanıcı kendi talebini onaylı açamaz / onaylayamaz", async () => {
    const { data: forged, error } = await buyer.supabase
      .from("verification_requests")
      .insert({ user_id: buyer.id, kind: "phone", detail: "+905000000001", status: "approved" })
      .select("id");
    forged?.forEach((r) => verificationIds.add(r.id));
    if (!error && forged?.length) throw new Error("onaylı talep oluşturuldu");
    const pending = must(
      await buyer.supabase
        .from("verification_requests")
        .insert({ user_id: buyer.id, kind: "phone", detail: "+905000000001" })
        .select("id")
        .single(),
      "bekleyen talep",
    );
    verificationIds.add(pending.id);
    await buyer.supabase.from("verification_requests").update({ status: "approved" }).eq("id", pending.id);
    const row = must(await buyer.supabase.from("verification_requests").select("status").eq("id", pending.id).single(), "talep");
    if (row.status !== "pending") throw new Error(`durum: ${row.status}`);
    return `onaylı ekleme reddedildi: ${error?.code}, onaylama 0 satır`;
  });
} catch (e) {
  results.push(["✗", `Kurulum adımı başarısız, kalan kontroller çalışmadı: ${e.message}`]);
} finally {
  // ------------------------------------------------------------ cleanup
  // Ratings outlive their conversation (conversation_id is set null), and users
  // have no DELETE policy on ratings, so they go first, with the secret key.
  if (secret) await client(secret).from("ratings").delete().eq("comment", RATING_MARK);
  // Review requests cannot be deleted by users either. If a check failed half-way,
  // ece's number and flag are put back with the secret key.
  if (secret && verificationIds.size) await client(secret).from("verification_requests").delete().in("id", [...verificationIds]);
  if (phoneRestore) {
    const { data: now } = await admin.supabase.from("profile_private").select("phone").eq("id", seller.id).single();
    const { data: flag } = await admin.supabase.from("profiles").select("phone_verified").eq("id", seller.id).single();
    if (secret && (now?.phone !== phoneRestore.phone || flag?.phone_verified !== phoneRestore.verified)) {
      await client(secret).from("profile_private").update({ phone: phoneRestore.phone }).eq("id", seller.id);
      await client(secret).from("profiles").update({ phone_verified: phoneRestore.verified }).eq("id", seller.id);
    }
  }
  for (const id of listingIds) await seller.supabase.from("listings").delete().eq("id", id);
  // Conversations cascade from the listing; the secret key only helps if a pre-fix attack moved one elsewhere.
  if (conversationIds.size && secret) await client(secret).from("conversations").delete().in("id", [...conversationIds]);
  for (const [owner, links] of [seller, buyer, secondBuyer].map((u) => [u, notificationLinks[u.id]])) {
    if (links.size) await owner.supabase.from("notifications").delete().in("link", [...links]).gte("created_at", STARTED);
  }

  const leftovers = [];
  const { data: ownListings } = await seller.supabase.from("listings").select("id").ilike("title", `${TEST_TITLE}%`);
  if (ownListings?.length) leftovers.push(`${ownListings.length} ilan`);
  if (conversationIds.size) {
    const { data: conv } = await admin.supabase.from("conversations").select("id").in("id", [...conversationIds]);
    if (conv?.length) leftovers.push(`${conv.length} konuşma`);
  }
  if (verificationIds.size) {
    const { data: requests } = await admin.supabase.from("verification_requests").select("id").in("id", [...verificationIds]);
    if (requests?.length) leftovers.push(`${requests.length} inceleme talebi`);
  }
  if (phoneRestore) {
    const { data: now } = await admin.supabase.from("profile_private").select("phone").eq("id", seller.id).single();
    const { data: flag } = await admin.supabase.from("profiles").select("phone_verified").eq("id", seller.id).single();
    if (now?.phone !== phoneRestore.phone || flag?.phone_verified !== phoneRestore.verified) leftovers.push("ece telefonu/incelemesi geri yüklenmedi");
  }
  const { data: ratings } = await anon.from("ratings").select("id").eq("comment", RATING_MARK);
  if (ratings?.length) leftovers.push(`${ratings.length} puan${secret ? "" : " (SUPABASE_SECRET_KEY yok)"}`);
  for (const [owner, links] of [seller, buyer, secondBuyer].map((u) => [u, notificationLinks[u.id]])) {
    if (!links.size) continue;
    const { data: notes } = await owner.supabase.from("notifications").select("id").in("link", [...links]).gte("created_at", STARTED);
    if (notes?.length) leftovers.push(`${notes.length} bildirim`);
  }
  results.push(leftovers.length ? ["✗", `Test verisi temizlenemedi: ${leftovers.join(", ")}`] : ["✓", "Test verisi temizlendi (kalıntı yok)"]);

  await Promise.all([seller, buyer, admin, secondBuyer].map((u) => u.supabase.auth.signOut()));
}

console.log("\nGüvenlik kontrolleri:");
for (const [mark, name] of results) console.log(` ${mark} ${name}`);
const failed = results.filter(([mark]) => mark === "✗").length;
console.log(`\n${results.length - failed}/${results.length} kontrol geçti.`);
process.exit(failed ? 1 : 0);
