// Admin API: every route refuses non-admins (vertical privilege escalation),
// admin actions work and are audited, and admin safety rails hold.
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { anon, asDbUser, newListing, newUser, resetDatabase, startApp, type TestApp } from "./helpers.ts";

let t: TestApp;
before(async () => {
  await resetDatabase();
  t = await startApp();
});
after(async () => t?.close());

const ID = "00000000-0000-4000-8000-000000000000";
const ADMIN_ROUTES: [string, string, unknown?][] = [
  ["GET", "/api/v1/admin/dashboard"],
  ["GET", "/api/v1/admin/listings"],
  ["GET", `/api/v1/admin/listings/${ID}`],
  ["POST", `/api/v1/admin/listings/${ID}/approve`],
  ["POST", `/api/v1/admin/listings/${ID}/reject`, { reason: "Kurallara aykırı" }],
  ["POST", `/api/v1/admin/listings/${ID}/featured`, { featured: true }],
  ["PUT", `/api/v1/admin/listings/${ID}`, {}],
  ["DELETE", `/api/v1/admin/listings/${ID}`],
  ["DELETE", `/api/v1/admin/listing-images/${ID}`],
  ["GET", "/api/v1/admin/users"],
  ["GET", `/api/v1/admin/users/${ID}`],
  ["PUT", `/api/v1/admin/users/${ID}`, {}],
  ["DELETE", `/api/v1/admin/users/${ID}`],
  ["POST", `/api/v1/admin/users/${ID}/sanctions`, { kind: "suspend", reason: "Deneme deneme" }],
  ["POST", `/api/v1/admin/users/${ID}/sign-out`],
  ["DELETE", `/api/v1/admin/ratings/${ID}`],
  ["GET", "/api/v1/admin/reports"],
  ["GET", `/api/v1/admin/reports/${ID}`],
  ["POST", `/api/v1/admin/reports/${ID}/status`, { status: "resolved" }],
  ["GET", "/api/v1/admin/verifications"],
  ["POST", `/api/v1/admin/verifications/${ID}`, { approve: true }],
  ["GET", "/api/v1/admin/support"],
  ["POST", `/api/v1/admin/support/${ID}/close`],
  ["GET", "/api/v1/admin/announcements"],
  ["POST", "/api/v1/admin/announcements", { audience: "Tüm kullanıcılar", title: "Duyuru", body: "Metin" }],
  ["GET", "/api/v1/admin/categories"],
  ["POST", "/api/v1/admin/categories", { name: "Yeni kategori" }],
  ["PUT", "/api/v1/admin/categories/1", { name: "Mobilya" }],
  ["DELETE", "/api/v1/admin/categories/1"],
  ["POST", "/api/v1/admin/attributes", { categoryId: 1, key: "x_key", label: "X", type: "text" }],
  ["PUT", "/api/v1/admin/attributes/1", {}],
  ["DELETE", "/api/v1/admin/attributes/1"],
  ["GET", "/api/v1/admin/audit"],
];

describe("access", () => {
  test("anonymous callers get 401 and users get 403 on every admin route", async () => {
    const user = await newUser(t);
    for (const [method, url, body] of ADMIN_ROUTES) {
      const a = await anon(t.app).request(method, url, body);
      assert.equal(a.statusCode, 401, `${method} ${url} (anon)`);
      const u = await user.request(method, url, body);
      assert.equal(u.statusCode, 403, `${method} ${url} (user)`);
    }
    const [{ n }] = await t.owner`select count(*)::int as n from categories where name = 'Yeni kategori'`;
    assert.equal(n, 0);
  });

  test("a user cannot make themselves admin, verified or unrestricted (profile guard)", async () => {
    const u = await newUser(t);
    await t.owner`insert into sanctions (user_id, kind, reason, expires_at) values (${u.id}, 'restrict', 'Deneme kısıtlama', now() + interval '1 day')`;
    await asDbUser(u.id, "user", (sql) => sql`
      update profiles set role = 'admin', status = 'active', status_until = null, phone_verified = true,
        store_verified = true, account_type = 'store', store_name = 'Sahte Mağaza'
      where id = ${u.id}`);
    const [p] = await t.owner`select role, status, phone_verified, store_verified from profiles where id = ${u.id}`;
    assert.equal(p.role, "user");
    assert.equal(p.status, "restricted");
    assert.equal(p.phoneVerified, false);
    assert.equal(p.storeVerified, false);
  });

  test("the profile API does not accept role or status fields", async () => {
    const u = await newUser(t);
    const res = await u.patch("/api/v1/me/profile", { name: "Normal Ad", region: "Girne", role: "admin", status: "active" });
    assert.equal(res.statusCode, 200);
    const [p] = await t.owner`select role from profiles where id = ${u.id}`;
    assert.equal(p.role, "user");
  });
});

describe("moderation", () => {
  test("approve, reject with reason, feature, and the audit trail", async () => {
    const admin = await newUser(t, "Yönetici", { admin: true });
    const seller = await newUser(t);
    const l = await newListing(t, seller, {}, { approve: false });
    assert.equal((await admin.post(`/api/v1/admin/listings/${l.id}/featured`, { featured: true })).statusCode, 422, "only active listings");
    assert.equal((await admin.post(`/api/v1/admin/listings/${l.id}/approve`)).statusCode, 200);
    assert.equal((await admin.post(`/api/v1/admin/listings/${l.id}/featured`, { featured: true })).statusCode, 200);
    const notif = await seller.get("/api/v1/me/notifications");
    assert.ok(notif.data.items.some((n: { title: string }) => n.title === "İlanın yayına alındı"));
    assert.equal((await admin.post(`/api/v1/admin/listings/${l.id}/reject`, { reason: "Yasaklı ürün", note: "Satışı yasak." })).statusCode, 200);
    const [row] = await t.owner`select status, reject_reason, featured from listings where id = ${l.id}`;
    assert.equal(row.status, "rejected");
    assert.equal(row.rejectReason, "Yasaklı ürün. Satışı yasak.");
    assert.equal(row.featured, false, "leaving active drops the showcase");
    const audit = await admin.get("/api/v1/admin/audit");
    const actions = audit.data.items.filter((a: { targetId: string }) => a.targetId === l.id).map((a: { action: string }) => a.action);
    assert.deepEqual(actions.sort(), ["listing.approve", "listing.feature", "listing.reject"].sort());
  });

  test("admin edits keep the listing published and may re-categorise", async () => {
    const admin = await newUser(t, "Yönetici", { admin: true });
    const seller = await newUser(t);
    const l = await newListing(t, seller);
    const [cat] = await t.owner`select id from categories where slug = 'masa-sandalye'`;
    const res = await admin.put(`/api/v1/admin/listings/${l.id}`, {
      title: "Düzeltilmiş başlık", categoryId: cat.id, price: "900", currency: "TL", condition: "Sıfır",
      city: "Lefkoşa", district: "", description: "Admin düzeltti", negotiable: true, status: "active", attributes: {},
    });
    assert.equal(res.statusCode, 200, res.body);
    const [row] = await t.owner`select status, category_id from listings where id = ${l.id}`;
    assert.equal(row.status, "active");
    assert.equal(row.categoryId, cat.id);
  });

  test("sanctions apply, restrict actions, and are lifted", async () => {
    const admin = await newUser(t, "Yönetici", { admin: true });
    const u = await newUser(t);
    assert.equal((await admin.post(`/api/v1/admin/users/${admin.id}/sanctions`, { kind: "suspend", reason: "Kendime deneme" })).statusCode, 422);
    assert.equal((await admin.post(`/api/v1/admin/users/${u.id}/sanctions`, { kind: "restrict", reason: "Spam ilanlar", days: 3 })).statusCode, 200);
    const [p] = await t.owner`select status, status_until from profiles where id = ${u.id}`;
    assert.equal(p.status, "restricted");
    assert.ok(p.statusUntil);
    const seller = await newUser(t);
    const l = await newListing(t, seller);
    assert.equal((await u.post("/api/v1/conversations", { listingId: l.id })).statusCode, 403);
    assert.equal((await u.put(`/api/v1/me/favorites/${l.id}`)).statusCode, 403);
    assert.equal((await admin.post(`/api/v1/admin/users/${u.id}/sanctions`, { kind: "lift", reason: "İtiraz kabul edildi" })).statusCode, 200);
    assert.equal((await u.post("/api/v1/conversations", { listingId: l.id })).statusCode, 200);
  });

  test("admins cannot delete themselves or other admins; deleting a user is audited", async () => {
    const admin = await newUser(t, "Yönetici", { admin: true });
    const other = await newUser(t, "Diğer yönetici", { admin: true });
    const u = await newUser(t);
    assert.equal((await admin.del(`/api/v1/admin/users/${admin.id}`)).statusCode, 422);
    assert.equal((await admin.del(`/api/v1/admin/users/${other.id}`)).statusCode, 422);
    assert.equal((await admin.del(`/api/v1/admin/users/${u.id}`)).statusCode, 200);
    assert.equal((await u.get("/api/v1/auth/me")).statusCode, 401, "the deleted user's session is gone");
    const [log] = await t.owner`select action from admin_audit_log where target_id = ${u.id}`;
    assert.equal(log.action, "user.delete");
  });

  test("admin sign-out ends a user's sessions", async () => {
    const admin = await newUser(t, "Yönetici", { admin: true });
    const u = await newUser(t);
    assert.equal((await admin.post(`/api/v1/admin/users/${u.id}/sign-out`)).statusCode, 200);
    assert.equal((await u.get("/api/v1/auth/me")).statusCode, 401);
  });

  test("an admin cannot remove their own admin role", async () => {
    const admin = await newUser(t, "Yönetici", { admin: true });
    const res = await admin.put(`/api/v1/admin/users/${admin.id}`, {
      name: "Yönetici", region: "", bio: "", phone: "", phoneVerified: false, role: "user", accountType: "personal",
      store: { storeName: "", address: "", phone: "", website: "", hours: "" }, storeVerified: false,
    });
    assert.equal(res.statusCode, 422);
  });

  test("phone review approval writes the number and the flag; a later change clears it (P0-07)", async () => {
    const admin = await newUser(t, "Yönetici", { admin: true });
    const u = await newUser(t);
    assert.equal((await u.post("/api/v1/me/verification-requests", { phone: "05331234567" })).statusCode, 200);
    assert.equal((await u.post("/api/v1/me/verification-requests", { phone: "05331234567" })).statusCode, 422, "one pending request");
    const [req] = await t.owner`select id from verification_requests where user_id = ${u.id}`;
    assert.equal((await admin.post(`/api/v1/admin/verifications/${req.id}`, { approve: true })).statusCode, 200);
    let [p] = await t.owner`select phone_verified from profiles where id = ${u.id}`;
    assert.equal(p.phoneVerified, true);
    await u.put("/api/v1/me/contact", { phone: "05339999999", whatsapp: false });
    [p] = await t.owner`select phone_verified from profiles where id = ${u.id}`;
    assert.equal(p.phoneVerified, false);
  });
});

describe("categories and attributes", () => {
  test("admin changes are visible in the taxonomy immediately; slugs never change", async () => {
    const admin = await newUser(t, "Yönetici", { admin: true });
    const created = await admin.post("/api/v1/admin/categories", { name: "Kamp Sandalyesi", parentId: 7, icon: "tent" });
    assert.equal(created.statusCode, 200, created.body);
    const tax = await anon(t.app).get("/api/v1/taxonomy");
    const cat = tax.data.categories.find((c: { id: number }) => c.id === created.data.id);
    assert.equal(cat.slug, "kamp-sandalyesi");
    const attr = await admin.post("/api/v1/admin/attributes", {
      categoryId: created.data.id, key: "weight_kg", label: "Ağırlık", type: "number", unit: "kg", min: 0, max: 50, filterable: true,
    });
    assert.equal(attr.statusCode, 200, attr.body);
    const effective = await anon(t.app).get(`/api/v1/categories/${created.data.id}/attributes`);
    assert.ok(effective.data.attributes.some((a: { key: string }) => a.key === "weight_kg"));
    assert.ok(effective.data.attributes.some((a: { key: string }) => a.key === "delivery"), "global attributes are inherited");
    const cycle = await admin.put(`/api/v1/admin/categories/7`, { name: "Spor & Outdoor", parentId: created.data.id });
    assert.equal(cycle.statusCode, 422, "no cycles");
    const seller = await newUser(t);
    const l = await newListing(t, seller, { categoryId: created.data.id, attributes: { weight_kg: 3 } });
    assert.ok(l.id);
    assert.equal((await admin.del(`/api/v1/admin/categories/${created.data.id}`)).statusCode, 422, "categories in use cannot be deleted");
  });
});
