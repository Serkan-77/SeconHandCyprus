// P1-06: request validation (shared/schemas.ts), used by the API
// (authoritative) and the web forms. The database CHECKs mirror the limits.
//
//   npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { LIMITS } from "../shared/constants.ts";
import {
  emailSchema,
  listingCreateSchema,
  listingUpdateSchema,
  loginSchema,
  messageSchema,
  passwordSchema,
  phoneSchema,
  profileSchema,
  ratingSchema,
  reportSchema,
  signupSchema,
  storeSchema,
  supportSchema,
} from "../shared/schemas.ts";

const MB = "x".repeat(1024 * 1024);
const listing = {
  title: "Ahşap berjer",
  categoryId: 1001,
  condition: "Az kullanılmış",
  description: "Temiz",
  price: "1500",
  currency: "TL",
  city: "Girne",
  district: " Alsancak ",
  negotiable: false,
  photos: ["l/2026/10/0b0e4a8e-7c1d-4f5e-9a3b-2c6d8e1f0a4b"],
  submissionKey: "0b0e4a8e-7c1d-4f5e-9a3b-2c6d8e1f0a4b",
};
const ok = (schema, value) => {
  const r = schema.safeParse(value);
  assert.ok(r.success, JSON.stringify(r.error?.issues?.[0]));
  return r.data;
};
const bad = (schema, value, re) => {
  const r = schema.safeParse(value);
  assert.equal(r.success, false, `kabul edildi: ${JSON.stringify(value).slice(0, 80)}`);
  if (re) assert.match(r.error.issues[0].message, re);
};

test("valid listing parses; text trimmed, price coerced, empty district becomes null", () => {
  const d = ok(listingCreateSchema, listing);
  assert.equal(d.price, 1500);
  assert.equal(d.district, "Alsancak");
  assert.equal(ok(listingCreateSchema, { ...listing, district: "   " }).district, null);
  assert.equal(ok(listingCreateSchema, { ...listing, price: 1499.999 }).price, 1500);
});

test("listing abuse: whitespace title, megabyte description, invalid city, bad price, photo count", () => {
  bad(listingCreateSchema, { ...listing, title: "      " }, /Başlık/);
  bad(listingCreateSchema, { ...listing, title: "x".repeat(121) }, /en fazla 120/);
  bad(listingCreateSchema, { ...listing, description: MB }, /Açıklama/);
  bad(listingCreateSchema, { ...listing, city: "Mars" }, /bölge/);
  for (const price of ["-1", "abc", "1e12", "Infinity", ""]) bad(listingCreateSchema, { ...listing, price });
  bad(listingCreateSchema, { ...listing, currency: "USD" });
  bad(listingCreateSchema, { ...listing, condition: "Mükemmel" });
  bad(listingCreateSchema, { ...listing, categoryId: 0 });
  bad(listingCreateSchema, { ...listing, categoryId: "mobilya" });
  bad(listingCreateSchema, { ...listing, photos: [] }, /En az 1/);
  bad(listingCreateSchema, { ...listing, photos: Array(LIMITS.maxPhotos + 1).fill("k") }, /En fazla 10/);
  bad(listingCreateSchema, { ...listing, submissionKey: "" });
  bad(listingCreateSchema, { ...listing, submissionKey: "not-a-uuid" });
  bad(listingUpdateSchema, { title: "  ab  ", price: 1, city: "Girne", description: "" }, /en az 3/);
});

test("profile: display name 2-40 trimmed, bio 500, region from the list or empty", () => {
  assert.deepEqual(ok(profileSchema, { name: " Deniz A. ", region: "", bio: "  " }), { name: "Deniz A.", region: null, bio: null });
  bad(profileSchema, { name: " a ", region: "" }, /en az 2/);
  bad(profileSchema, { name: "x".repeat(41), region: "" });
  bad(profileSchema, { name: "Deniz", region: "Mars" });
  bad(profileSchema, { name: "Deniz", region: "", bio: MB });
});

test("phone: spaces and punctuation removed, 10-15 digits with optional +", () => {
  assert.equal(ok(phoneSchema, "+90 (533) 811-22-33"), "+905338112233");
  for (const v of ["12345", "+90abc", "0".repeat(16), "   "]) bad(phoneSchema, v);
});

test("message, rating, report and support limits", () => {
  assert.equal(ok(messageSchema, "  merhaba  "), "merhaba");
  bad(messageSchema, "   ");
  bad(messageSchema, "x".repeat(LIMITS.messageMax + 1));
  for (const score of [0, 6, 2.5, NaN]) bad(ratingSchema, { score, comment: "" });
  assert.equal(ok(ratingSchema, { score: 5, comment: "  " }).comment, null);
  bad(ratingSchema, { score: 4, comment: MB });
  bad(reportSchema, { reason: "   ", detail: "" });
  bad(reportSchema, { reason: "Spam", detail: MB });
  bad(supportSchema, { email: "", topic: "Diğer", message: "" });
  bad(supportSchema, { email: "not-an-email", topic: "Diğer", message: "0123456789 yeterli" });
  bad(supportSchema, { email: "a@b.co", topic: "Diğer", message: "kısa" }, /en az 10/);
  bad(supportSchema, { email: "a@b.co", topic: "   ", message: "0123456789 yeterli" });
  ok(supportSchema, { email: " user@example.com ", topic: "Diğer", message: "Yeterince uzun bir mesaj." });
});

test("sign-up and sign-in input", () => {
  const s = ok(signupSchema, { email: " Ayse@Example.COM ", password: "uzun-ve-guclu-1", name: " Ayşe ", region: "", phone: "" });
  assert.equal(s.email, "ayse@example.com", "e-mail is normalised");
  assert.equal(s.region, null);
  assert.equal(s.phone, null);
  bad(signupSchema, { email: "ayse@example.com", password: "kisa", name: "Ayşe" }, /en az 8/);
  bad(passwordSchema, "12345678", /yaygın/);
  bad(passwordSchema, "x".repeat(LIMITS.passwordMax + 1));
  bad(emailSchema, "a@b");
  bad(loginSchema, { email: "a@b.co", password: "" });
});

test("store profile: name required, optional fields become null, website gets a scheme", () => {
  const parsed = ok(storeSchema, { storeName: " Girne Mobilya ", address: "", phone: "", website: "", hours: "" });
  assert.deepEqual(parsed, { storeName: "Girne Mobilya", address: null, phone: null, website: null, hours: null });
  bad(storeSchema, { storeName: "x", address: "", phone: "", website: "", hours: "" });
  const full = ok(storeSchema, { storeName: "Dükkan", address: "", phone: "+90 533 123 45 67", website: "ornek.com", hours: "" });
  assert.equal(full.website, "https://ornek.com");
  assert.equal(full.phone, "+905331234567");
  bad(storeSchema, { storeName: "Dükkan", address: "", phone: "123", website: "", hours: "" });
  bad(storeSchema, { storeName: "Dükkan", address: "", phone: "", website: "not a url", hours: "" });
});
