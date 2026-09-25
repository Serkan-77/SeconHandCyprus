// P1 security regression checks (moderation, sanctions, validation, abuse,
// evidence, account deletion, listing creation) against the development
// Supabase project in .env.local, through the public API.
//
//   npm run security   (runs security-check.mjs, then this file)
//
// Needs SUPABASE_SECRET_KEY as well: throwaway accounts on the demo domain are
// created for the sanction/quota/deletion checks and removed afterwards, and
// rows users cannot delete (sanctions, reports, tickets) are cleaned with it.
// Every row written is removed in `finally` and leftovers are reported.

import { assertDevDatabase } from "./lib/dev-guard.mjs";
import { env, makeKit } from "./lib/test-kit.mjs";

// Writes to the database: development project only (P1-13).
assertDevDatabase("security-p1");

const MARK = "p1-check";
const STARTED = new Date(Date.now() - 60 * 1000).toISOString();
const kit = makeKit(env());
const { service, signIn, tempUser, removeTempUsers, check, must, expectRefused } = kit;

const seller = await signIn("ece");
const buyer = await signIn("mert");
const admin = await signIn("admin");
const anon = kit.client();
const listingIds = new Set();
const conversationLinks = new Set(); // notification links of test conversations
const conversationIds = new Set();
// Snapshot of the demo buyer's profile: before 0009 the validation checks below
// would succeed and change it, so it is always put back in `finally`.
const buyerProfile = (await buyer.supabase.from("profiles").select("display_name, region").eq("id", buyer.id).single()).data;
const buyerPhone = (await buyer.supabase.from("profile_private").select("phone").eq("id", buyer.id).single()).data?.phone ?? null;

const { data: categories } = await anon.from("categories").select("id").order("sort_order").limit(1);
const categoryId = categories[0].id;

async function newListing(owner, title, { approve = true } = {}) {
  const listing = must(
    await owner.supabase
      .from("listings")
      .insert({ seller_id: owner.id, category_id: categoryId, title, description: MARK, price: 10, currency: "TL", city: "Girne", condition: "Az kullanılmış", status: "pending" })
      .select("*")
      .single(),
    "ilan",
  );
  listingIds.add(listing.id);
  if (approve) must(await admin.supabase.from("listings").update({ status: "active" }).eq("id", listing.id), "admin onayı");
  return listing;
}
const statusOf = async (id) => must(await admin.supabase.from("listings").select("status, featured").eq("id", id).single(), "durum");
const anonSees = async (id) => ((await anon.from("listings").select("id").eq("id", id)).data ?? []).length === 1;

try {
  // ==================================================================== Batch 1
  // ------------------------------------------------------------ P1-01 review after content edits
  const lamp = await newListing(seller, `${MARK} lamp`);
  const reapprove = async () => {
    must(await admin.supabase.from("listings").update({ status: "active", featured: true }).eq("id", lamp.id), "yeniden onay");
  };
  await reapprove();

  for (const [col, value] of [
    ["title", `${MARK} lamp renamed`],
    ["description", `${MARK} yeni açıklama`],
    ["condition", "Yıpranmış"],
    ["district", "Alsancak"],
  ]) {
    await check(`P1-01: satıcı aktif ilanda ${col} değiştirince pending + vitrinden düşer, anonim göremez`, async () => {
      must(await seller.supabase.from("listings").update({ [col]: value }).eq("id", lamp.id), col);
      const s = await statusOf(lamp.id);
      if (s.status !== "pending" || s.featured) throw new Error(`status=${s.status} featured=${s.featured}`);
      if (await anonSees(lamp.id)) throw new Error("anonim hâlâ görüyor");
      await reapprove();
    });
  }
  for (const [col, value] of [["price", 25], ["negotiable", true]]) {
    await check(`P1-01: satıcı ${col} değiştirince ilan yayında kalır`, async () => {
      must(await seller.supabase.from("listings").update({ [col]: value }).eq("id", lamp.id), col);
      const s = await statusOf(lamp.id);
      if (s.status !== "active") throw new Error(`status=${s.status}`);
    });
  }
  await check("P1-01: fotoğraf ekleme ve silme aktif ilanı incelemeye gönderir", async () => {
    const image = must(
      await seller.supabase.from("listing_images").insert({ listing_id: lamp.id, path: `${seller.id}/${MARK}-1.jpg`, position: 0 }).select("id").single(),
      "fotoğraf ekle",
    );
    if ((await statusOf(lamp.id)).status !== "pending") throw new Error("ekleme sonrası active kaldı");
    await reapprove();
    must(await seller.supabase.from("listing_images").delete().eq("id", image.id).select("id"), "fotoğraf sil");
    if ((await statusOf(lamp.id)).status !== "pending") throw new Error("silme sonrası active kaldı");
    await reapprove();
  });
  await check("P1-01: admin düzenlemesi ilanı yayında ve vitrinde bırakır", async () => {
    must(await admin.supabase.from("listings").update({ title: `${MARK} lamp by admin` }).eq("id", lamp.id), "admin düzenleme");
    const s = await statusOf(lamp.id);
    if (s.status !== "active" || !s.featured) throw new Error(`status=${s.status} featured=${s.featured}`);
    if (!(await anonSees(lamp.id))) throw new Error("anonim göremiyor");
    must(await admin.supabase.from("listings").update({ featured: false }).eq("id", lamp.id), "vitrin geri");
  });

  // ------------------------------------------------------------ P1-02 sanctioned users
  const sanctioned = await tempUser("sanction");
  const hisListing = await newListing(sanctioned, `${MARK} sanctioned listing`);
  must(await sanctioned.supabase.from("profile_private").update({ phone: "+905550009911", whatsapp_enabled: true }).eq("id", sanctioned.id), "telefon");
  must(
    await admin.supabase
      .from("sanctions")
      .insert({ user_id: sanctioned.id, kind: "restrict", reason: MARK, created_by: admin.id, expires_at: new Date(Date.now() + 7 * 86400000).toISOString() }),
    "kısıtlama",
  );
  await check("P1-02: kısıtlı satıcının ilanı herkese gizli; sahibi ve admin görür; durum değişmez", async () => {
    if (await anonSees(hisListing.id)) throw new Error("anonim görüyor");
    const { data: other } = await buyer.supabase.from("listings").select("id").eq("id", hisListing.id);
    if (other?.length) throw new Error("başka kullanıcı görüyor");
    const { data: own } = await sanctioned.supabase.from("listings").select("id").eq("id", hisListing.id);
    if (!own?.length) throw new Error("sahibi göremiyor");
    if ((await statusOf(hisListing.id)).status !== "active") throw new Error("status kalıcı değişti");
  });
  await check("P1-02: kısıtlı kullanıcı ilan ekleyemez / düzenleyemez / fotoğraf ekleyemez", async () => {
    const notes = [
      await expectRefused(
        sanctioned.supabase.from("listings").insert({ seller_id: sanctioned.id, category_id: categoryId, title: `${MARK} blocked`, price: 1, city: "Girne", condition: "Sıfır", status: "pending" }).select("id"),
        "ilan ekleme",
      ),
      await expectRefused(sanctioned.supabase.from("listings").update({ price: 999 }).eq("id", hisListing.id).select("id"), "düzenleme"),
      await expectRefused(sanctioned.supabase.from("listing_images").insert({ listing_id: hisListing.id, path: `${sanctioned.id}/x.jpg`, position: 0 }).select("id"), "fotoğraf"),
    ];
    return notes.join(", ");
  });
  await check("P1-02: kısıtlı kullanıcı şikayet / inceleme talebi / konuşma açamaz", async () => {
    const notes = [
      await expectRefused(sanctioned.supabase.from("reports").insert({ reporter_id: sanctioned.id, listing_id: lamp.id, reason: "Spam", detail: MARK }).select("id"), "şikayet"),
      await expectRefused(sanctioned.supabase.from("verification_requests").insert({ user_id: sanctioned.id, kind: "phone", detail: "+905550009911" }).select("id"), "inceleme"),
      await expectRefused(sanctioned.supabase.from("conversations").insert({ listing_id: lamp.id, buyer_id: sanctioned.id, seller_id: seller.id }).select("id"), "konuşma"),
    ];
    return notes.join(", ");
  });
  await check("P1-02: kısıtlı satıcıyla konuşma açılamaz, WhatsApp numarası verilmez", async () => {
    const note = await expectRefused(
      buyer.supabase.from("conversations").insert({ listing_id: hisListing.id, buyer_id: buyer.id, seller_id: sanctioned.id }).select("id"),
      "konuşma",
    );
    const { data } = await buyer.supabase.rpc("get_listing_whatsapp", { p_listing: hisListing.id });
    if (data) throw new Error("numara verildi");
    return note;
  });
  await check("P1-02: kısıtlı kullanıcı destek talebiyle itiraz edebilir", async () => {
    must(
      await sanctioned.supabase.from("support_tickets").insert({ user_id: sanctioned.id, email: sanctioned.email, topic: "Kısıtlamaya itiraz", message: `${MARK} lütfen tekrar inceleyin` }),
      "destek",
    );
  });
  await check("P1-02: kısıtlama kaldırılınca ilan kendiliğinden yeniden görünür", async () => {
    must(await admin.supabase.from("sanctions").insert({ user_id: sanctioned.id, kind: "lift", reason: MARK, created_by: admin.id }), "kaldırma");
    if (!(await anonSees(hisListing.id))) throw new Error("görünmüyor");
  });
  // ==================================================================== Batch 3
  // ------------------------------------------------------------ P1-06 validation bypass through the API
  const base = { seller_id: seller.id, category_id: categoryId, description: MARK, price: 1, city: "Girne", condition: "Sıfır", status: "pending" };
  for (const [name, patch] of [
    ["boşluktan oluşan başlık", { title: "        " }],
    ["1 MB açıklama", { title: `${MARK} big`, description: "x".repeat(1024 * 1024) }],
    ["geçersiz şehir (Mars)", { title: `${MARK} mars`, city: "Mars" }],
    ["aşırı fiyat", { title: `${MARK} price`, price: 99999999999 }],
  ]) {
    await check(`P1-06: API'den ilan girdisi reddedilir: ${name}`, () =>
      expectRefused(seller.supabase.from("listings").insert({ ...base, ...patch }).select("id"), name),
    );
  }
  await check("P1-06: API'den profil ve telefon girdisi reddedilir (1 karakter ad, Mars bölgesi, geçersiz telefon)", async () => {
    const notes = [
      await expectRefused(buyer.supabase.from("profiles").update({ display_name: " x " }).eq("id", buyer.id).select("id"), "ad"),
      await expectRefused(buyer.supabase.from("profiles").update({ region: "Mars" }).eq("id", buyer.id).select("id"), "bölge"),
      await expectRefused(buyer.supabase.from("profile_private").update({ phone: "not-a-phone" }).eq("id", buyer.id).select("id"), "telefon"),
    ];
    return notes.join(", ");
  });
  await check("P1-06: anonim boş / geçersiz destek talebi reddedilir", async () => {
    // Anonymous users cannot read tickets, so no .select(): whether a row was
    // written is checked with the secret key instead.
    if (!service) throw new Error("SUPABASE_SECRET_KEY gerekli");
    const attempts = [
      ["boş", { email: "", topic: MARK, message: "" }],
      ["e-posta", { email: "not-an-email", topic: MARK, message: `${MARK} yeterince uzun` }],
      ["kısa", { email: "a@b.co", topic: MARK, message: "kısa" }],
    ];
    const codes = [];
    for (const [name, row] of attempts) {
      const { error } = await anon.from("support_tickets").insert(row);
      const { count } = await service.from("support_tickets").select("id", { count: "exact", head: true }).eq("topic", MARK);
      if (count) throw new Error(`${name}: talep kaydedildi`);
      codes.push(error?.code ?? "?");
    }
    return `reddedildi: ${codes.join(", ")}`;
  });
  await check("P1-06: API'den 2001 karakterlik ve boşluktan oluşan mesaj reddedilir", async () => {
    const chat = must(
      await buyer.supabase.from("conversations").insert({ listing_id: lamp.id, buyer_id: buyer.id, seller_id: seller.id }).select("id").single(),
      "konuşma",
    );
    conversationIds.add(chat.id);
    conversationLinks.add(`/mesajlar?c=${chat.id}`);
    const notes = [
      await expectRefused(buyer.supabase.from("messages").insert({ conversation_id: chat.id, sender_id: buyer.id, body: "x".repeat(2001) }).select("id"), "uzun"),
      await expectRefused(buyer.supabase.from("messages").insert({ conversation_id: chat.id, sender_id: buyer.id, body: "     " }).select("id"), "boş"),
    ];
    return notes.join(", ");
  });

  // ------------------------------------------------------------ P1-05 photo and listing limits
  await check("P1-05: API'den 11. fotoğraf reddedilir (23514)", async () => {
    const draft = await newListing(seller, `${MARK} photos`, { approve: false });
    must(
      await seller.supabase
        .from("listing_images")
        .insert(Array.from({ length: 10 }, (_, i) => ({ listing_id: draft.id, path: `${seller.id}/${MARK}-${i}.jpg`, position: i }))),
      "10 fotoğraf",
    );
    const { error } = await seller.supabase.from("listing_images").insert({ listing_id: draft.id, path: `${seller.id}/${MARK}-10.jpg`, position: 10 });
    if (error?.code !== "23514") throw new Error(`beklenen 23514, gelen: ${error?.code ?? "kabul edildi"}`);
  });
  await check("P1-05: günde 11. ilan PT429 (HTTP 429) ile reddedilir", async () => {
    const spammer = await tempUser("quota");
    for (let i = 0; i < 10; i++) await newListing(spammer, `${MARK} quota ${i}`, { approve: false });
    const { error } = await spammer.supabase
      .from("listings")
      .insert({ seller_id: spammer.id, category_id: categoryId, title: `${MARK} quota 11`, price: 1, city: "Girne", condition: "Sıfır", status: "pending" });
    if (error?.code !== "PT429") throw new Error(`beklenen PT429, gelen: ${error?.code ?? "kabul edildi"}`);
  });

  // ==================================================================== Batch 4
  // ------------------------------------------------------------ P1-07 rate limits
  // Throwaway accounts only, so the demo users used by e2e never hit a limit.
  const expect429 = (error, what) => {
    if (error?.code !== "PT429") throw new Error(`${what}: beklenen PT429, gelen: ${error?.code ?? "kabul edildi"}`);
    return `${what}: 429`;
  };
  const flooder = await tempUser("rate");
  await check("P1-07: dakikada 21. mesaj PT429 (HTTP 429) ile reddedilir", async () => {
    const chat = must(
      await flooder.supabase.from("conversations").insert({ listing_id: lamp.id, buyer_id: flooder.id, seller_id: seller.id }).select("id").single(),
      "konuşma",
    );
    conversationIds.add(chat.id);
    conversationLinks.add(`/mesajlar?c=${chat.id}`);
    for (let i = 0; i < 20; i++) {
      must(await flooder.supabase.from("messages").insert({ conversation_id: chat.id, sender_id: flooder.id, body: `${MARK} ${i}` }), `mesaj ${i}`);
    }
    const { error } = await flooder.supabase.from("messages").insert({ conversation_id: chat.id, sender_id: flooder.id, body: `${MARK} 21` });
    return expect429(error, "21. mesaj");
  });
  await check("P1-07: saatte 11. şikayet PT429 ile reddedilir", async () => {
    const { data: people } = await anon.from("profiles").select("id").neq("id", flooder.id).limit(6);
    const { data: listings } = await anon.from("listings").select("id").eq("status", "active").neq("seller_id", flooder.id).limit(11);
    const targets = [...people.map((p) => ({ reported_user_id: p.id })), ...listings.map((l) => ({ listing_id: l.id }))].slice(0, 11);
    if (targets.length < 11) throw new Error(`yeterli hedef yok (${targets.length})`);
    for (const target of targets.slice(0, 10)) {
      must(await flooder.supabase.from("reports").insert({ reporter_id: flooder.id, reason: "Spam", detail: MARK, ...target }), "şikayet");
    }
    const { error } = await flooder.supabase.from("reports").insert({ reporter_id: flooder.id, reason: "Spam", detail: MARK, ...targets[10] });
    return expect429(error, "11. şikayet");
  });
  await check("P1-07: günde 4. telefon doğrulama talebi PT429 ile reddedilir", async () => {
    for (let i = 0; i < 3; i++) {
      must(await flooder.supabase.from("verification_requests").insert({ user_id: flooder.id, kind: "phone", detail: `+90555000${1000 + i}` }), "talep");
    }
    const { error } = await flooder.supabase.from("verification_requests").insert({ user_id: flooder.id, kind: "phone", detail: "+905550009999" });
    return expect429(error, "4. talep");
  });
  await check("P1-07: saatte 6. destek talebi (üye) ve aynı e-postayla 4. anonim talep PT429", async () => {
    const ticket = { topic: MARK, message: `${MARK} yeterince uzun bir mesaj` };
    for (let i = 0; i < 5; i++) {
      must(await flooder.supabase.from("support_tickets").insert({ ...ticket, user_id: flooder.id, email: flooder.email }), "destek");
    }
    const member = expect429(
      (await flooder.supabase.from("support_tickets").insert({ ...ticket, user_id: flooder.id, email: flooder.email })).error,
      "6. üye talebi",
    );
    const email = `${MARK}-anon-${Date.now()}@example.com`;
    for (let i = 0; i < 3; i++) must(await anon.from("support_tickets").insert({ ...ticket, email }), "anonim destek");
    const guest = expect429((await anon.from("support_tickets").insert({ ...ticket, email: email.toUpperCase() })).error, "4. anonim talep");
    return `${member}, ${guest}`;
  });
  await check("P1-07: saatte 31. WhatsApp numarası sorgusu PT429; tablo istemciye kapalı", async () => {
    for (let i = 0; i < 30; i++) must(await flooder.supabase.rpc("get_listing_whatsapp", { p_listing: lamp.id }), `sorgu ${i}`);
    const { error } = await flooder.supabase.rpc("get_listing_whatsapp", { p_listing: lamp.id });
    const note = expect429(error, "31. sorgu");
    const { data, error: readError } = await flooder.supabase.from("rate_limit_events").select("id");
    if (!readError && data?.length) throw new Error("rate_limit_events okunabiliyor");
    return note;
  });

  // ==================================================================== Batch 5
  // ------------------------------------------------------------ P1-08 abuse evidence
  const scammer = await tempUser("scammer");
  const witness = await tempUser("witness");
  const scamListing = await newListing(scammer, `${MARK} scam listing`);
  await check("P1-08: ilan silinince şikayet ve ilanın kaydı (snapshot) kalır", async () => {
    const r = must(
      await witness.supabase.from("reports").insert({ reporter_id: witness.id, listing_id: scamListing.id, reason: "Dolandırıcılık", detail: MARK }).select("id").single(),
      "şikayet",
    );
    must(await scammer.supabase.from("listings").delete().eq("id", scamListing.id).select("id"), "ilanı sil");
    const kept = must(await service.from("reports").select("listing_id, target_snapshot").eq("id", r.id).maybeSingle(), "şikayet oku");
    if (!kept) throw new Error("şikayet ilanla birlikte silindi");
    if (kept.listing_id !== null || kept.target_snapshot?.listing?.title !== `${MARK} scam listing`) throw new Error(JSON.stringify(kept));
  });
  await check("P1-08: aynı hedefe ikinci açık şikayet 23505; kendini şikayet 23514; sahte durum pending olur", async () => {
    const first = must(
      await witness.supabase.from("reports").insert({ reporter_id: witness.id, reported_user_id: scammer.id, reason: "Spam", detail: MARK, status: "resolved" }).select("status").single(),
      "şikayet",
    );
    if (first.status !== "pending") throw new Error(`durum sahtelendi: ${first.status}`);
    const dup = await witness.supabase.from("reports").insert({ reporter_id: witness.id, reported_user_id: scammer.id, reason: "Yine spam", detail: MARK });
    if (dup.error?.code !== "23505") throw new Error(`ikinci şikayet: ${dup.error?.code ?? "kabul edildi"}`);
    const self = await scammer.supabase.from("reports").insert({ reporter_id: scammer.id, reported_user_id: scammer.id, reason: "Spam", detail: MARK });
    if (self.error?.code !== "23514") throw new Error(`kendini şikayet: ${self.error?.code ?? "kabul edildi"}`);
    return "23505, 23514";
  });
  await check("P1-08: kısıtlı hesap kendini silemez (PT403)", async () => {
    must(await admin.supabase.from("sanctions").insert({ user_id: scammer.id, kind: "suspend", reason: MARK, created_by: admin.id }), "askıya al");
    const { error } = await scammer.supabase.rpc("delete_my_account");
    if (error?.code !== "PT403") throw new Error(`beklenen PT403, gelen: ${error?.code ?? "hesap silindi"}`);
    must(await admin.supabase.from("sanctions").insert({ user_id: scammer.id, kind: "lift", reason: MARK, created_by: admin.id }), "kaldır");
  });
  await check("P1-08: hesap silinince hakkındaki şikayet ve yaptırım geçmişi kalır", async () => {
    must(await scammer.supabase.rpc("delete_my_account"), "hesabı sil");
    const { data: reports } = await service.from("reports").select("reported_user_id, target_snapshot").like("detail", `${MARK}%`).eq("reason", "Spam");
    const aboutHim = (reports ?? []).filter((r) => r.target_snapshot?.user?.id === scammer.id);
    if (!aboutHim.length || aboutHim.some((r) => r.reported_user_id !== null)) throw new Error(`şikayet: ${JSON.stringify(reports)}`);
    const { data: sanctions } = await service.from("sanctions").select("user_id, subject_name").eq("subject_user_id", scammer.id);
    if ((sanctions ?? []).length < 2 || sanctions.some((s) => s.user_id !== null)) throw new Error(`yaptırım: ${JSON.stringify(sanctions)}`);
    return `${aboutHim.length} şikayet, ${sanctions.length} yaptırım korundu`;
  });
} catch (e) {
  kit.results.push(["✗", `Kurulum adımı başarısız, kalan kontroller çalışmadı: ${e.message}`]);
} finally {
  // ------------------------------------------------------------ cleanup
  for (const id of listingIds) await admin.supabase.from("listings").delete().eq("id", id);
  // Rows a refused-but-accepted (pre-migration) check may have written.
  await admin.supabase.from("listings").delete().eq("seller_id", seller.id).or(`title.ilike.${MARK}%,description.eq.${MARK}`);
  if (buyerProfile) await buyer.supabase.from("profiles").update(buyerProfile).eq("id", buyer.id);
  await buyer.supabase.from("profile_private").update({ phone: buyerPhone }).eq("id", buyer.id);
  if (service) {
    await service.from("support_tickets").delete().like("message", `${MARK}%`);
    await service.from("support_tickets").delete().eq("topic", MARK);
    await service.from("sanctions").delete().eq("reason", MARK);
    // Reports outlive their listing and reporter (P1-08), so test reports are marked and removed here.
    await service.from("reports").delete().like("detail", `${MARK}%`);
  }
  await seller.supabase.from("notifications").delete().like("link", `/ilan/${MARK}-%`).gte("created_at", STARTED);
  if (conversationLinks.size) {
    for (const u of [seller, buyer]) await u.supabase.from("notifications").delete().in("link", [...conversationLinks]);
  }
  // Conversations may outlive a deleted account (P1-09), so remove them by id.
  if (service && conversationIds.size) await service.from("conversations").delete().in("id", [...conversationIds]);
  const tempLeft = service ? await removeTempUsers() : ["SUPABASE_SECRET_KEY yok"];

  const left = [...tempLeft];
  const { count: l } = await admin.supabase.from("listings").select("id", { count: "exact", head: true }).or(`title.ilike.${MARK}%,description.eq.${MARK}`);
  if (l) left.push(`${l} ilan`);
  const { data: bp } = await buyer.supabase.from("profiles").select("display_name, region").eq("id", buyer.id).single();
  if (JSON.stringify(bp) !== JSON.stringify(buyerProfile)) left.push("mert profili geri yüklenmedi");
  const { count: n } = await seller.supabase.from("notifications").select("id", { count: "exact", head: true }).like("link", `/ilan/${MARK}-%`).gte("created_at", STARTED);
  if (n) left.push(`${n} bildirim`);
  if (conversationLinks.size) {
    const { count: cn } = await seller.supabase.from("notifications").select("id", { count: "exact", head: true }).in("link", [...conversationLinks]);
    if (cn) left.push(`${cn} mesaj bildirimi`);
  }
  if (service) {
    const { count: t } = await service.from("support_tickets").select("id", { count: "exact", head: true }).or(`message.like.${MARK}%,topic.eq.${MARK}`);
    const { count: s } = await service.from("sanctions").select("id", { count: "exact", head: true }).eq("reason", MARK);
    if (t) left.push(`${t} destek talebi`);
    if (s) left.push(`${s} yaptırım`);
    const { count: r } = await service.from("reports").select("id", { count: "exact", head: true }).like("detail", `${MARK}%`);
    if (r) left.push(`${r} şikayet`);
    if (conversationIds.size) {
      const { count: c } = await service.from("conversations").select("id", { count: "exact", head: true }).in("id", [...conversationIds]);
      if (c) left.push(`${c} konuşma`);
    }
  }
  kit.results.push(left.length ? ["✗", `Test verisi temizlenemedi: ${left.join(", ")}`] : ["✓", "Test verisi temizlendi (kalıntı yok)"]);
  await Promise.all([seller, buyer, admin].map((u) => u.supabase.auth.signOut()));
}

process.exit(kit.report("P1 güvenlik kontrolleri:") ? 1 : 0);
