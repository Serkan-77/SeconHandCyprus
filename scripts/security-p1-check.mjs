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
} catch (e) {
  kit.results.push(["✗", `Kurulum adımı başarısız, kalan kontroller çalışmadı: ${e.message}`]);
} finally {
  // ------------------------------------------------------------ cleanup
  for (const id of listingIds) await admin.supabase.from("listings").delete().eq("id", id);
  if (service) {
    await service.from("support_tickets").delete().like("message", `${MARK}%`);
    await service.from("sanctions").delete().eq("reason", MARK);
    // Reports outlive their listing and reporter (P1-08), so test reports are marked and removed here.
    await service.from("reports").delete().like("detail", `${MARK}%`);
  }
  await seller.supabase.from("notifications").delete().like("link", `/ilan/${MARK}-%`).gte("created_at", STARTED);
  const tempLeft = service ? await removeTempUsers() : ["SUPABASE_SECRET_KEY yok"];

  const left = [...tempLeft];
  const { count: l } = await admin.supabase.from("listings").select("id", { count: "exact", head: true }).ilike("title", `${MARK}%`);
  if (l) left.push(`${l} ilan`);
  const { count: n } = await seller.supabase.from("notifications").select("id", { count: "exact", head: true }).like("link", `/ilan/${MARK}-%`).gte("created_at", STARTED);
  if (n) left.push(`${n} bildirim`);
  if (service) {
    const { count: t } = await service.from("support_tickets").select("id", { count: "exact", head: true }).like("message", `${MARK}%`);
    const { count: s } = await service.from("sanctions").select("id", { count: "exact", head: true }).eq("reason", MARK);
    if (t) left.push(`${t} destek talebi`);
    if (s) left.push(`${s} yaptırım`);
    const { count: r } = await service.from("reports").select("id", { count: "exact", head: true }).like("detail", `${MARK}%`);
    if (r) left.push(`${r} şikayet`);
  }
  kit.results.push(left.length ? ["✗", `Test verisi temizlenemedi: ${left.join(", ")}`] : ["✓", "Test verisi temizlendi (kalıntı yok)"]);
  await Promise.all([seller, buyer, admin].map((u) => u.supabase.auth.signOut()));
}

process.exit(kit.report("P1 güvenlik kontrolleri:") ? 1 : 0);
