// P1-06: server-side validation schemas (the DB CHECKs mirror them in 0009).
//
//   npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LIMITS,
  listingCreateSchema,
  listingUpdateSchema,
  messageSchema,
  phoneSchema,
  profileSchema,
  ratingSchema,
  reportSchema,
  supportSchema,
} from "../src/lib/validation.ts";

const MB = "x".repeat(1024 * 1024);
const listing = {
  title: "Ahşap berjer",
  categorySlug: "mobilya",
  condition: "Az kullanılmış",
  description: "Temiz",
  price: "1500",
  currency: "TL",
  city: "Girne",
  district: " Alsancak ",
  negotiable: false,
  photos: ["u/1.jpg"],
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
});

test("listing abuse: whitespace title, megabyte description, invalid city, bad price, photo count", () => {
  bad(listingCreateSchema, { ...listing, title: "      " }, /Başlık/);
  bad(listingCreateSchema, { ...listing, title: "x".repeat(121) }, /en fazla 120/);
  bad(listingCreateSchema, { ...listing, description: MB }, /Açıklama/);
  bad(listingCreateSchema, { ...listing, city: "Mars" }, /bölge/);
  for (const price of ["-1", "abc", "1e12", "Infinity", ""]) bad(listingCreateSchema, { ...listing, price });
  bad(listingCreateSchema, { ...listing, currency: "USD" });
  bad(listingCreateSchema, { ...listing, condition: "Mükemmel" });
  bad(listingCreateSchema, { ...listing, photos: [] }, /En az 1/);
  bad(listingCreateSchema, { ...listing, photos: Array(LIMITS.maxPhotos + 1).fill("u/x.jpg") }, /En fazla 10/);
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

test("phone: spaces removed, 10-15 digits with optional +", () => {
  assert.equal(ok(phoneSchema, "+90 533 811 22 33"), "+905338112233");
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
