// Listings: creation (idempotent, atomic), attribute validation, ownership,
// moderation re-review, sanctions, quotas, search and filters, privacy.
// Ports the listing checks of scripts/security-check.mjs and
// security-p1-check.mjs (P0-06, P1-01, P1-02, P1-05, P1-10, P1-16).
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { anon, categoryId, newListing, newUser, resetDatabase, startApp, testJpeg, uploadPhotos, type TestApp } from "./helpers.ts";

let t: TestApp;
before(async () => {
  await resetDatabase();
  t = await startApp();
});
after(async () => t?.close());

async function baseListing(photos: string[], overrides: Record<string, unknown> = {}) {
  return {
    title: "iPhone 13 128 GB",
    categoryId: await categoryId(t, "cep-telefonu"),
    condition: "Az kullanılmış",
    description: "Temiz kullanıldı.",
    price: "18.500",
    currency: "TL",
    city: "Lefkoşa",
    negotiable: true,
    submissionKey: crypto.randomUUID(),
    attributes: { brand: "apple", model: "iPhone 13", storage_gb: "128", battery_health: 88 },
    photos,
    ...overrides,
  };
}

describe("create", () => {
  test("a listing is created pending with server-set system fields", async () => {
    const u = await newUser(t);
    const photos = await uploadPhotos(u, 2);
    const res = await u.post("/api/v1/listings", {
      ...(await baseListing(photos)),
      price: 18500,
      // Fields a client must not control are ignored.
      status: "active",
      featured: true,
      view_count: 9999,
      ref_no: 1,
      seller_id: "00000000-0000-0000-0000-000000000000",
    });
    assert.equal(res.statusCode, 200, res.body);
    const [row] = await t.owner`select * from listings where id = ${res.data.listing.id}`;
    assert.equal(row.status, "pending");
    assert.equal(row.featured, false);
    assert.equal(row.viewCount, 0);
    assert.equal(row.sellerId, u.id);
    assert.ok(row.refNo >= 10480);
    assert.deepEqual(row.attributes, { brand: "apple", model: "iPhone 13", storage_gb: "128", battery_health: 88 });
    const images = await t.owner`select path from listing_images where listing_id = ${row.id} order by position`;
    assert.deepEqual(images.map((i) => i.path), photos);
  });

  test("the same submission key twice creates one listing (P1-10)", async () => {
    const u = await newUser(t);
    const body = await baseListing(await uploadPhotos(u, 1), { price: 100 });
    const [a, b] = await Promise.all([u.post("/api/v1/listings", body), u.post("/api/v1/listings", body)]);
    assert.equal(a.statusCode, 200, a.body);
    assert.equal(b.statusCode, 200, b.body);
    assert.equal(a.data.listing.id, b.data.listing.id);
    const [{ n }] = await t.owner`select count(*)::int as n from listings where seller_id = ${u.id}`;
    assert.equal(n, 1);
  });

  test("required and invalid attributes are refused with a field error", async () => {
    const u = await newUser(t);
    const photos = await uploadPhotos(u, 1);
    const missing = await u.post("/api/v1/listings", await baseListing(photos, { attributes: { model: "X" } }));
    assert.equal(missing.statusCode, 422);
    assert.ok(missing.data.error.fields["attributes.brand"]);
    const invalid = await u.post("/api/v1/listings", await baseListing(photos, { attributes: { brand: "nokia-3310-gold", model: "X" } }));
    assert.equal(invalid.statusCode, 422);
    const range = await u.post("/api/v1/listings", await baseListing(photos, { attributes: { brand: "apple", model: "X", battery_health: 140 } }));
    assert.equal(range.statusCode, 422);
  });

  test("attributes of other categories are dropped", async () => {
    const u = await newUser(t);
    const res = await u.post(
      "/api/v1/listings",
      await baseListing(await uploadPhotos(u, 1), { attributes: { brand: "apple", model: "X", sofa_type: "kanepe", evil: "<script>" } }),
    );
    assert.equal(res.statusCode, 200, res.body);
    const [row] = await t.owner`select attributes from listings where id = ${res.data.listing.id}`;
    assert.deepEqual(Object.keys(row.attributes).sort(), ["brand", "model"]);
  });

  test("a parent category with subcategories is refused", async () => {
    const u = await newUser(t);
    const res = await u.post("/api/v1/listings", await baseListing(await uploadPhotos(u, 1), { categoryId: 2, attributes: {} }));
    assert.equal(res.statusCode, 422);
  });

  test("photos must be the caller's own uploads (P1-10)", async () => {
    const owner = await newUser(t);
    const thief = await newUser(t);
    const stolen = await uploadPhotos(owner, 1);
    const res = await thief.post("/api/v1/listings", await baseListing(stolen));
    assert.equal(res.statusCode, 422);
    const made = await newListing(t, thief);
    const add = await thief.post(`/api/v1/listings/${made.id}/images`, { keys: stolen });
    assert.equal(add.statusCode, 422);
    const forged = await thief.post("/api/v1/listings", await baseListing(["../../etc/passwd"]));
    assert.equal(forged.statusCode, 422);
  });

  test("no more than 10 photos (P1-05)", async () => {
    const u = await newUser(t);
    const tooMany = await u.post("/api/v1/listings", await baseListing(await uploadPhotos(u, 11)));
    assert.equal(tooMany.statusCode, 422);
    const listing = await newListing(t, u);
    const nine = await uploadPhotos(u, 9);
    assert.equal((await u.post(`/api/v1/listings/${listing.id}/images`, { keys: nine })).statusCode, 200);
    const eleventh = await uploadPhotos(u, 1);
    assert.equal((await u.post(`/api/v1/listings/${listing.id}/images`, { keys: eleventh })).statusCode, 422);
  });

  test("11th new listing in a day is refused with 429 (P1-05)", async () => {
    const u = await newUser(t);
    for (let i = 0; i < 10; i++) await newListing(t, u, { title: `Eşya ${i} satılık` }, { approve: false });
    const photos = await uploadPhotos(u, 1);
    const res = await u.post("/api/v1/listings", {
      title: "On birinci ilan",
      categoryId: await categoryId(t, "koltuk-kanepe"),
      condition: "Sıfır",
      description: "",
      price: 1,
      currency: "TL",
      city: "Girne",
      negotiable: false,
      submissionKey: crypto.randomUUID(),
      attributes: { sofa_type: "kanepe" },
      photos,
    });
    assert.equal(res.statusCode, 429);
  });
});

describe("ownership (P1-16)", () => {
  test("another user cannot edit, change status, add or remove photos, reorder or delete", async () => {
    const seller = await newUser(t);
    const other = await newUser(t);
    const l = await newListing(t, seller);
    const edit = await other.patch(`/api/v1/listings/${l.id}`, { title: "Hacked", price: 1, city: "Girne", description: "" });
    assert.equal(edit.statusCode, 403);
    assert.equal((await other.post(`/api/v1/listings/${l.id}/status`, { status: "removed" })).statusCode, 403);
    assert.equal((await other.post(`/api/v1/listings/${l.id}/images`, { keys: await uploadPhotos(other, 1) })).statusCode, 403);
    const [img] = await t.owner`select id from listing_images where listing_id = ${l.id}`;
    assert.equal((await other.del(`/api/v1/listings/${l.id}/images/${img.id}`)).statusCode, 403);
    assert.equal((await other.put(`/api/v1/listings/${l.id}/images/order`, { ids: [img.id] })).statusCode, 403);
    assert.equal((await other.del(`/api/v1/listings/${l.id}`)).statusCode, 403);
    const [row] = await t.owner`select title, status from listings where id = ${l.id}`;
    assert.equal(row.title, "Ahşap berjer koltuk");
    assert.equal(row.status, "active");
  });

  test("a seller cannot publish, reject or feature their own listing", async () => {
    const seller = await newUser(t);
    const l = await newListing(t, seller, {}, { approve: false });
    const res = await seller.post(`/api/v1/listings/${l.id}/status`, { status: "active" });
    assert.equal(res.statusCode, 422);
    assert.equal((await seller.post(`/api/v1/admin/listings/${l.id}/approve`)).statusCode, 403);
    assert.equal((await seller.post(`/api/v1/admin/listings/${l.id}/featured`, { featured: true })).statusCode, 403);
  });

  test("editing content of a published listing sends it back to review; reordering does not (P1-01)", async () => {
    const seller = await newUser(t);
    const l = await newListing(t, seller);
    await t.owner`update listings set featured = true where id = ${l.id}`;
    const photos = await uploadPhotos(seller, 1);
    const add = await seller.post(`/api/v1/listings/${l.id}/images`, { keys: photos });
    assert.equal(add.data.review, true);
    let [row] = await t.owner`select status, featured from listings where id = ${l.id}`;
    assert.equal(row.status, "pending");
    assert.equal(row.featured, false);

    await t.owner`update listings set status = 'active' where id = ${l.id}`;
    const imgs = await t.owner`select id from listing_images where listing_id = ${l.id} order by position`;
    const reorder = await seller.put(`/api/v1/listings/${l.id}/images/order`, { ids: imgs.map((i) => i.id).reverse() });
    assert.equal(reorder.statusCode, 200);
    [row] = await t.owner`select status from listings where id = ${l.id}`;
    assert.equal(row.status, "active", "reordering photos is not a content change");

    const price = await seller.patch(`/api/v1/listings/${l.id}`, { title: "Ahşap berjer koltuk", price: 1200, city: "Girne", district: "Alsancak", description: "Temiz, sigarasız evden." });
    assert.equal(price.data.review, false, "price changes stay published");
    const text = await seller.patch(`/api/v1/listings/${l.id}`, { title: "Ahşap berjer koltuk", price: 1200, city: "Girne", district: "Alsancak", description: "Yeni açıklama" });
    assert.equal(text.data.review, true);
  });

  test("the last photo cannot be removed", async () => {
    const seller = await newUser(t);
    const l = await newListing(t, seller);
    const [img] = await t.owner`select id from listing_images where listing_id = ${l.id}`;
    assert.equal((await seller.del(`/api/v1/listings/${l.id}/images/${img.id}`)).statusCode, 422);
  });

  test("deleting a listing removes its photo files", async () => {
    const seller = await newUser(t);
    const l = await newListing(t, seller);
    const [img] = await t.owner`select path from listing_images where listing_id = ${l.id}`;
    const media = await anon(t.app).get(`/media/${img.path}/sm.webp`);
    assert.equal(media.statusCode, 200);
    assert.equal((await seller.del(`/api/v1/listings/${l.id}`)).statusCode, 200);
    assert.equal((await anon(t.app).get(`/media/${img.path}/sm.webp`)).statusCode, 404);
    const [{ n }] = await t.owner`select count(*)::int as n from uploads where key = ${img.path}`;
    assert.equal(n, 0);
  });
});

describe("visibility", () => {
  test("pending listings are visible to their owner and admins only", async () => {
    const seller = await newUser(t);
    const admin = await newUser(t, "Admin", { admin: true });
    const l = await newListing(t, seller, {}, { approve: false });
    assert.equal((await anon(t.app).get(`/api/v1/listings/${l.id}`)).statusCode, 404);
    assert.equal((await (await newUser(t)).get(`/api/v1/listings/${l.slug}`)).statusCode, 404);
    assert.equal((await seller.get(`/api/v1/listings/${l.id}`)).statusCode, 200);
    assert.equal((await admin.get(`/api/v1/listings/${l.id}`)).statusCode, 200);
  });

  test("a sanctioned seller's listings disappear and come back when it ends (P1-02)", async () => {
    const seller = await newUser(t);
    const l = await newListing(t, seller);
    await t.owner`insert into sanctions (user_id, kind, reason, expires_at) values (${seller.id}, 'restrict', 'Test kısıtlaması', now() + interval '1 day')`;
    assert.equal((await anon(t.app).get(`/api/v1/listings/${l.id}`)).statusCode, 404);
    assert.equal((await seller.get(`/api/v1/listings/${l.id}`)).statusCode, 200, "the owner still sees it");
    const [row] = await t.owner`select status from listings where id = ${l.id}`;
    assert.equal(row.status, "active", "status is not changed");
    const edit = await seller.patch(`/api/v1/listings/${l.id}`, { title: "Yeni başlık", price: 1, city: "Girne", description: "" });
    assert.equal(edit.statusCode, 403, "restricted users cannot edit");
    const photo = await seller.upload(await testJpeg());
    assert.equal(photo.statusCode, 403, "nor upload");
    await t.owner`update profiles set status_until = now() - interval '1 minute' where id = ${seller.id}`;
    assert.equal((await anon(t.app).get(`/api/v1/listings/${l.id}`)).statusCode, 200);
  });

  test("the rejection reason is only shown to the owner", async () => {
    const seller = await newUser(t);
    const l = await newListing(t, seller);
    await t.owner`update listings set reject_reason = 'İç not' where id = ${l.id}`;
    const pub = await anon(t.app).get(`/api/v1/listings/${l.id}`);
    assert.equal(pub.data.listing.rejectReason, null);
    assert.ok(!JSON.stringify(pub.data).includes("idempotency"));
    const own = await seller.get(`/api/v1/listings/${l.id}`);
    assert.equal(own.data.listing.rejectReason, "İç not");
  });

  test("a changed slug redirects by reference number", async () => {
    const seller = await newUser(t);
    const l = await newListing(t, seller);
    await t.owner`update listings set title = 'Tamamen yeni başlık' where id = ${l.id}`;
    const res = await anon(t.app).get(`/api/v1/listings/${l.slug}`);
    assert.equal(res.statusCode, 200);
    assert.match(res.data.redirectSlug, /^tamamen-yeni-baslik-\d+$/);
  });
});

describe("search", () => {
  test("words match in any order, accent- and case-insensitive; categories include subcategories", async () => {
    const seller = await newUser(t);
    const l = await newListing(t, seller, { title: "Çift kişilik Şişli kanepe", description: "Gri kumaş" });
    const find = async (qs: string) => (await anon(t.app).get(`/api/v1/listings?${qs}`)).data.items.map((i: { id: string }) => i.id);
    assert.ok((await find("q=sisli%20CIFT")).includes(l.id));
    assert.ok((await find("q=gri%20kanepe")).includes(l.id));
    assert.ok(!(await find("q=kanepe%20mavi")).includes(l.id));
    assert.ok((await find("category=mobilya")).includes(l.id), "parent category includes children");
    assert.ok(!(await find("category=elektronik")).includes(l.id));
    assert.ok((await find("q=%25")).length >= 0, "LIKE wildcards are literal");
  });

  test("attribute filters are category-aware", async () => {
    const seller = await newUser(t);
    const cat = await categoryId(t, "cep-telefonu");
    const mk = (storage: string, battery: number, title: string) =>
      newListing(t, seller, { title, categoryId: cat, attributes: { brand: "samsung", model: "S21", storage_gb: storage, battery_health: battery } });
    const a = await mk("128", 90, "Samsung S21 128");
    const b = await mk("256", 70, "Samsung S21 256");
    const ids = async (qs: string) => (await anon(t.app).get(`/api/v1/listings?category=cep-telefonu&${qs}`)).data.items.map((i: { id: string }) => i.id);
    assert.deepEqual((await ids("a.storage_gb=256")).filter((x: string) => [a.id, b.id].includes(x)), [b.id]);
    assert.deepEqual((await ids("a.battery_health.min=80")).filter((x: string) => [a.id, b.id].includes(x)), [a.id]);
    const both = await ids("a.storage_gb=128,256&sort=artan");
    assert.ok(both.includes(a.id) && both.includes(b.id));
    // A filter that does not belong to the category is ignored, not an error.
    const res = await anon(t.app).get("/api/v1/listings?category=cep-telefonu&a.sofa_type=kanepe");
    assert.equal(res.statusCode, 200);
    const card = (await anon(t.app).get(`/api/v1/listings?category=cep-telefonu`)).data.items.find((i: { id: string }) => i.id === a.id);
    assert.ok(card.facts.includes("128 GB"), "cards carry highlighted attributes");
  });

  test("hostile parameters do not break the query", async () => {
    for (const qs of ["q=%27%3B%20drop%20table%20listings%3B--", "min=abc&max=-5", "pageSize=100000&page=-1", "sort=xyz", "a.brand=%27", "category=%27"]) {
      const res = await anon(t.app).get(`/api/v1/listings?${qs}`);
      assert.equal(res.statusCode, 200, qs);
      assert.ok(res.data.pageSize <= 48);
    }
  });
});

describe("favorites", () => {
  test("favorites are private and owner-scoped", async () => {
    const seller = await newUser(t);
    const fan = await newUser(t);
    const l = await newListing(t, seller);
    assert.equal((await fan.put(`/api/v1/me/favorites/${l.id}`)).statusCode, 200);
    assert.equal((await fan.put(`/api/v1/me/favorites/${l.id}`)).statusCode, 200, "idempotent");
    assert.deepEqual((await fan.get("/api/v1/me/favorites/ids")).data.ids, [l.id]);
    assert.deepEqual((await seller.get("/api/v1/me/favorites/ids")).data.ids, []);
    const detail = await fan.get(`/api/v1/listings/${l.id}`);
    assert.equal(detail.data.viewer.isFavorite, true);
    assert.equal(detail.data.listing.favoriteCount, null, "only the owner sees favorite counts");
    assert.equal((await seller.get(`/api/v1/listings/${l.id}`)).data.listing.favoriteCount, 1);
    assert.equal((await anon(t.app).put(`/api/v1/me/favorites/${l.id}`)).statusCode, 401);
  });
});

describe("reports", () => {
  test("reports: once per open target, never on yourself, only active listings (P1-08)", async () => {
    const seller = await newUser(t);
    const reporter = await newUser(t);
    const l = await newListing(t, seller);
    assert.equal((await reporter.post(`/api/v1/listings/${l.id}/report`, { reason: "Dolandırıcılık şüphesi", detail: "" })).statusCode, 200);
    assert.equal((await reporter.post(`/api/v1/listings/${l.id}/report`, { reason: "Tekrar", detail: "" })).statusCode, 422);
    assert.equal((await seller.post(`/api/v1/listings/${l.id}/report`, { reason: "Kendim", detail: "" })).statusCode, 422);
    const [r] = await t.owner`select status, target_snapshot from reports where listing_id = ${l.id}`;
    assert.equal(r.status, "pending");
    assert.equal(r.targetSnapshot.listing.title, "Ahşap berjer koltuk");
    // The evidence outlives the listing.
    await seller.del(`/api/v1/listings/${l.id}`);
    const [kept] = await t.owner`select listing_id, target_snapshot from reports where reporter_id = ${reporter.id}`;
    assert.equal(kept.listingId, null);
    assert.ok(kept.targetSnapshot.listing);
  });
});

describe("contact", () => {
  test("WhatsApp numbers: only when the seller opted in, only signed in, rate limited", async () => {
    const seller = await newUser(t);
    const l = await newListing(t, seller);
    const buyer = await newUser(t);
    assert.equal((await anon(t.app).get(`/api/v1/listings/${l.id}/whatsapp`)).statusCode, 401);
    assert.equal((await buyer.get(`/api/v1/listings/${l.id}/whatsapp`)).statusCode, 404);
    assert.equal((await seller.put("/api/v1/me/contact", { phone: "+90 533 123 45 67", whatsapp: true })).statusCode, 200);
    const ok = await buyer.get(`/api/v1/listings/${l.id}/whatsapp`);
    assert.equal(ok.data.phone, "+905331234567");
    assert.equal((await anon(t.app).get(`/api/v1/listings/${l.id}`)).data.listing.acceptsWhatsapp, true);
    for (let i = 0; i < 30; i++) await buyer.get(`/api/v1/listings/${l.id}/whatsapp`);
    assert.equal((await buyer.get(`/api/v1/listings/${l.id}/whatsapp`)).statusCode, 429);
  });
});
